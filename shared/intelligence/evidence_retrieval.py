"""Evidence Retrieval.

Implements entity-first deterministic evidence filtering before passing to the AI.
"""
from __future__ import annotations

from typing import Any

from .schemas import EvidenceRequirement
from .evidence_health import get_requirement


def retrieve_relevant_evidence(
    charge: dict,
    subject_id: str,
    org_id: str,
    evidence_records: list[dict],
) -> list[dict]:
    """Retrieve the most relevant evidence records for a specific charge.
    
    Prioritizes:
    1. Exact entity matches (org_id, subject_id)
    2. Evidence from required stages for this charge type
    3. Latest completed evidence per stage
    """
    # 1. Base filtering by entity (Tenancy + Subject)
    entity_filtered = [
        r for r in evidence_records
        if r.get("subject", {}).get("org_id") == org_id
        and r.get("subject", {}).get("subject_id") == subject_id
    ]
    
    # 2. Get evidence requirements
    charge_type = charge.get("charge_type", "unknown")
    requirement = get_requirement(charge_type)
    
    # 3. Select relevant records
    # If the charge explicitly requires certain stages, prioritize those
    required_stages = set(requirement.required_stages)
    
    relevant_records = []
    
    # Keep only the latest completed record per stage, and prefer required stages
    latest_per_stage = {}
    for r in entity_filtered:
        if r.get("status") == "completed":
            stage = r.get("stage")
            latest_per_stage[stage] = r
            
    # Include required stages if available
    for stage in required_stages:
        if stage in latest_per_stage:
            relevant_records.append(latest_per_stage[stage])
            
    # Include other stages if there's no specific requirement, or if they have explicit references
    # For a robust investigation, we typically want to see all available evidence for the subject
    # but for LLM context window optimization, we might restrict this later.
    for stage, record in latest_per_stage.items():
        if stage not in required_stages and record not in relevant_records:
            relevant_records.append(record)
            
    return relevant_records
