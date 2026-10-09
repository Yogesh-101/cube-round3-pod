from shared.utils.records import check
from .schemas import PrepInput, PrepDecision

RULES = [
    ("polybag_sealed", "polybag_present_sealed", {"yes"}, {"not_sealed", "missing"}),
    ("suffocation_warning", "suffocation_warning", {"legible"}, {"obscured_by_fold", "missing"}),
    ("fnsku_label_placement", "fnsku_label_placement", {"flat"}, {"on_seam", "on_curve", "on_edge", "missing"}),
    ("original_barcode_covered", "original_barcode_covered", {"yes"}, {"no"}),
    ("expiry_legible", "expiry_date", {"legible"}, {"illegible_after_wrap"}),
    ("handling_marks", "handling_marks", {"all_present"}, {"some_missing"}),
]

def verdict_from(val: str, ok_set: set, bad_set: set) -> str:
    val = str(val).lower()
    if val in ok_set:
        return "PASS"
    if val in bad_set:
        return "FAIL"
    return "UNCERTAIN"

def process_prep(data: PrepInput) -> PrepDecision:
    refs = data.photo_refs
    checks = []
    
    for key, attr_name, ok, bad in RULES:
        val = getattr(data, attr_name)
        if val != "not_required":
            checks.append(
                check(key, verdict_from(val, ok, bad), None, expected=sorted(ok)[0], observed=val,
                      evidence_refs=refs, uncertain_reason="poor_image")
            )
            
    verdict = "FAIL" if any(c["verdict"] == "FAIL" for c in checks) else (
        "UNCERTAIN" if any(c["verdict"] == "UNCERTAIN" for c in checks) or not checks else "PASS")
    outcome = {"PASS": "compliant", "FAIL": "non_compliant", "UNCERTAIN": "pending_review"}[verdict]
    
    return PrepDecision(
        verdict=verdict,
        outcome=outcome,
        checks=checks
    )
