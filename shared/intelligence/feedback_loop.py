"""Closed-Loop Evidence Feedback.

Takes identified evidence gaps and creates structured requests that could be routed
back to upstream agents (simulated in this phase).
"""
from __future__ import annotations

from .schemas import EvidenceGap
from shared.utils.log import get_logger

logger = get_logger("feedback_loop")


def route_evidence_request(gap: EvidenceGap) -> bool:
    """Route a gap request back to the responsible agent.
    
    In a fully operational environment, this would hit the agent's API
    asking for a re-eval or missing data extraction.
    For this phase, we just log it and simulate "requested" state.
    """
    logger.info(
        "evidence_gap_routed",
        extra={
            "ctx": {
                "gap_id": gap.gap_id,
                "charge_id": gap.charge_id,
                "target_agent": gap.responsible_agent,
                "missing_keys": gap.missing_check_keys,
            }
        }
    )
    
    gap.status = "REQUESTED"
    return True
