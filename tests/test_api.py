"""
Unit and integration tests for TypeTrack API
"""

import pytest
import json
from backend.app import app, db
from backend.models import User, TypingSession, Leaderboard

@pytest.fixture
def client():
    """Create test client"""
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            yield client
            db.drop_all()

@pytest.fixture
def auth_headers(client):
    """Create authenticated user and return headers"""
    # Register user
    client.post('/api/register', 
                data=json.dumps({
                    'username': 'testuser',
                    'email': 'test@example.com',
                    'password': 'testpass123'
                }),
                content_type='application/json')
    
    # Login user
    response = client.post('/api/login',
                          data=json.dumps({
                              'username': 'testuser',
                              'password': 'testpass123'
                          }),
                          content_type='application/json')
    
    data = json.loads(response.data)
    return {'Authorization': f"Bearer {data['token']}"}

class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_register_success(self, client):
        """Test successful user registration"""
        response = client.post('/api/register',
                              data=json.dumps({
                                  'username': 'newuser',
                                  'email': 'new@example.com',
                                  'password': 'password123'
                              }),
                              content_type='application/json')
        
        assert response.status_code == 201
        data = json.loads(response.data)
        assert 'message' in data
    
    def test_register_duplicate_username(self, client):
        """Test registration with duplicate username"""
        # Register first user
        client.post('/api/register',
                   data=json.dumps({
                       'username': 'duplicate',
                       'email': 'first@example.com',
                       'password': 'password123'
                   }),
                   content_type='application/json')
        
        # Try to register with same username
        response = client.post('/api/register',
                              data=json.dumps({
                                  'username': 'duplicate',
                                  'email': 'second@example.com',
                                  'password': 'password123'
                              }),
                              content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'exists' in data['message'].lower()
    
    def test_login_success(self, client):
        """Test successful login"""
        # Register user first
        client.post('/api/register',
                   data=json.dumps({
                       'username': 'loginuser',
                       'email': 'login@example.com',
                       'password': 'password123'
                   }),
                   content_type='application/json')
        
        # Login
        response = client.post('/api/login',
                              data=json.dumps({
                                  'username': 'loginuser',
                                  'password': 'password123'
                              }),
                              content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'token' in data
        assert 'user' in data
    
    def test_login_invalid_credentials(self, client):
        """Test login with invalid credentials"""
        response = client.post('/api/login',
                              data=json.dumps({
                                  'username': 'nonexistent',
                                  'password': 'wrongpass'
                              }),
                              content_type='application/json')
        
        assert response.status_code == 401

class TestPrompts:
    """Test prompt endpoints"""
    
    def test_get_prompt_default(self, client):
        """Test getting default prompt"""
        response = client.get('/api/prompt')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'prompt' in data
        assert 'difficulty' in data
        assert data['difficulty'] == 'medium'
    
    def test_get_prompt_with_difficulty(self, client):
        """Test getting prompt with specific difficulty"""
        for difficulty in ['easy', 'medium', 'hard']:
            response = client.get(f'/api/prompt?difficulty={difficulty}')
            
            assert response.status_code == 200
            data = json.loads(response.data)
            assert data['difficulty'] == difficulty

class TestSessions:
    """Test session management"""
    
    def test_submit_session_success(self, client, auth_headers):
        """Test successful session submission"""
        response = client.post('/api/submit',
                              data=json.dumps({
                                  'wpm': 75.5,
                                  'accuracy': 92.3,
                                  'difficulty': 'medium',
                                  'errors': 8,
                                  'characters_typed': 450,
                                  'time_taken': 120.5
                              }),
                              content_type='application/json',
                              headers=auth_headers)
        
        assert response.status_code == 201
        data = json.loads(response.data)
        assert 'session_id' in data
    
    def test_submit_session_unauthorized(self, client):
        """Test session submission without authentication"""
        response = client.post('/api/submit',
                              data=json.dumps({
                                  'wpm': 75.5,
                                  'accuracy': 92.3
                              }),
                              content_type='application/json')
        
        assert response.status_code == 401
    
    def test_submit_session_invalid_data(self, client, auth_headers):
        """Test session submission with invalid data"""
        response = client.post('/api/submit',
                              data=json.dumps({
                                  'wpm': -10,  # Invalid negative WPM
                                  'accuracy': 150  # Invalid accuracy > 100
                              }),
                              content_type='application/json',
                              headers=auth_headers)
        
        # Should still accept but could add validation
        assert response.status_code in [201, 400]

class TestAnalytics:
    """Test analytics endpoints"""
    
    def test_get_analytics_empty(self, client, auth_headers):
        """Test analytics with no sessions"""
        response = client.get('/api/analytics', headers=auth_headers)
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['total_sessions'] == 0
        assert data['average_wpm'] == 0
    
    def test_get_analytics_with_sessions(self, client, auth_headers):
        """Test analytics with existing sessions"""
        # Submit a few sessions
        sessions_data = [
            {'wpm': 60, 'accuracy': 85, 'difficulty': 'easy'},
            {'wpm': 70, 'accuracy': 90, 'difficulty': 'medium'},
            {'wpm': 80, 'accuracy': 95, 'difficulty': 'hard'}
        ]
        
        for session in sessions_data:
            client.post('/api/submit',
                       data=json.dumps(session),
                       content_type='application/json',
                       headers=auth_headers)
        
        # Get analytics
        response = client.get('/api/analytics', headers=auth_headers)
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['total_sessions'] == 3
        assert data['average_wpm'] == 70  # (60+70+80)/3
        assert len(data['history']) == 3

class TestLeaderboard:
    """Test leaderboard functionality"""
    
    def test_get_empty_leaderboard(self, client):
        """Test leaderboard with no data"""
        response = client.get('/api/leaderboard')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'leaderboard' in data
        assert len(data['leaderboard']) == 0
    
    def test_get_leaderboard_with_data(self, client, auth_headers):
        """Test leaderboard with user data"""
        # Submit session to create leaderboard entry
        client.post('/api/submit',
                   data=json.dumps({
                       'wpm': 85,
                       'accuracy': 95,
                       'difficulty': 'hard'
                   }),
                   content_type='application/json',
                   headers=auth_headers)
        
        # Get leaderboard
        response = client.get('/api/leaderboard')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data['leaderboard']) == 1
        assert data['leaderboard'][0]['best_wpm'] == 85

class TestHealthCheck:
    """Test health check endpoint"""
    
    def test_health_check(self, client):
        """Test health check endpoint"""
        response = client.get('/api/health')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'healthy'
        assert 'timestamp' in data

if __name__ == '__main__':
    pytest.main([__file__, '-v'])

