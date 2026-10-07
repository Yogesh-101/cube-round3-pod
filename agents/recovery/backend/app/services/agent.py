from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
import logging

from app.models.entities import Charge, Evidence, AIAssessment, Assessment
from app.schemas.ai import AIAssessmentResponse, AIReasoningOutput
from app.services import tools
from app.services.charge_understanding import ChargeUnderstandingService
from app.services.resolution import EntityResolutionService
from app.services.vector_retrieval import VectorRetrievalService
from app.services.llm import LLMService
from app.services.claims import ClaimCalculationService

logger = logging.getLogger(__name__)

class RecoveryAgent:
    @staticmethod
    def investigate_charge(charge_id: str, db: Session) -> AIAssessmentResponse:
        """
        Orchestrates full AI recovery investigation:
        1. Load charge.
        2. Understand charge domain and requirements.
        3. Resolve shipment/order/SKU entities.
        4. Determine relevant evidence types.
        5. Retrieve structured & semantic evidence (RAG).
        6. Check evidence completeness & deterministic safety baseline.
        7. Reason over retrieved evidence with modular LLM.
        8. Validate output against DB (anti-hallucination grounding).
        9. Validate AI / Deterministic agreement.
        10. Calculate claim amount conservatively.
        11. Persist AI assessment and return structured result.
        """
        # 1. Load charge
        charge = tools.get_charge(charge_id, db)
        if not charge:
            raise ValueError(f"Charge '{charge_id}' not found in database")

        # 2. Understand charge
        understanding = ChargeUnderstandingService.understand(charge)

        # 3. Resolve entities
        resolution = EntityResolutionService.resolve_charge(db, charge)

        # 4. Determine relevant evidence types
        evidence_types = understanding.relevant_evidence_types

        # 5. Retrieve evidence via tools
        candidate_records = tools.search_evidence(
            db=db,
            shipment_id=resolution.shipment_id,
            order_id=resolution.order_id,
            sku=resolution.sku,
            unit_id=getattr(charge, "unit_id", None) or resolution.unit_id,
            evidence_types=evidence_types
        )

        # Ensure vector index is primed and semantically rank records
        VectorRetrievalService.get_index_status(db)
        ranked_tuples = VectorRetrievalService.semantic_search(
            query=charge.reason,
            evidence_pool=candidate_records,
            top_k=8
        )
        relevant_evidence: List[Evidence] = [t[0] for t in ranked_tuples]
        valid_ev_id_set = {e.evidence_id for e in relevant_evidence}

        # 6. Deterministic baseline safety check
        det_result = tools.assess_evidence(charge, relevant_evidence)
        det_verdict = det_result["verdict"]

        # 7. AI Reasoning Layer
        is_fallback = False
        agreement_with_deterministic = True
        llm_output: Optional[AIReasoningOutput] = None

        if LLMService.is_available():
            charge_dict = {
                "charge_id": charge.charge_id,
                "reason": charge.reason,
                "amount": charge.amount,
                "currency": charge.currency,
                "charge_date": str(charge.charge_date),
                "shipment_id": resolution.shipment_id,
                "order_id": resolution.order_id,
                "sku": resolution.sku
            }
            evidence_dicts = [
                {
                    "evidence_id": e.evidence_id,
                    "evidence_type": e.evidence_type,
                    "result": e.result,
                    "source": e.source,
                    "timestamp": str(e.timestamp),
                    "description": e.description,
                    "sku": e.sku
                }
                for e in relevant_evidence
            ]
            understanding_dict = {
                "category": understanding.category,
                "requirements": understanding.investigation_requirements
            }

            llm_output = LLMService.reason_over_evidence(charge_dict, evidence_dicts, understanding_dict)

        # Handle LLM unavailability or failure
        if llm_output is None:
            is_fallback = True
            final_verdict = det_verdict
            final_reason = (
                f"{det_result['reason']} (AI service unavailable — conservative deterministic assessment applied.)"
            )
            final_evidence_ids = det_result["evidence_ids"]
            final_strength = det_result["evidence_strength"]
            final_missing = det_result.get("missing_info", [])
        else:
            # 8. Anti-Hallucination & Evidence Grounding Validation
            # Verify all referenced evidence IDs actually exist in retrieved database records
            hallucinated_ids = [eid for eid in llm_output.evidence_ids if eid not in valid_ev_id_set]
            if hallucinated_ids:
                logger.warning(
                    f"Hallucination detected for charge {charge.charge_id}: "
                    f"AI referenced nonexistent/unretrieved IDs {hallucinated_ids}. Rejecting AI output."
                )
                is_fallback = True
                agreement_with_deterministic = False
                final_verdict = det_verdict
                final_evidence_ids = det_result["evidence_ids"]
                final_strength = "INSUFFICIENT"
                final_missing = [
                    f"AI hallucination rejected: unverified IDs {hallucinated_ids} not present in database records.",
                    *det_result.get("missing_info", [])
                ]
                final_reason = (
                    f"AI output contained unverified evidence IDs {hallucinated_ids} and was rejected. "
                    f"Fallback to conservative evaluation: {det_result['reason']}"
                )
            else:
                # 9. AI / Deterministic Agreement Check
                ai_verdict = llm_output.verdict.upper()
                if ai_verdict == det_verdict:
                    agreement_with_deterministic = True
                    final_verdict = ai_verdict
                    final_reason = llm_output.reason
                    final_evidence_ids = llm_output.evidence_ids or det_result["evidence_ids"]
                    final_strength = llm_output.evidence_strength
                    final_missing = llm_output.missing_information
                else:
                    # Conflict between AI verdict and deterministic safety facts
                    agreement_with_deterministic = False
                    # Conservative rule: If deterministic says SILENT, or there is conflicting evidence, prefer SILENT
                    if det_verdict == "SILENT":
                        final_verdict = "SILENT"
                        final_reason = (
                            f"Safety conflict: AI proposed '{ai_verdict}' but verified evidence is inconclusive/missing. "
                            f"Applying conservative safety standard: {det_result['reason']}"
                        )
                        final_evidence_ids = det_result["evidence_ids"]
                        final_strength = "WEAK"
                        final_missing = [
                            f"Conflict between AI verdict ({ai_verdict}) and deterministic validation ({det_verdict})",
                            *det_result.get("missing_info", [])
                        ]
                    else:
                        # Deterministic has hard evidence (PASS or FAIL), prefer verified database facts
                        final_verdict = det_verdict
                        final_reason = (
                            f"AI proposed '{ai_verdict}', but verified operational logs establish '{det_verdict}': "
                            f"{det_result['reason']}"
                        )
                        final_evidence_ids = det_result["evidence_ids"]
                        final_strength = det_result["evidence_strength"]
                        final_missing = [f"AI verdict {ai_verdict} overridden by factual evidence check {det_verdict}"]

        # 10. Calculate claim amount conservatively
        final_claim_amount = ClaimCalculationService.calculate_claim_amount(charge, final_verdict)

        # 11. Persist AI Assessment
        now = datetime.utcnow()
        existing_ai = db.query(AIAssessment).filter(AIAssessment.charge_id == charge.charge_id).first()
        if existing_ai:
            existing_ai.verdict = final_verdict
            existing_ai.reason = final_reason
            existing_ai.claim_amount = final_claim_amount
            existing_ai.evidence_ids = final_evidence_ids
            existing_ai.evidence_strength = final_strength
            existing_ai.missing_information = final_missing
            existing_ai.charge_category = understanding.category
            existing_ai.is_fallback = is_fallback
            existing_ai.agreement_with_deterministic = agreement_with_deterministic
            existing_ai.created_at = now
        else:
            new_ai = AIAssessment(
                charge_id=charge.charge_id,
                verdict=final_verdict,
                reason=final_reason,
                claim_amount=final_claim_amount,
                evidence_ids=final_evidence_ids,
                evidence_strength=final_strength,
                missing_information=final_missing,
                charge_category=understanding.category,
                is_fallback=is_fallback,
                agreement_with_deterministic=agreement_with_deterministic,
                created_at=now
            )
            db.add(new_ai)

        # Also sync Phase 1 Assessment table so existing UI & summary reflect audited assessment
        existing_asm = db.query(Assessment).filter(Assessment.charge_id == charge.charge_id).first()
        if existing_asm:
            existing_asm.verdict = final_verdict
            existing_asm.reason = final_reason
            existing_asm.claim_amount = final_claim_amount
            existing_asm.evidence_ids = final_evidence_ids
            existing_asm.created_at = now
        else:
            import uuid
            db.add(Assessment(
                assessment_id=f"ASM-{uuid.uuid4().hex[:8].upper()}",
                charge_id=charge.charge_id,
                verdict=final_verdict,
                reason=final_reason,
                claim_amount=final_claim_amount,
                evidence_ids=final_evidence_ids,
                created_at=now
            ))
        charge.status = "ASSESSED"
        db.commit()

        # Build evidence details for UI presentation
        ev_details = []
        for eid in final_evidence_ids:
            rec = next((e for e in relevant_evidence if e.evidence_id == eid), None)
            if not rec:
                rec = tools.get_evidence(eid, db)
            if rec:
                ev_details.append({
                    "evidence_id": rec.evidence_id,
                    "evidence_type": rec.evidence_type,
                    "result": rec.result,
                    "source": rec.source,
                    "timestamp": str(rec.timestamp),
                    "description": rec.description
                })

        return AIAssessmentResponse(
            charge_id=charge.charge_id,
            verdict=final_verdict,
            reason=final_reason,
            claim_amount=final_claim_amount,
            evidence_ids=final_evidence_ids,
            evidence_strength=final_strength,
            missing_information=final_missing,
            charge_category=understanding.category,
            relevant_evidence_types=evidence_types,
            is_fallback=is_fallback,
            agreement_with_deterministic=agreement_with_deterministic,
            deterministic_verdict=det_verdict,
            evidence_details=ev_details,
            created_at=now
        )
