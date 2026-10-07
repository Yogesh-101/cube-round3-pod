import hashlib
import hmac
import secrets
from typing import Optional
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.entities import User, UserSession
from app.schemas.auth import UserRegisterRequest
from app.config import settings

def hash_password(password: str) -> str:
    """
    Hashes password using PBKDF2-HMAC-SHA256 with per-user salt and app secret.
    Format: salt$derived_hex
    """
    salt = secrets.token_hex(16)
    # Combine salt with app secret for extra security
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        f"{salt}:{settings.AUTH_SECRET}".encode('utf-8'),
        iterations=100_000
    )
    return f"{salt}${key.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies plain password against stored salt$derived_hex using constant-time comparison.
    """
    try:
        salt, expected_hex = hashed_password.split('$', 1)
        derived = hashlib.pbkdf2_hmac(
            'sha256',
            plain_password.encode('utf-8'),
            f"{salt}:{settings.AUTH_SECRET}".encode('utf-8'),
            iterations=100_000
        )
        return hmac.compare_digest(derived.hex(), expected_hex)
    except Exception:
        return False

class AuthService:
    @staticmethod
    def register_user(db: Session, req: UserRegisterRequest) -> User:
        existing = db.query(User).filter(User.email == req.email).first()
        if existing:
            raise ValueError(f"User with email '{req.email}' already exists")

        new_user = User(
            email=req.email,
            full_name=req.full_name.strip(),
            hashed_password=hash_password(req.password)
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user

    @staticmethod
    def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
        clean_email = email.strip().lower()
        user = db.query(User).filter(User.email == clean_email).first()
        if not user or not verify_password(password, user.hashed_password):
            return None
        return user

    @staticmethod
    def create_session(db: Session, user: User) -> str:
        token = secrets.token_urlsafe(32)
        session = UserSession(token=token, user_id=user.id)
        db.add(session)
        db.commit()
        return token

    @staticmethod
    def get_user_by_token(db: Session, token: str) -> Optional[User]:
        if not token:
            return None
        session = db.query(UserSession).filter(UserSession.token == token).first()
        if not session:
            return None
        return session.user

    @staticmethod
    def invalidate_session(db: Session, token: str) -> bool:
        session = db.query(UserSession).filter(UserSession.token == token).first()
        if session:
            db.delete(session)
            db.commit()
            return True
        return False
