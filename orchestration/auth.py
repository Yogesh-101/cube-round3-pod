"""Authentication and authorization utilities for Cube Orchestrator.

Provides:
- Secure password hashing with PBKDF2-HMAC-SHA256 + cryptographic salt
- RFC 7519 compliant HMAC-SHA256 JWT tokens
- Password strength validation and email normalization
- In-memory rate limiting for authentication endpoints
- FastAPI dependencies for protected routes and current user retrieval
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import User, get_db

_raw_secret = os.environ.get("JWT_SECRET") or os.environ.get("SECRET_KEY")
if not _raw_secret:
    import logging as _logging
    _logging.getLogger("orchestrator").warning(
        "JWT_SECRET is not set. A random ephemeral secret is being used. "
        "Sessions will NOT persist across restarts. Set JWT_SECRET in production."
    )
    _raw_secret = secrets.token_hex(32)
JWT_SECRET = _raw_secret
TOKEN_EXPIRY_SECONDS = 7 * 24 * 3600  # 7 days


def is_secure_context() -> bool:
    """Detect whether the app is running in an HTTPS context (e.g., Render, Heroku)."""
    return os.environ.get("HTTPS", "").lower() in ("1", "true", "on") or \
           os.environ.get("RENDER", "") != "" or \
           os.environ.get("IS_HTTPS", "").lower() in ("1", "true", "on")

security_bearer = HTTPBearer(auto_error=False)

# In-memory rate limiting: {ip: [(timestamp, action), ...]}
RATE_LIMIT_BUCKETS: dict[str, list[float]] = {}
RATE_LIMIT_WINDOW = 60  # seconds
MAX_AUTH_ATTEMPTS = 15  # requests per window


def enforce_rate_limit(request: Request, max_attempts: int = MAX_AUTH_ATTEMPTS) -> None:
    """Enforce rate limits per client IP."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    now = time.time()
    
    attempts = RATE_LIMIT_BUCKETS.get(client_ip, [])
    # Filter attempts within window
    valid_attempts = [t for t in attempts if now - t < RATE_LIMIT_WINDOW]
    
    if len(valid_attempts) >= max_attempts:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many authentication attempts. Please try again in {RATE_LIMIT_WINDOW} seconds."
        )
        
    valid_attempts.append(now)
    RATE_LIMIT_BUCKETS[client_ip] = valid_attempts


def hash_password(password: str) -> str:
    """Hash password using PBKDF2-HMAC-SHA256 with 100,000 iterations and 16-byte salt."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100000
    )
    return f"pbkdf2_sha256$100000${salt}${key.hex()}"


def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hashed string using constant-time comparison."""
    try:
        algorithm, iterations_str, salt, expected_hash = hashed.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        iterations = int(iterations_str)
        key = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            iterations
        )
        return secrets.compare_digest(key.hex(), expected_hash)
    except Exception:
        return False


def validate_password_strength(password: str) -> Optional[str]:
    """Validate password has minimum length and complexity."""
    if len(password) < 8:
        return "Password must be at least 8 characters long."
    if not re.search(r"[A-Z]", password):
        return "Password must contain at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return "Password must contain at least one lowercase letter."
    if not re.search(r"\d", password):
        return "Password must contain at least one digit."
    return None


def normalize_email(email: str) -> str:
    """Normalize and validate email address."""
    email = (email or "").strip().lower()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise ValueError("Invalid email format.")
    return email


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (4 - (len(data) % 4)) if len(data) % 4 != 0 else ""
    return base64.urlsafe_b64decode((data + padding).encode("ascii"))


def create_access_token(user: User) -> str:
    """Generate a signed RFC 7519 HS256 JWT token."""
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    payload = {
        "sub": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "iat": now,
        "exp": now + TOKEN_EXPIRY_SECONDS,
    }
    
    header_enc = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_enc = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    
    signing_input = f"{header_enc}.{payload_enc}".encode("utf-8")
    signature = hmac.new(JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
    sig_enc = _b64url_encode(signature)
    
    return f"{header_enc}.{payload_enc}.{sig_enc}"


def decode_access_token(token: str) -> dict:
    """Decode and verify signed JWT token."""
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Malformed token format.")
        
    header_enc, payload_enc, sig_enc = parts
    signing_input = f"{header_enc}.{payload_enc}".encode("utf-8")
    expected_sig = hmac.new(JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
    
    actual_sig = _b64url_decode(sig_enc)
    if not secrets.compare_digest(expected_sig, actual_sig):
        raise ValueError("Invalid token signature.")
        
    payload = json.loads(_b64url_decode(payload_enc).decode("utf-8"))
    
    if payload.get("exp", 0) < int(time.time()):
        raise ValueError("Token has expired.")
        
    return payload


def get_token_from_request(request: Request, creds: Optional[HTTPAuthorizationCredentials] = None) -> Optional[str]:
    """Retrieve token from Authorization header or session cookie."""
    if creds and creds.credentials:
        return creds.credentials
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:].strip()
    # Fallback to cookie
    return request.cookies.get("cube_session")


def get_current_user(
    request: Request,
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db)
) -> User:
    """FastAPI dependency: require an authenticated user."""
    token = get_token_from_request(request, creds)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    try:
        payload = decode_access_token(token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication invalid: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with token no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    return user


def get_optional_user(
    request: Request,
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """FastAPI dependency: retrieve user if authenticated, else None."""
    token = get_token_from_request(request, creds)
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        return db.query(User).filter(User.id == user_id).first()
    except Exception:
        return None
