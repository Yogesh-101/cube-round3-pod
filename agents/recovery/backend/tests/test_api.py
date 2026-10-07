def test_api_demo_seed_and_dashboard_summary(client):
    # Seed demo data
    res_seed = client.post("/api/demo/seed?run_assessments=true")
    assert res_seed.status_code == 200
    data = res_seed.json()
    assert data["status"] == "success"
    assert data["assessments_run"] > 0

    # Dashboard summary
    res_dash = client.get("/api/dashboard/summary")
    assert res_dash.status_code == 200
    dash_data = res_dash.json()
    assert dash_data["total_charges"] > 0
    assert dash_data["total_charge_amount"] > 0
    assert dash_data["supported_count"] >= 1
    assert dash_data["contradicted_count"] >= 1
    assert dash_data["silent_count"] >= 1
    assert dash_data["potential_claim_amount"] > 0

def test_api_charges_listing_and_filtering(client, seeded_db):
    # List all charges
    res = client.get("/api/charges")
    assert res.status_code == 200
    charges = res.json()
    assert len(charges) >= 8

    # Filter by verdict: CONTRADICTED
    res_cont = client.get("/api/charges?verdict=CONTRADICTED")
    assert res_cont.status_code == 200
    for c in res_cont.json():
        assert c["assessment"]["verdict"] == "CONTRADICTED"

    # Filter by verdict: SUPPORTED
    res_supp = client.get("/api/charges?verdict=SUPPORTED")
    assert res_supp.status_code == 200
    for c in res_supp.json():
        assert c["assessment"]["verdict"] == "SUPPORTED"

    # Filter by verdict: SILENT
    res_sil = client.get("/api/charges?verdict=SILENT")
    assert res_sil.status_code == 200
    for c in res_sil.json():
        assert c["assessment"]["verdict"] == "SILENT"

def test_api_charge_detail_and_traceable_evidence(client, seeded_db):
    # Contradicted case: CHG-002-CONT
    res = client.get("/api/charges/CHG-002-CONT")
    assert res.status_code == 200
    charge = res.json()
    assert charge["charge_id"] == "CHG-002-CONT"
    assert charge["assessment"]["verdict"] == "CONTRADICTED"
    assert charge["assessment"]["claim_amount"] == 38.0
    assert charge["resolution"]["resolution_status"] == "RESOLVED"
    assert len(charge["relevant_evidence"]) >= 1

    # Evidence traceability endpoint
    res_ev = client.get("/api/charges/CHG-002-CONT/evidence")
    assert res_ev.status_code == 200
    ev_data = res_ev.json()
    assert ev_data["charge_id"] == "CHG-002-CONT"
    assert ev_data["relevant_count"] >= 1
    ev_record = ev_data["relevant_evidence"][0]
    assert ev_record["evidence_id"] == "EV-102-PASS"
    assert ev_record["result"] == "PASS"
    assert ev_record["source"] == "WMS-PrepStation-2"
    assert "timestamp" in ev_record

def test_api_assess_single_charge(client, seeded_db):
    # Re-assess charge
    res = client.post("/api/charges/CHG-001-SUPP/assess")
    assert res.status_code == 200
    data = res.json()
    assert data["charge_id"] == "CHG-001-SUPP"
    assert data["verdict"] == "SUPPORTED"
    assert data["claim_amount"] == 0.0

def test_api_ingest_json_endpoint(client):
    payload = {
        "charges": [
            {
                "charge_id": "CHG-API-NEW",
                "reason": "Missing barcode fee",
                "amount": 42.0,
                "currency": "USD"
            }
        ]
    }
    res = client.post("/api/ingest", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["charges_ingested"] == 1

    # Verify charge was saved
    res_get = client.get("/api/charges/CHG-API-NEW")
    assert res_get.status_code == 200
    assert res_get.json()["amount"] == 42.0
