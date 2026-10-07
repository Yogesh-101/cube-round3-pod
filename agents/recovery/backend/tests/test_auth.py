import pytest
from app.services.auth import hash_password, verify_password, AuthService
from app.schemas.auth import UserRegisterRequest

def test_password_hashing_and_verification():
    raw = "SecureSecret123"
    hashed = hash_password(raw)
    assert hashed != raw
    assert "$" in hashed
    assert verify_password(raw, hashed) is True
    assert verify_password("WrongPassword", hashed) is False

def test_auth_registration_and_login_flow(client):
    # 1. Register valid user
    reg_payload = {
        "full_name": "Jane Logistics",
        "email": "jane@example.com",
        "password": "Password123!",
        "confirm_password": "Password123!"
    }
    res_reg = client.post("/api/auth/register", json=reg_payload)
    assert res_reg.status_code == 201
    data_reg = res_reg.json()
    assert "token" in data_reg
    assert data_reg["user"]["email"] == "jane@example.com"
    token = data_reg["token"]

    # 2. Get current user profile
    res_me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res_me.status_code == 200
    assert res_me.json()["email"] == "jane@example.com"

    # 3. Login with credentials
    login_payload = {
        "email": "jane@example.com",
        "password": "Password123!"
    }
    res_login = client.post("/api/auth/login", json=login_payload)
    assert res_login.status_code == 200
    data_login = res_login.json()
    assert "token" in data_login
    new_token = data_login["token"]

    # 4. Logout
    res_logout = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {new_token}"})
    assert res_logout.status_code == 200

    # 5. Token is now invalid
    res_me_after = client.get("/api/auth/me", headers={"Authorization": f"Bearer {new_token}"})
    assert res_me_after.status_code == 401

def test_registration_validation_errors(client):
    # Password mismatch
    res_mismatch = client.post("/api/auth/register", json={
        "full_name": "Test User",
        "email": "test@example.com",
        "password": "Password123",
        "confirm_password": "DifferentPassword"
    })
    assert res_mismatch.status_code == 422

    # Password too short
    res_short = client.post("/api/auth/register", json={
        "full_name": "Test User",
        "email": "test@example.com",
        "password": "123",
        "confirm_password": "123"
    })
    assert res_short.status_code == 422

    # Invalid email format
    res_email = client.post("/api/auth/register", json={
        "full_name": "Test User",
        "email": "invalid-email-no-at",
        "password": "Password123",
        "confirm_password": "Password123"
    })
    assert res_email.status_code == 422

def test_duplicate_email_registration_fails(client):
    payload = {
        "full_name": "User One",
        "email": "duplicate@example.com",
        "password": "Password123!",
        "confirm_password": "Password123!"
    }
    res1 = client.post("/api/auth/register", json=payload)
    assert res1.status_code == 201

    res2 = client.post("/api/auth/register", json=payload)
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"]

def test_login_invalid_credentials_fails(client):
    res = client.post("/api/auth/login", json={
        "email": "nonexistent@example.com",
        "password": "WrongPassword"
    })
    assert res.status_code == 401
    assert "Invalid email or password" in res.json()["detail"]

def test_auth_me_unauthorized_without_token(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401

def test_registration_with_name_field(client):
    payload = {
        "name": "Sarah Conner",
        "email": "sarah@example.com",
        "password": "Password123!",
        "confirm_password": "Password123!"
    }
    res = client.post("/api/auth/register", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["user"]["full_name"] == "Sarah Conner"
    assert data["user"]["name"] == "Sarah Conner"

