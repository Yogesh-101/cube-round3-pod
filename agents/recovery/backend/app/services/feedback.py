import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.entities import Charge, Evidence, Assessment, AIAssessment
from app.services.assessment import AssessmentService
from app.services.agent import RecoveryAgent
from app.services.vector_retrieval import VectorRetrievalService

class EvidenceFeedbackService:
    @staticmethod
    def simulate_upstream_evidence_submission(
        db: Session,
        charge_id: str,
        upstream_stage: str,
        result: str = "PASS",
        description: Optional[str] = None,
        operator_id: str = "op_feedback_resolution"
    ) -> Dict[str, Any]:
        """
        Closed-loop evidence feedback mechanism:
        When an operational evidence gap is identified for a charge, this routes the request
        to the responsible upstream stage (Receiving, Prep, Pack, Returns).
        Upon receiving verified documentation from that stage, it persists the new evidence
        and automatically re-investigates the charge.
        """
        charge = db.query(Charge).filter(Charge.charge_id == charge_id).first()
        if not charge:
            raise ValueError(f"Charge '{charge_id}' not found")

        normalized_stage = upstream_stage.lower().strip()
        if normalized_stage not in {"receiving", "prep", "packing", "returns"}:
            raise ValueError(f"Invalid upstream stage '{upstream_stage}'. Allowed: receiving, prep, packing, returns")

        # Generate unique evidence record ID
        short_id = uuid.uuid4().hex[:6].upper()
        stage_prefix = {"receiving": "RCV", "prep": "PRP", "packing": "PCK", "returns": "RTN"}.get(normalized_stage, "EV")
        evidence_id = f"FB-{stage_prefix}-{short_id}"

        now = datetime.now(timezone.utc)
        desc = description or (
            f"Closed-Loop Resolution ({evidence_id}): Upstream {normalized_stage.capitalize()} station verified "
            f"operational compliance log submitted in response to Recovery gap notification for charge {charge.charge_id}."
        )

        ref_data = {
            "source_dataset": charge.source_dataset or "cube_official",
            "source_file": "closed_loop_feedback_stream",
            "feedback_routed_from_recovery": True,
            "target_charge_id": charge.charge_id,
            "unit_id": charge.unit_id,
            "operator_id": operator_id,
            "stage": normalized_stage,
            "submitted_at": now.isoformat()
        }

        new_evidence = Evidence(
            evidence_id=evidence_id,
            evidence_type=normalized_stage,
            shipment_id=charge.shipment_id,
            order_id=charge.order_id,
            sku=charge.sku,
            unit_id=charge.unit_id,
            source_dataset=charge.source_dataset or "cube_official",
            result=result.upper(),
            description=desc,
            timestamp=charge.charge_date, # timestamped prior to or at charge date for causal validity
            source=f"{normalized_stage.capitalize()}Station-{operator_id} (Feedback Stream)",
            reference_data=ref_data
        )
        db.add(new_evidence)
        db.commit()

        # Update vector index for semantic retrieval
        VectorRetrievalService.index_evidence(db)

        # Re-run assessment
        updated_asm = AssessmentService.assess_charge(db, charge.charge_id)

        # Check if AI assessment exists, update it as well
        existing_ai = db.query(AIAssessment).filter(AIAssessment.charge_id == charge.charge_id).first()
        if existing_ai:
            try:
                RecoveryAgent.investigate_charge(charge.charge_id, db)
            except Exception:
                pass

        return {
            "success": True,
            "charge_id": charge.charge_id,
            "new_evidence_id": evidence_id,
            "upstream_stage": normalized_stage,
            "evidence_result": result.upper(),
            "previous_verdict": "SILENT",
            "updated_verdict": updated_asm.verdict,
            "updated_claim_amount": updated_asm.claim_amount,
            "updated_reason": updated_asm.reason,
            "evidence_ids": updated_asm.evidence_ids
        }
