from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(128), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    # Relationships
    sessions = db.relationship('TypingSession', backref='user', lazy=True, cascade='all, delete-orphan')
    leaderboard = db.relationship('Leaderboard', backref='user', uselist=False, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<User {self.username}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'created_at': self.created_at.isoformat(),
            'is_active': self.is_active
        }

class TypingSession(db.Model):
    __tablename__ = 'typing_sessions'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    wpm = db.Column(db.Float, nullable=False)
    accuracy = db.Column(db.Float, nullable=False)
    difficulty = db.Column(db.String(20), default='medium', index=True)
    errors = db.Column(db.Integer, default=0)
    characters_typed = db.Column(db.Integer, default=0)
    time_taken = db.Column(db.Float, default=0)  # in seconds
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    def __repr__(self):
        return f'<TypingSession {self.id}: {self.wpm} WPM>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'wpm': self.wpm,
            'accuracy': self.accuracy,
            'difficulty': self.difficulty,
            'errors': self.errors,
            'characters_typed': self.characters_typed,
            'time_taken': self.time_taken,
            'timestamp': self.timestamp.isoformat()
        }

class Leaderboard(db.Model):
    __tablename__ = 'leaderboard'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), unique=True, nullable=False)
    best_wpm = db.Column(db.Float, default=0, index=True)
    best_accuracy = db.Column(db.Float, default=0)
    total_tests = db.Column(db.Integer, default=0)
    total_time = db.Column(db.Float, default=0)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f'<Leaderboard {self.user_id}: {self.best_wpm} WPM>'
    
    def to_dict(self):
        return {
            'user_id': self.user_id,
            'username': self.user.username if self.user else 'Unknown',
            'best_wpm': self.best_wpm,
            'best_accuracy': self.best_accuracy,
            'total_tests': self.total_tests,
            'total_time': self.total_time,
            'updated_at': self.updated_at.isoformat()
        }

class PromptText(db.Model):
    __tablename__ = 'prompts'
    
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.Text, nullable=False)
    difficulty = db.Column(db.String(20), nullable=False, index=True)
    language = db.Column(db.String(10), default='en')
    category = db.Column(db.String(50), default='general')
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<Prompt {self.id}: {self.difficulty}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'text': self.text,
            'difficulty': self.difficulty,
            'language': self.language,
            'category': self.category,
            'is_active': self.is_active
        }

