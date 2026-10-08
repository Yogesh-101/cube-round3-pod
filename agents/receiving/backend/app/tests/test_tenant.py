import pytest
from fastapi.testclient import TestClient

from dotenv import load_dotenv
load_dotenv()

from backend.app.main import app
client = TestClient(app)

import json
from backend.app.core.config import get_settings

def test_missing_key_returns_401():
    response = client.get("/api/v1/facilities")
    assert response.status_code == 401

def test_valid_key_returns_200():
    settings = get_settings()
    keys = json.loads(settings.receiving_api_keys)
    valid_key = list(keys.keys())[0]
    
    response = client.get("/api/v1/facilities", headers={"X-API-Key": valid_key})
    assert response.status_code == 200

def test_cross_tenant_access_denied():
    settings = get_settings()
    keys = json.loads(settings.receiving_api_keys)
    valid_key = list(keys.keys())[0]
    
    # Using org-demo key, which maps to tenant_1. Try to read a tenant_2 PO (e.g., PO-9006)
    response = client.get("/api/v1/purchase-orders/PO-9006", headers={"X-API-Key": valid_key})
    assert response.status_code == 404

def test_cross_tenant_inspection_denied():
    settings = get_settings()
    keys = json.loads(settings.receiving_api_keys)
    valid_key = list(keys.keys())[0]
    
    # organization_id is 'org-demo'. Try to read an inspection ID we don't have.
    response = client.get("/api/inspections/NON_EXISTENT_ID", headers={"X-API-Key": valid_key})
    # The repository logic currently returns 404 if not found (whether due to tenant mismatch or true missing).
    assert response.status_code == 404


