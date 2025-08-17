from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import random
import datetime

app = Flask(__name__)
CORS(app, origins=["http://localhost:8080", "*"])

# In-memory storage for testing
users = {}
sessions = []

PROMPTS = {
    'easy': ["The quick brown fox jumps over the lazy dog."],
    'medium': ["Python is a powerful programming language."],
    'hard': ["Advanced programming requires dedication and practice."]
}

@app.route('/api/health', methods=['GET'])
def health():
    return {'status': 'healthy', 'timestamp': datetime.datetime.now().isoformat()}

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    users[data['username']] = data['password']
    return {'message': 'Registered successfully'}, 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    if users.get(data['username']) == data['password']:
        return {'token': 'fake-token', 'user': {'username': data['username']}}, 200
    return {'message': 'Invalid credentials'}, 401

@app.route('/api/prompt', methods=['GET'])
def get_prompt():
    difficulty = request.args.get('difficulty', 'medium')
    prompt = random.choice(PROMPTS.get(difficulty, PROMPTS['medium']))
    return {'prompt': prompt, 'difficulty': difficulty}

@app.route('/api/submit', methods=['POST'])
def submit():
    data = request.json
    sessions.append(data)
    return {'message': 'Session saved'}, 201

@app.route('/api/analytics', methods=['GET'])
def analytics():
    if not sessions:
        return {
            'total_sessions': 0, 'average_wpm': 0, 'average_accuracy': 0,
            'best_wpm': 0, 'best_accuracy': 0, 'history': []
        }
    
    avg_wpm = sum(s['wpm'] for s in sessions) / len(sessions)
    avg_acc = sum(s['accuracy'] for s in sessions) / len(sessions)
    
    return {
        'total_sessions': len(sessions),
        'average_wpm': round(avg_wpm, 2),
        'average_accuracy': round(avg_acc, 2),
        'best_wpm': max(s['wpm'] for s in sessions),
        'best_accuracy': max(s['accuracy'] for s in sessions),
        'history': sessions[-10:]
    }

@app.route('/api/leaderboard', methods=['GET'])
def leaderboard():
    return {'leaderboard': []}

if __name__ == '__main__':
    print("🚀 TypeTrack Backend starting...")
    print("📍 API available at: http://localhost:5001")
    print("🏥 Health check: http://localhost:5001/api/health")
    app.run(debug=True, port=5001, host='0.0.0.0')

