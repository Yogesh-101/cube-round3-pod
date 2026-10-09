"""Deterministic Evidence Health & Gap Detection.

For every charge, determines:
- expected evidence (based on charge_type → required stages/checks)
- available evidence (from upstream evidence chain)
- missing evidence
- conflicting evidence
- sufficiency status
- coverage ratio

Evidence requirements derive from the official contract and charge type semantics.
No AI is used here — this is fully deterministic.
"""
from __future__ import annotations

from .schemas import (
    EvidenceGap,
    EvidenceHealthResult,
    EvidenceRequirement,
)

# ---------------------------------------------------------------- Evidence requirements per charge type
# Derived from EVIDENCE-CONTRACT.md section 8 and recovery agent semantics.
# charge_type → what upstream evidence is needed to assess it.
CHARGE_EVIDENCE_REQUIREMENTS: dict[str, EvidenceRequirement] = {
    "inbound_defect_fee": EvidenceRequirement(
        charge_type="inbound_defect_fee",
        required_stages=["prep"],
        required_check_keys=[],
        description="Needs Prep evidence to verify/contradict the defect claim",
    ),
    "fulfilment_fee_weight_tier": EvidenceRequirement(
        charge_type="fulfilment_fee_weight_tier",
        required_stages=["prep"],
        required_check_keys=[],  # Needs measurements from prep (finding F-07)
        description="Needs measured weight/dimensions from Prep to verify tier",
    ),
    "refund_issued_item_not_returned": EvidenceRequirement(
        charge_type="refund_issued_item_not_returned",
        required_stages=["returns"],
        required_check_keys=["identity_match", "completeness"],
        description="Needs Returns evidence showing item was/wasn't returned",
    ),
    "lost_inbound": EvidenceRequirement(
        charge_type="lost_inbound",
        required_stages=["receiving"],
        required_check_keys=["quantity", "carton_count"],
        description="Needs Receiving evidence for inbound quantity verification (finding F-10: supplier-side, not channel-side)",
    ),
}

# Default requirement for unknown charge types
DEFAULT_REQUIREMENT = EvidenceRequirement(
    charge_type="unknown",
    required_stages=["receiving"],
    required_check_keys=[],
    description="No specific evidence requirement defined for this charge type",
)


def get_requirement(charge_type: str) -> EvidenceRequirement:
    """Get the evidence requirement for a charge type."""
    return CHARGE_EVIDENCE_REQUIREMENTS.get(charge_type, DEFAULT_REQUIREMENT)


def _find_evidence_for_stage(stage: str, evidence_records: list[dict]) -> dict | None:
    """Find the latest completed evidence record for a stage."""
    candidates = [r for r in evidence_records if r.get("stage") == stage and r.get("status") == "completed"]
    return candidates[-1] if candidates else None


def _find_evidence_for_stage_any(stage: str, evidence_records: list[dict]) -> dict | None:
    """Find any evidence record for a stage (including pending/error)."""
    candidates = [r for r in evidence_records if r.get("stage") == stage]
    return candidates[-1] if candidates else None


def _check_key_available(record: dict, check_key: str) -> bool:
    """Check if a specific check_key exists in a record's checks."""
    return any(c.get("check_key") == check_key for c in record.get("checks", []))


def _check_key_conflicting(record: dict, check_key: str) -> bool:
    """Check if a specific check_key has UNCERTAIN verdict (potential conflict)."""
    for c in record.get("checks", []):
        if c.get("check_key") == check_key and c.get("verdict") == "UNCERTAIN":
            return True
    return False


def assess_charge_evidence_health(
    charge_id: str,
    charge_type: str,
    evidence_records: list[dict],
) -> EvidenceHealthResult:
    """Assess evidence health for a single charge.

    Returns a deterministic assessment of evidence sufficiency.
    """
    req = get_requirement(charge_type)

    expected = []
    available = []
    missing = []
    conflicting = []

    # Check required stages
    for stage in req.required_stages:
        stage_label = f"{stage}_evidence"
        expected.append(stage_label)

        record = _find_evidence_for_stage(stage, evidence_records)
        if record:
            available.append(stage_label)

            # Check for conflicting evidence (UNCERTAIN verdicts)
            if record.get("decision", {}).get("verdict") == "UNCERTAIN":
                conflicting.append(f"{stage}_verdict_uncertain")

            # Check required check keys
            for ck in req.required_check_keys:
                ck_label = f"{stage}.{ck}"
                expected.append(ck_label)
                if _check_key_available(record, ck):
                    available.append(ck_label)
                    if _check_key_conflicting(record, ck):
                        conflicting.append(ck_label)
                else:
                    missing.append(ck_label)
        else:
            missing.append(stage_label)
            # All check keys from this stage are also missing
            for ck in req.required_check_keys:
                ck_label = f"{stage}.{ck}"
                expected.append(ck_label)
                missing.append(ck_label)

    # Calculate coverage
    coverage = len(available) / len(expected) if expected else 0.0

    # Determine status
    if conflicting:
        status = "CONFLICTING"
        details = f"Conflicting evidence found: {', '.join(conflicting)}"
    elif missing:
        status = "INSUFFICIENT"
        details = f"Missing evidence: {', '.join(missing)}"
    else:
        status = "SUFFICIENT"
        details = "All required evidence available"

    return EvidenceHealthResult(
        charge_id=charge_id,
        charge_type=charge_type,
        status=status,
        expected_evidence=expected,
        available_evidence=available,
        missing_evidence=missing,
        conflicting_evidence=conflicting,
        coverage_ratio=round(coverage, 3),
        details=details,
    )


def assess_workflow_evidence_health(
    charges: list[dict],
    evidence_records: list[dict],
) -> list[EvidenceHealthResult]:
    """Assess evidence health for all charges in a workflow."""
    results = []
    for charge in charges:
        result = assess_charge_evidence_health(
            charge_id=charge.get("line_id", ""),
            charge_type=charge.get("charge_type", "unknown"),
            evidence_records=evidence_records,
        )
        results.append(result)
    return results


def detect_evidence_gaps(
    charges: list[dict],
    evidence_records: list[dict],
    subject_id: str = "",
    workflow_id: str = "",
) -> list[EvidenceGap]:
    """Detect evidence gaps and create structured gap requests.

    Returns a list of EvidenceGap objects identifying what's missing
    and which upstream agent is responsible.
    """
    gaps = []
    for charge in charges:
        health = assess_charge_evidence_health(
            charge_id=charge.get("line_id", ""),
            charge_type=charge.get("charge_type", "unknown"),
            evidence_records=evidence_records,
        )
        if health.status in ("INSUFFICIENT", "CONFLICTING"):
            req = get_requirement(charge.get("charge_type", "unknown"))
            for stage in req.required_stages:
                record = _find_evidence_for_stage(stage, evidence_records)
                if not record:
                    # Missing stage entirely
                    gap = EvidenceGap(
                        charge_id=charge.get("line_id", ""),
                        subject_id=subject_id,
                        order_id=charge.get("order_id", ""),
                        shipment_id=charge.get("fba_shipment_id", ""),
                        sku=charge.get("sku", ""),
                        missing_stage=stage,
                        missing_check_keys=req.required_check_keys,
                        responsible_agent=stage,
                        status="OPEN",
                        correlation_id=f"{workflow_id}:{charge.get('line_id', '')}",
                    )
                    gaps.append(gap)
                else:
                    # Stage exists but missing specific check keys
                    missing_keys = [
                        ck for ck in req.required_check_keys
                        if not _check_key_available(record, ck)
                    ]
                    if missing_keys:
                        gap = EvidenceGap(
                            charge_id=charge.get("line_id", ""),
                            subject_id=subject_id,
                            order_id=charge.get("order_id", ""),
                            shipment_id=charge.get("fba_shipment_id", ""),
                            sku=charge.get("sku", ""),
                            missing_stage=stage,
                            missing_check_keys=missing_keys,
                            responsible_agent=stage,
                            status="OPEN",
                            correlation_id=f"{workflow_id}:{charge.get('line_id', '')}",
                        )
                        gaps.append(gap)
    return gaps


def overall_evidence_health_status(health_results: list[EvidenceHealthResult]) -> str:
    """Aggregate status across all charges."""
    if not health_results:
        return "UNKNOWN"
    statuses = {r.status for r in health_results}
    if "CONFLICTING" in statuses:
        return "CONFLICTING"
    if "INSUFFICIENT" in statuses:
        return "INSUFFICIENT"
    return "SUFFICIENT"
