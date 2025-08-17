import jwt
from flask import request, jsonify, current_app
from functools import wraps
from models import User
import logging

logger = logging.getLogger(__name__)

def token_required(f):
    """
    Decorator to require JWT token for protected routes
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Check for token in Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                if auth_header.startswith('Bearer '):
                    token = auth_header.split(' ')[1]
                else:
                    token = auth_header
            except IndexError:
                return jsonify({'message': 'Token format invalid. Use: Bearer <token>'}), 401
        
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        
        try:
            # Decode the token
            data = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.get(data['user_id'])
            
            if not current_user:
                return jsonify({'message': 'User not found!'}), 401
                
            if not current_user.is_active:
                return jsonify({'message': 'User account is disabled!'}), 401
                
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Token is invalid!'}), 401
        except Exception as e:
            logger.error(f"Token validation error: {str(e)}")
            return jsonify({'message': 'Token validation failed!'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated

def generate_token(user_id, expires_in_hours=24):
    """
    Generate JWT token for user
    """
    from datetime import datetime, timedelta
    
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(hours=expires_in_hours),
        'iat': datetime.utcnow()
    }
    
    return jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')

def verify_token(token):
    """
    Verify JWT token and return user data
    """
    try:
        data = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=["HS256"])
        user = User.query.get(data['user_id'])
        return user if user and user.is_active else None
    except:
        return None
