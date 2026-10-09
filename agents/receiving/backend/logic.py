from shared.utils.records import check
from .schemas import ReceivingInput, ReceivingDecision

DAMAGE_OK = {"none"}
DAMAGE_BAD = {"crushing", "water", "tears"}

def verdict_from(val: str, ok_set: set, bad_set: set) -> str:
    val = str(val).lower()
    if val in ok_set:
        return "PASS"
    if val in bad_set:
        return "FAIL"
    return "UNCERTAIN"

def process_receiving(data: ReceivingInput) -> ReceivingDecision:
    refs = data.photo_refs
    
    checks = [
        check("identity_match", verdict_from(data.identity_match, {"yes"}, {"no"}), None,
              expected=f"{data.sku} ({data.product_title})", observed=data.identity_match,
              evidence_refs=refs, uncertain_reason="poor_image"),
        check("carton_count", "PASS" if data.cartons_ordered == data.cartons_received else "FAIL", None, 
              expected=data.cartons_ordered, observed=data.cartons_received, evidence_refs=refs),
        check("quantity", "PASS" if data.qty_ordered == data.qty_received else "FAIL", None, 
              expected=data.qty_ordered, observed=data.qty_received, evidence_refs=refs),
        check("carton_damage", verdict_from(data.carton_damage, DAMAGE_OK, DAMAGE_BAD), None,
              expected="none", observed=data.carton_damage, evidence_refs=refs, uncertain_reason="poor_image"),
        check("unit_damage", verdict_from(data.unit_damage, DAMAGE_OK, DAMAGE_BAD), None,
              expected="none", observed=data.unit_damage, evidence_refs=refs, uncertain_reason="poor_image"),
        check("quality_flags", "FAIL" if data.quality_flags else "PASS", None, 
              expected=[], observed=data.quality_flags, evidence_refs=refs),
    ]
    
    verdict = "FAIL" if any(c["verdict"] == "FAIL" for c in checks) else (
        "UNCERTAIN" if any(c["verdict"] == "UNCERTAIN" for c in checks) else "PASS")
    outcome = {"PASS": "accept", "FAIL": "accept_with_exceptions", "UNCERTAIN": "pending_review"}[verdict]
    
    return ReceivingDecision(
        verdict=verdict,
        outcome=outcome,
        checks=checks
    )
