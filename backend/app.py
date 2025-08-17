import os
import json
import random
import logging
import redis
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_socketio import SocketIO, emit
from models import db, User, TypingSession, Leaderboard, PromptText
from auth import token_required, generate_token


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///typetrack.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_timeout': 20,
    'pool_recycle': -1,
    'pool_pre_ping': True
}

# Initialize extensions
db.init_app(app)
CORS(app, origins=["http://localhost:3000", "http://localhost:8080", "*"])
bcrypt = Bcrypt(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Redis client
try:
    redis_client = redis.Redis(
        host=os.environ.get('REDIS_HOST', 'localhost'),
        port=int(os.environ.get('REDIS_PORT', 6379)),
        db=0,
        decode_responses=True,
        socket_timeout=5,
        socket_connect_timeout=5
    )
    redis_client.ping()  # Test connection
    logger.info("Redis connected successfully")
except Exception as e:
    logger.warning(f"Redis connection failed: {e}")
    redis_client = None

# Sample prompts data
PROMPTS_DATA = {
    'easy': [
        "The quick brown fox jumps over the lazy dog.",
        "Python is a powerful programming language.",
        "Web development is fun and exciting.",
        "Coffee helps programmers stay awake.",
        "Simple sentences are easy to type."
    ],
    'medium': [
        "Machine learning algorithms enable computers to learn patterns from data.",
        "Full-stack development requires knowledge of both frontend and backend technologies.",
        "Database optimization techniques improve application performance significantly.",
        "Version control systems like Git help developers collaborate effectively.",
        "Responsive design ensures websites work well on all device sizes."
    ],
    'hard': [
        "Asynchronous programming paradigms facilitate concurrent execution without blocking the main thread.",
        "Microservices architecture enables scalable distributed system design.",
        "Advanced algorithms optimize computational complexity through dynamic programming.",
        "Cloud-native applications leverage containerization and autoscaling.",
        "Real-time data processing pipelines enable low-latency analytics."
    ]
}

def init_sample_data():
    """Initialize sample prompts in database"""
    if PromptText.query.count() == 0:
        for difficulty, prompts in PROMPTS_DATA.items():
            for prompt_text in prompts:
                prompt = PromptText(
                    text=prompt_text,
                    difficulty=difficulty,
                    category='general'
                )
                db.session.add(prompt)
        db.session.commit()
        logger.info("Sample prompts added")


def create_tables():
    """Create database tables and initialize data"""
    db.create_all()
    init_sample_data()
    logger.info("Database initialized")
if __name__ == '__main__':
    with app.app_context():
        create_tables()
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)

@app.errorhandler(404)
def not_found(error):
    return jsonify({'message': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal error: {error}")
    return jsonify({'message': 'Internal server error'}), 500

# Helper functions for caching
def cache_set(key, value, expiration=300):
    if redis_client:
        try:
            redis_client.setex(key, expiration, json.dumps(value))
        except Exception as e:
            logger.warning(f"Cache set failed: {e}")

def cache_get(key):
    if redis_client:
        try:
            cached = redis_client.get(key)
            return json.loads(cached) if cached else None
        except Exception as e:
            logger.warning(f"Cache get failed: {e}")
    return None

# API routes
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'version': '1.0'
    })

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or not all(k in data for k in ('username', 'email', 'password')):
        return jsonify({'message': 'Missing required fields'}), 400
    username = data['username'].strip()
    email = data['email'].strip().lower()
    password = data['password']
    if User.query.filter_by(username=username).first():
        return jsonify({'message': 'Username already exists'}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'message': 'Email already registered'}), 400
    pw_hash = bcrypt.generate_password_hash(password).decode('utf-8')
    user = User(username=username, email=email, password_hash=pw_hash)
    db.session.add(user)
    db.session.commit()
    logger.info(f"Registered user {username}")
    return jsonify({'message': 'User registered successfully'}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not all(k in data for k in ('username', 'password')):
        return jsonify({'message': 'Missing username or password'}), 400
    username = data['username'].strip()
    password = data['password']
    user = User.query.filter_by(username=username).first()
    if not user or not bcrypt.check_password_hash(user.password_hash, password):
        return jsonify({'message': 'Invalid credentials'}), 401
    if not user.is_active:
        return jsonify({'message': 'User account disabled'}), 401
    token = generate_token(user.id)
    logger.info(f"User {username} logged in")
    return jsonify({'token': token, 'user': user.to_dict()}), 200

@app.route('/api/prompt', methods=['GET'])
def get_prompt():
    difficulty = request.args.get('difficulty', 'medium')
    category = request.args.get('category', 'general')
    if difficulty not in ['easy', 'medium', 'hard']:
        difficulty = 'medium'
    cache_key = f"prompt:{difficulty}:{category}"
    cached = cache_get(cache_key)
    if cached:
        return jsonify(cached)
    prompts = PromptText.query.filter_by(difficulty=difficulty, category=category, is_active=True).all()
    text = random.choice([p.text for p in prompts]) if prompts else random.choice(PROMPTS_DATA[difficulty])
    result = {
        'prompt': text,
        'difficulty': difficulty,
        'category': category,
        'length': len(text),
        'word_count': len(text.split())
    }
    cache_set(cache_key, result)
    return jsonify(result)

@app.route('/api/submit', methods=['POST'])
@token_required
def submit_session(current_user):
    data = request.get_json()
    if not data or not all(k in data for k in ('wpm', 'accuracy')):
        return jsonify({'message': 'Missing required fields'}), 400
    session = TypingSession(
        user_id=current_user.id,
        wpm=float(data['wpm']),
        accuracy=float(data['accuracy']),
        difficulty=data.get('difficulty', 'medium'),
        errors=int(data.get('errors', 0)),
        characters_typed=int(data.get('characters_typed', 0)),
        time_taken=float(data.get('time_taken', 0))
    )
    db.session.add(session)
    leaderboard = Leaderboard.query.filter_by(user_id=current_user.id).first()
    if not leaderboard:
        leaderboard = Leaderboard(user_id=current_user.id, best_wpm=session.wpm,
                                  best_accuracy=session.accuracy, total_tests=1,
                                  total_time=session.time_taken)
        db.session.add(leaderboard)
    else:
        leaderboard.best_wpm = max(leaderboard.best_wpm, session.wpm)
        leaderboard.best_accuracy = max(leaderboard.best_accuracy, session.accuracy)
        leaderboard.total_tests += 1
        leaderboard.total_time += session.time_taken
        leaderboard.updated_at = datetime.utcnow()
    db.session.commit()
    socketio.emit('leaderboard_update', {'user': current_user.username,
                                         'wpm': session.wpm,
                                         'accuracy': session.accuracy,
                                         'timestamp': session.timestamp.isoformat()})
    logger.info(f"Session submitted by {current_user.username}, WPM: {session.wpm}")
    return jsonify({'message': 'Session saved', 'session_id': session.id}), 201

@app.route('/api/analytics', methods=['GET'])
@token_required
def analytics(current_user):
    limit = int(request.args.get('limit', 20))
    difficulty = request.args.get('difficulty')
    query = TypingSession.query.filter_by(user_id=current_user.id)
    if difficulty:
        query = query.filter_by(difficulty=difficulty)
    sessions = query.order_by(TypingSession.timestamp.desc()).limit(limit).all()
    if not sessions:
        return jsonify({'total_sessions': 0, 'average_wpm': 0, 'average_accuracy': 0,
                        'best_wpm': 0, 'best_accuracy': 0, 'improvement_rate': 0, 'history': []})
    total = len(sessions)
    avg_wpm = sum(s.wpm for s in sessions) / total
    avg_accuracy = sum(s.accuracy for s in sessions) / total
    best_wpm = max(s.wpm for s in sessions)
    best_accuracy = max(s.accuracy for s in sessions)
    improvement_rate = 0
    if total >= 10:
        first_avg = sum(s.wpm for s in sessions[-5:]) / 5
        last_avg = sum(s.wpm for s in sessions[:5]) / 5
        improvement_rate = ((last_avg - first_avg) / first_avg) * 100 if first_avg > 0 else 0
    history = [s.to_dict() for s in sessions]
    return jsonify({'total_sessions': total, 'average_wpm': round(avg_wpm, 2),
                    'average_accuracy': round(avg_accuracy, 2), 'best_wpm': round(best_wpm, 2),
                    'best_accuracy': round(best_accuracy, 2), 'improvement_rate': round(improvement_rate, 2),
                    'history': history})

@app.route('/api/leaderboard', methods=['GET'])
def leaderboard():
    limit = int(request.args.get('limit', 10))
    cache_key = f"leaderboard:global:{limit}"
    cached = cache_get(cache_key)
    if cached:
        return jsonify(cached)
    top = (db.session.query(Leaderboard, User)
           .join(User)
           .filter(User.is_active == True)
           .order_by(Leaderboard.best_wpm.desc())
           .limit(limit).all())
    result = []
    for i, (lb, user) in enumerate(top, 1):
        result.append({'rank': i, 'username': user.username, 'best_wpm': round(lb.best_wpm, 2),
                       'best_accuracy': round(lb.best_accuracy, 2), 'total_tests': lb.total_tests,
                       'updated_at': lb.updated_at.isoformat()})
    data = {'leaderboard': result}
    cache_set(cache_key, data)
    return jsonify(data)

@socketio.on('connect')
def on_connect():
    logger.info(f"Client connected: {request.sid}")
    emit('connected', {'message': 'Connected', 'timestamp': datetime.utcnow().isoformat()})

@socketio.on('disconnect')
def on_disconnect():
    logger.info(f"Client disconnected: {request.sid}")

@socketio.on('typing_update')
def on_typing_update(data):
    try:
        user_input = data.get('input', '')
        prompt = data.get('prompt', '')
        start_time = data.get('start_time')
        if not start_time or not prompt:
            return
        start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
        elapsed = (datetime.utcnow() - start_dt).total_seconds()
        if elapsed <= 0:
            return
        words = len(user_input.split())
        wpm = (words / elapsed) * 60
        correct_chars = sum(1 for i, c in enumerate(user_input) if i < len(prompt) and c == prompt[i])
        accuracy = (correct_chars / len(prompt)) * 100 if prompt else 0
        progress = (len(user_input) / len(prompt)) * 100 if prompt else 0
        errors = len(user_input) - correct_chars
        emit('metrics_update', {'wpm': round(wpm, 2), 'accuracy': round(accuracy, 2),
                                'progress': round(progress, 2), 'errors': errors,
                                'elapsed_time': round(elapsed)})
    except Exception as e:
        logger.error(f"Typing update error: {e}")
        emit('error', {'message': 'Failed to update metrics'})

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5001, debug=True)  
