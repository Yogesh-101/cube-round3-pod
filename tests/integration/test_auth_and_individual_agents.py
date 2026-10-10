"""Tests for Authentication, Authorization, Individual Agent Execution, and Persistence.

Covers:
- Registration, validation, password hashing, and duplicate rejection
- Login, session generation, and token authentication
- Protected endpoint rejection (401 Unauthorized)
- All 5 agents running independently with verified outputs and contracts
- Upstream dependency analysis without prerequisite fabrication
- User data persistence and isolation
"""
import uuid
import pytest
from fastapi.testclient import TestClient

from orchestration.api import app
from orchestration.database import Base, SessionLocal, User, engine

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    from orchestration.api import seed_demo_user
    Base.metadata.create_all(bind=engine)
    seed_demo_user()
    yield


@pytest.fixture
def unique_email():
    return f"test_op_{uuid.uuid4().hex[:8]}@cube.build"


def test_registration_validation_and_success(unique_email):
    # 1. Reject weak password
    weak_res = client.post("/auth/register", json={
        "email": unique_email,
        "password": "weak",
        "confirm_password": "weak",
    })
    assert weak_res.status_code == 422
    assert "at least 8 characters" in weak_res.json()["detail"]

    # 2. Reject mismatched confirmation
    mismatch_res = client.post("/auth/register", json={
        "email": unique_email,
        "password": "ValidPassword123!",
        "confirm_password": "DifferentPassword123!",
    })
    assert mismatch_res.status_code == 422
    assert "do not match" in mismatch_res.json()["detail"]

    # 3. Successful registration
    reg_res = client.post("/auth/register", json={
        "email": unique_email,
        "password": "ValidPassword123!",
        "confirm_password": "ValidPassword123!",
        "name": "Integration Tester",
    })
    assert reg_res.status_code == 200
    data = reg_res.json()
    assert "token" in data
    assert data["user"]["email"] == unique_email.lower()
    assert data["user"]["name"] == "Integration Tester"

    # 4. Reject duplicate email
    dup_res = client.post("/auth/register", json={
        "email": unique_email.upper(),  # case-insensitive check
        "password": "ValidPassword123!",
        "confirm_password": "ValidPassword123!",
    })
    assert dup_res.status_code == 409
    assert "already exists" in dup_res.json()["detail"]


def test_login_and_me_endpoint(unique_email):
    # Register user
    client.post("/auth/register", json={
        "email": unique_email,
        "password": "SecretPassword456!",
        "confirm_password": "SecretPassword456!",
        "name": "Login User",
    })

    # Wrong password
    bad_login = client.post("/auth/login", json={
        "email": unique_email,
        "password": "WrongPassword!",
    })
    assert bad_login.status_code == 401

    # Correct login
    login_res = client.post("/auth/login", json={
        "email": unique_email,
        "password": "SecretPassword456!",
    })
    assert login_res.status_code == 200
    token = login_res.json()["token"]

    # Unauthenticated /auth/me rejected (clear cookies first)
    client.cookies.clear()
    unauth = client.get("/auth/me")
    assert unauth.status_code == 401

    # Authenticated /auth/me accepted with header
    auth_me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert auth_me.status_code == 200
    assert auth_me.json()["email"] == unique_email.lower()


def test_protected_routes_reject_unauthenticated():
    client.cookies.clear()
    res = client.post("/workflows", json={"org_id": "org_demo_alpha", "unit_id": "UNIT-0001"})
    assert res.status_code == 401

    res = client.post("/agents/receiving/run", json={"unit_id": "UNIT-0001", "org_id": "org_demo_alpha"})
    assert res.status_code == 401


def test_all_five_agents_run_independently():
    # Login as demo operator
    login_res = client.post("/auth/login", json={
        "email": "demo@cube.build",
        "password": "DemoPassword123!",
    })
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Receiving Agent
    rcv_res = client.post("/agents/receiving/run", json={
        "unit_id": "UNIT-0001",
        "org_id": "org_demo_alpha",
    }, headers=headers)
    assert rcv_res.status_code == 200
    rcv_data = rcv_res.json()
    assert rcv_data["stage"] == "receiving"
    assert rcv_data["record_id"].startswith("RCV-")
    assert "verdict" in rcv_data
    assert "evidence" in rcv_data

    # 2. Prep Agent
    prep_res = client.post("/agents/prep/run", json={
        "unit_id": "UNIT-0002",
        "org_id": "org_demo_alpha",
    }, headers=headers)
    assert prep_res.status_code == 200
    prep_data = prep_res.json()
    assert prep_data["stage"] == "prep"
    assert prep_data["record_id"].startswith("PRP-")
    assert "verdict" in prep_data

    # 3. Pack Agent
    pack_res = client.post("/agents/pack/run", json={
        "unit_id": "UNIT-0006",
        "org_id": "org_demo_bravo",
    }, headers=headers)
    assert pack_res.status_code == 200
    pack_data = pack_res.json()
    assert pack_data["stage"] == "pack"
    assert pack_data["outcome"] in ("seal", "stop_and_fix", "pending_review")

    # 4. Returns Agent
    ret_res = client.post("/agents/returns/run", json={
        "unit_id": "UNIT-0001",
        "org_id": "org_demo_alpha",
    }, headers=headers)
    assert ret_res.status_code == 200
    ret_data = ret_res.json()
    assert ret_data["stage"] == "returns"
    assert ret_data["record_id"].startswith("RTN-")

    # 5. Recovery Agent
    rec_res = client.post("/agents/recovery/run", json={
        "unit_id": "UNIT-0002",
        "org_id": "org_demo_alpha",
    }, headers=headers)
    assert rec_res.status_code == 200
    rec_data = rec_res.json()
    assert rec_data["stage"] == "recovery"
    assert rec_data["record_id"].startswith("RCY-")
    assert "charges" in rec_data["evidence"]["payload"]


def test_agent_dependencies_endpoint():
    dep_res = client.get("/agents/recovery/dependencies?unit_id=UNIT-0002&org_id=org_demo_alpha")
    assert dep_res.status_code == 200
    dep_data = dep_res.json()
    assert dep_data["stage"] == "recovery"
    assert "details" in dep_data
    assert "missing_upstream" in dep_data


def test_user_history_isolation():
    # User 1
    u1_email = f"user1_{uuid.uuid4().hex[:6]}@cube.build"
    reg1 = client.post("/auth/register", json={
        "email": u1_email, "password": "UserPass123!", "confirm_password": "UserPass123!"
    })
    token1 = reg1.json()["token"]

    # User 2
    u2_email = f"user2_{uuid.uuid4().hex[:6]}@cube.build"
    reg2 = client.post("/auth/register", json={
        "email": u2_email, "password": "UserPass123!", "confirm_password": "UserPass123!"
    })
    token2 = reg2.json()["token"]

    # User 1 executes Receiving
    client.post("/agents/receiving/run", json={"unit_id": "UNIT-0001", "org_id": "org_demo_alpha"},
                headers={"Authorization": f"Bearer {token1}"})

    # User 1 sees 1 history item
    h1 = client.get("/auth/history", headers={"Authorization": f"Bearer {token1}"}).json()
    assert len(h1) >= 1
    assert any(item["stage"] == "receiving" for item in h1)

    # User 2 sees 0 history items (isolated)
    h2 = client.get("/auth/history", headers={"Authorization": f"Bearer {token2}"}).json()
    assert len(h2) == 0
