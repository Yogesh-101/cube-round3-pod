from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.schemas.auth import UserRegisterRequest, UserLoginRequest, UserResponse, AuthResponse
from app.services.auth import AuthService
from app.models.entities import User

router = APIRouter(prefix="/auth", tags=["Authentication"])

def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token"
        )
    token = authorization.split("Bearer ")[-1].strip()
    user = AuthService.get_user_by_token(db, token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token"
        )
    return user

@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(req: UserRegisterRequest, db: Session = Depends(get_db)):
    try:
        user = AuthService.register_user(db, req)
        token = AuthService.create_session(db, user)
        return AuthResponse(token=token, user=UserResponse.model_validate(user))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Registration failed: {str(e)}")

@router.post("/login", response_model=AuthResponse)
def login(req: UserLoginRequest, db: Session = Depends(get_db)):
    user = AuthService.authenticate_user(db, req.email, req.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    token = AuthService.create_session(db, user)
    return AuthResponse(token=token, user=UserResponse.model_validate(user))

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)

@router.post("/logout")
def logout(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ")[-1].strip()
        AuthService.invalidate_session(db, token)
    return {"message": "Logged out successfully"}
