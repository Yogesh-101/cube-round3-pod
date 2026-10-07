from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator, ConfigDict
from typing import Optional, Any
from datetime import datetime

class UserRegisterRequest(BaseModel):
    full_name: Optional[str] = Field(None, description="User full name")
    name: Optional[str] = Field(None, description="User full name alias")
    email: str = Field(..., description="User email address")
    password: str = Field(..., min_length=6, description="Password (min 6 characters)")
    confirm_password: str = Field(..., description="Password confirmation")

    @model_validator(mode="before")
    @classmethod
    def populate_name(cls, data: Any) -> Any:
        if isinstance(data, dict):
            name_val = (data.get("name") or data.get("full_name") or "").strip()
            if not name_val or len(name_val) < 2:
                raise ValueError("Name is required and must be at least 2 characters")
            data["full_name"] = name_val
            data["name"] = name_val
        return data

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if "@" not in clean or "." not in clean.split("@")[-1]:
            raise ValueError("Invalid email format")
        return clean

    @field_validator("confirm_password")
    @classmethod
    def validate_match(cls, v: str, info) -> str:
        password = info.data.get("password")
        if password and v != password:
            raise ValueError("Passwords do not match")
        return v

class UserLoginRequest(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(..., description="User password")

    @field_validator("email")
    @classmethod
    def clean_email(cls, v: str) -> str:
        return v.strip().lower()

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    name: Optional[str] = None
    created_at: datetime

    @model_validator(mode="after")
    def set_name_alias(self):
        if not self.name and self.full_name:
            self.name = self.full_name
        return self

class AuthResponse(BaseModel):
    token: str
    user: UserResponse
