import urllib.request
import urllib.error
import json
import time

BASE_URL = "https://cube-orchestrator-api.onrender.com"

def post_json(endpoint, payload, token=None):
    data = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{BASE_URL}{endpoint}", data=data, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

def get_json(endpoint, token=None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{BASE_URL}{endpoint}", headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

def run_checks():
    print("=== LIVE PROD VERIFICATION SUITE ===")

    # 1. Duplicate email rejection
    status, body = post_json("/auth/register", {"email": "demo@cube.build", "password": "StrongPassword123!"})
    print(f"1. Duplicate Email Check: Status={status}, Detail={body.get('detail')}")
    assert status == 409

    # 2. Weak password rejection
    status, body = post_json("/auth/register", {"email": f"weak_{int(time.time())}@cube.build", "password": "123"})
    print(f"2. Weak Password Check: Status={status}, Detail={body.get('detail')}")
    assert status == 422

    # 3. Invalid credentials rejection
    status, body = post_json("/auth/login", {"email": "demo@cube.build", "password": "WrongPassword!"})
    print(f"3. Invalid Credentials Check: Status={status}, Detail={body.get('detail')}")
    assert status == 401

    # 4. Valid login
    status, body = post_json("/auth/login", {"email": "demo@cube.build", "password": "DemoPassword123!"})
    print(f"4. Valid Login Check: Status={status}, User={body.get('user', {}).get('email')}")
    assert status == 200
    token = body["token"]

    # 5. Unauthorized endpoint access
    status, body = get_json("/auth/me")
    print(f"5. Unauthorized Access Check: Status={status}, Detail={body.get('detail')}")
    assert status == 401

    # 6. Authorized /auth/me
    status, body = get_json("/auth/me", token=token)
    print(f"6. Authorized Profile Check: Status={status}, Email={body.get('email')}")
    assert status == 200

    # 7. Agent dependency check
    status, body = get_json("/agents/prep/dependencies?unit_id=UNIT-0002", token=token)
    print(f"7. Agent Dependencies Check (Prep UNIT-0002): Status={status}, Ready={body.get('ready')}")
    assert status == 200

    # 8. All 5 Agents execution independently
    agent_units = [
        ("receiving", "UNIT-0001", "org_demo_alpha"),
        ("prep", "UNIT-0002", "org_demo_alpha"),
        ("pack", "UNIT-0006", "org_demo_bravo"),
        ("returns", "UNIT-0014", "org_demo_alpha"),
        ("recovery", "UNIT-0002", "org_demo_alpha"),
    ]
    for stage, unit_id, org_id in agent_units:
        status, body = post_json(f"/agents/{stage}/run", {"unit_id": unit_id, "org_id": org_id}, token=token)
        print(f"8. Independent Agent Run [{stage.upper()} for {unit_id}]: Status={status}, RecordID={body.get('record_id')}, Verdict={body.get('verdict')}")
        assert status == 200
        assert body.get("verdict") in ("PASS", "FAIL", "UNCERTAIN")

    # 9. Full Orchestrator execution
    status, body = post_json("/workflows", {"org_id": "org_demo_alpha", "unit_id": "UNIT-0001"}, token=token)
    print(f"9. Full Workflow Run [UNIT-0001]: Status={status}, WorkflowID={body.get('workflow_id')}, Status={body.get('status')}")
    assert status == 200
    assert body.get("workflow_id") is not None

    print("\nALL LIVE CHECKS PASSED PERFECTLY!")

if __name__ == "__main__":
    run_checks()
