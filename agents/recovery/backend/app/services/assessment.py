import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.entities import Charge, Assessment, Evidence
from app.schemas.entities import AssessChargeResponse
from app.services.resolution import EntityResolutionService
from app.services.evidence import EvidenceRetrievalService
from app.services.claims import ClaimCalculationService

# Result classification
FAVORABLE_RESULTS = {"PASS", "VERIFIED", "INTACT", "COMPLIANT", "MATCH", "CONFIRMED"}
DEFECT_RESULTS = {"FAIL", "FAILED", "DAMAGED", "DISCREPANCY", "DEFECTIVE", "SHORTAGE", "SHORT", "MISSING", "NON_COMPLIANT"}

class AssessmentService:
    @staticmethod
    def assess_charge(db: Session, charge_id: str) -> AssessChargeResponse:
        """
        Deterministically classifies a charge as SUPPORTED, CONTRADICTED, or SILENT.
        
        Rules:
        - SUPPORTED: available evidence supports the charge (e.g. Prep/Pack logged FAIL/damaged).
        - CONTRADICTED: reliable evidence directly conflicts with the charge
          (e.g. Packaging defect charge + Prep packaging = PASS + valid timestamp).
        - SILENT: evidence is missing, incomplete, conflicting, or insufficient.
          Never force a verdict. Ambiguity -> SILENT.
        """
        charge = db.query(Charge).filter(Charge.charge_id == charge_id).first()
        if not charge:
            raise ValueError(f"Charge '{charge_id}' not found")

        # 1. Entity Resolution
        resolution = EntityResolutionService.resolve_charge(db, charge)

        # 2. Evidence Retrieval
        relevant_evidence, all_linked = EvidenceRetrievalService.retrieve_evidence_for_charge(
            db, charge, resolution
        )

        evidence_ids = [e.evidence_id for e in relevant_evidence]
        evidence_count = len(relevant_evidence)

        # 3. Decision Evaluation
        if evidence_count == 0:
            verdict = "SILENT"
            if len(all_linked) > 0:
                reason = (
                    f"No relevant evidence matching charge reason '{charge.reason}'. "
                    f"Found {len(all_linked)} operational records for shipment/order, but none pertain to this dispute domain. Defaulting to SILENT."
                )
            else:
                reason = (
                    f"No evidence records found for charge '{charge.charge_id}' "
                    f"(shipment_id={charge.shipment_id}, order_id={charge.order_id}). Defaulting to SILENT."
                )
        else:
            # Check timestamps relative to charge date
            # Valid evidence should normally have occurred at or before the charge date
            valid_evidence: List[Evidence] = []
            for ev in relevant_evidence:
                if ev.timestamp and charge.charge_date:
                    ev_date = ev.timestamp.date() if hasattr(ev.timestamp, "date") else ev.timestamp
                    chg_date = charge.charge_date.date() if hasattr(charge.charge_date, "date") else charge.charge_date
                    if ev.timestamp <= charge.charge_date or ev_date <= chg_date:
                        valid_evidence.append(ev)
                    else:
                        # Evidence logged after charge might be subsequent inspection or return
                        if ev.evidence_type == "returns":
                            valid_evidence.append(ev)
                else:
                    valid_evidence.append(ev)

            if not valid_evidence:
                verdict = "SILENT"
                reason = (
                    f"Found {evidence_count} evidence records, but none possessed valid timestamps prior to charge date ({charge.charge_date}). "
                    f"Cannot reliably establish sequence. Defaulting to SILENT."
                )
                evidence_ids = [e.evidence_id for e in relevant_evidence]
            else:
                # Count results among valid evidence
                favorable_matches = [e for e in valid_evidence if e.result.upper() in FAVORABLE_RESULTS]
                defect_matches = [e for e in valid_evidence if e.result.upper() in DEFECT_RESULTS]
                neutral_matches = [e for e in valid_evidence if e not in favorable_matches and e not in defect_matches]

                # Conflict detection: If there are BOTH favorable and defect records for the charge domain -> SILENT
                if favorable_matches and defect_matches:
                    verdict = "SILENT"
                    fav_ids = [e.evidence_id for e in favorable_matches]
                    def_ids = [e.evidence_id for e in defect_matches]
                    reason = (
                        f"Conflicting evidence detected for charge '{charge.charge_id}'. "
                        f"Favorable logs {fav_ids} conflict with defect logs {def_ids}. Ambiguity prefers SILENT."
                    )
                elif favorable_matches and not defect_matches:
                    verdict = "CONTRADICTED"
                    ev_summaries = [f"{e.evidence_id} ({e.evidence_type.upper()}: {e.result} by {e.source} at {e.timestamp.strftime('%Y-%m-%d %H:%M')})" for e in favorable_matches]
                    reason = (
                        f"Charge '{charge.reason}' is CONTRADICTED by {len(favorable_matches)} verified evidence record(s): "
                        + "; ".join(ev_summaries)
                        + ". Defensible recovery claim generated."
                    )
                    evidence_ids = [e.evidence_id for e in favorable_matches]
                elif defect_matches and not favorable_matches:
                    verdict = "SUPPORTED"
                    ev_summaries = [f"{e.evidence_id} ({e.evidence_type.upper()}: {e.result} by {e.source} at {e.timestamp.strftime('%Y-%m-%d %H:%M')})" for e in defect_matches]
                    reason = (
                        f"Charge '{charge.reason}' is SUPPORTED by {len(defect_matches)} warehouse evidence record(s) confirming discrepancy: "
                        + "; ".join(ev_summaries)
                        + ". Charge penalty is valid; no claim defensible."
                    )
                    evidence_ids = [e.evidence_id for e in defect_matches]
                else:
                    # Only neutral / inconclusive evidence
                    verdict = "SILENT"
                    reason = (
                        f"Evidence found ({[e.evidence_id for e in neutral_matches]}) provides only partial/inconclusive results "
                        f"({[e.result for e in neutral_matches]}). Insufficient to prove or disprove '{charge.reason}'. Defaulting to SILENT."
                    )
                    evidence_ids = [e.evidence_id for e in neutral_matches]

        # 4. Claim Calculation
        claim_amount = ClaimCalculationService.calculate_claim_amount(charge, verdict)

        # 5. Persist Assessment
        existing_asm = db.query(Assessment).filter(Assessment.charge_id == charge.charge_id).first()
        now = datetime.utcnow()
        if existing_asm:
            existing_asm.verdict = verdict
            existing_asm.reason = reason
            existing_asm.claim_amount = claim_amount
            existing_asm.evidence_ids = evidence_ids
            existing_asm.created_at = now
            assessment_id = existing_asm.assessment_id
        else:
            assessment_id = f"ASM-{uuid.uuid4().hex[:8].upper()}"
            new_asm = Assessment(
                assessment_id=assessment_id,
                charge_id=charge.charge_id,
                verdict=verdict,
                reason=reason,
                claim_amount=claim_amount,
                evidence_ids=evidence_ids,
                created_at=now
            )
            db.add(new_asm)

        charge.status = "ASSESSED"
        db.commit()

        return AssessChargeResponse(
            assessment_id=assessment_id,
            charge_id=charge.charge_id,
            verdict=verdict,
            claim_amount=claim_amount,
            reason=reason,
            evidence_ids=evidence_ids,
            evidence_count=len(evidence_ids),
            created_at=now
        )
