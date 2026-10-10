"""FastAPI router for Authentication and User Profile management.

Endpoints:
- POST /auth/register
- POST /auth/login
- POST /auth/logout
- GET  /auth/me
- GET  /auth/history
"""
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .auth import (
    create_access_token,
    enforce_rate_limit,
    get_current_user,
    hash_password,
    is_secure_context,
    normalize_email,
    validate_password_strength,
    verify_password,
)
from .database import ExecutionRecord, User, get_db

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str
    confirm_password: Optional[str] = None
    name: Optional[str] = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    created_at: Optional[str] = None


class AuthSuccessResponse(BaseModel):
    token: str
    user: UserResponse
    message: str


@router.post("/register", response_model=AuthSuccessResponse)
def register(req: RegisterRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    """Register a new user account with secure password hashing."""
    enforce_rate_limit(request)

    # 1. Validate Email
    try:
        norm_email = normalize_email(req.email)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    # 2. Check for duplicate email
    existing = db.query(User).filter(User.email == norm_email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists."
        )

    # 3. Password Confirmation check
    if req.confirm_password is not None and req.password != req.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password and confirmation password do not match."
        )

    # 4. Password Strength check
    strength_err = validate_password_strength(req.password)
    if strength_err:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=strength_err)

    # 5. Create user with hashed password
    user = User(
        email=norm_email,
        password_hash=hash_password(req.password),
        name=(req.name or "").strip() or norm_email.split("@")[0].capitalize(),
        role="operator",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # 6. Generate JWT token
    token = create_access_token(user)

    # 7. Set secure session cookie (secure=True on HTTPS/production)
    response.set_cookie(
        key="cube_session",
        value=token,
        max_age=7 * 24 * 3600,
        httponly=True,
        samesite="lax",
        secure=is_secure_context(),
    )

    return AuthSuccessResponse(
        token=token,
        user=UserResponse(**user.to_dict()),
        message="Registration successful. Welcome to Cube Orchestrator!"
    )


@router.post("/login", response_model=AuthSuccessResponse)
def login(req: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    """Authenticate with email and password and issue a JWT session."""
    enforce_rate_limit(request)

    try:
        norm_email = normalize_email(req.email)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    user = db.query(User).filter(User.email == norm_email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    token = create_access_token(user)

    response.set_cookie(
        key="cube_session",
        value=token,
        max_age=7 * 24 * 3600,
        httponly=True,
        samesite="lax",
        secure=is_secure_context(),
    )

    return AuthSuccessResponse(
        token=token,
        user=UserResponse(**user.to_dict()),
        message="Login successful."
    )


@router.post("/logout")
def logout(response: Response):
    """Clear session cookie and invalidate active session client-side."""
    response.delete_cookie("cube_session")
    return {"status": "ok", "message": "Successfully logged out."}


@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    """Get authenticated user profile."""
    return UserResponse(**user.to_dict())


@router.get("/history")
def get_user_history(
    stage: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve private execution history for the authenticated user."""
    query = db.query(ExecutionRecord).filter(ExecutionRecord.user_id == user.id)
    if stage:
        query = query.filter(ExecutionRecord.stage == stage)
    records = query.order_by(ExecutionRecord.created_at.desc()).limit(50).all()
    return [r.to_dict() for r in records]
