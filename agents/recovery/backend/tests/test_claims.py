from app.models.entities import Charge
from app.services.claims import ClaimCalculationService

def test_claim_calculation_contradicted_matches_charge_amount():
    charge = Charge(charge_id="C-1", amount=123.45, currency="USD", reason="Defect")
    amount = ClaimCalculationService.calculate_claim_amount(charge, "CONTRADICTED")
    assert amount == 123.45

def test_claim_calculation_supported_zero():
    charge = Charge(charge_id="C-2", amount=99.99, currency="USD", reason="Defect")
    amount = ClaimCalculationService.calculate_claim_amount(charge, "SUPPORTED")
    assert amount == 0.0

def test_claim_calculation_silent_zero():
    charge = Charge(charge_id="C-3", amount=50.00, currency="USD", reason="Defect")
    amount = ClaimCalculationService.calculate_claim_amount(charge, "SILENT")
    assert amount == 0.0

def test_claim_calculation_preserves_exact_amount():
    charge = Charge(charge_id="C-4", amount=38.00, currency="EUR", reason="Defect")
    amount = ClaimCalculationService.calculate_claim_amount(charge, "CONTRADICTED")
    assert amount == 38.00
    assert charge.currency == "EUR"
