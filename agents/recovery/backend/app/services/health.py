from typing import List, Dict, Any, Set
from sqlalchemy.orm import Session
from app.models.entities import Charge, Evidence, Assessment, AIAssessment
from app.schemas.health import EvidenceGapItem, EvidenceHealthMetrics
from app.services import tools
from app.services.resolution import EntityResolutionService
from app.services.evidence import EvidenceRetrievalService
from app.services.charge_understanding import ChargeUnderstandingService

FAVORABLE_RESULTS: Set[str] = {"PASS", "VERIFIED", "INTACT", "COMPLIANT", "MATCH", "CONFIRMED"}
DEFECT_RESULTS: Set[str] = {"FAIL", "FAILED", "DAMAGED", "DISCREPANCY", "DEFECTIVE", "SHORTAGE", "SHORT", "MISSING", "NON_COMPLIANT"}

class EvidenceHealthService:
    @staticmethod
    def get_evidence_health(db: Session) -> EvidenceHealthMetrics:
        """
        Computes accurate evidence health and gap detection metrics from actual database records.
        Never fabricates metrics, percentages, or gaps.
        """
        charges: List[Charge] = db.query(Charge).all()
        total_charges = len(charges)

        if total_charges == 0:
            return EvidenceHealthMetrics(
                total_charges=0,
                charges_with_sufficient_evidence=0,
                charges_with_evidence_gaps=0,
                supported_count=0,
                contradicted_count=0,
                silent_count=0,
                evidence_coverage_percentage=0.0,
                investigations_requiring_attention=0,
                evidence_type_distribution={},
                gap_breakdown={},
                evidence_gaps=[]
            )

        # Pre-fetch all assessments and AI assessments for quick lookup
        ai_assessments = {a.charge_id: a for a in db.query(AIAssessment).all()}
        std_assessments = {a.charge_id: a for a in db.query(Assessment).all()}

        # Count evidence types across database
        all_evidences = db.query(Evidence).all()
        evidence_type_dist: Dict[str, int] = {}
        for ev in all_evidences:
            etype = ev.evidence_type.lower()
            evidence_type_dist[etype] = evidence_type_dist.get(etype, 0) + 1

        supported_count = 0
        contradicted_count = 0
        silent_count = 0

        charges_with_gaps_set = set()
        attention_charges_set = set()
        evidence_gaps: List[EvidenceGapItem] = []
        gap_breakdown: Dict[str, int] = {}

        for charge in charges:
            # 1. Resolve verdict
            if charge.charge_id in ai_assessments:
                verdict = ai_assessments[charge.charge_id].verdict
            elif charge.charge_id in std_assessments:
                verdict = std_assessments[charge.charge_id].verdict
            else:
                verdict = "SILENT"

            if verdict == "SUPPORTED":
                supported_count += 1
            elif verdict == "CONTRADICTED":
                contradicted_count += 1
            else:
                silent_count += 1

            # 2. Entity Resolution & Understanding
            resolution = EntityResolutionService.resolve_charge(db, charge)
            understanding = ChargeUnderstandingService.understand(charge)
            expected_types = understanding.relevant_evidence_types

            # 3. Retrieve Evidence
            relevant_evidence, _ = EvidenceRetrievalService.retrieve_evidence_for_charge(
                db, charge, resolution
            )

            charge_has_gap = False
            charge_needs_attention = False

            # Check A: Unresolved Entity
            if not resolution.shipment_id and not resolution.order_id:
                gap_type = "UNRESOLVED_ENTITY"
                gap_breakdown[gap_type] = gap_breakdown.get(gap_type, 0) + 1
                evidence_gaps.append(EvidenceGapItem(
                    charge_id=charge.charge_id,
                    reason=charge.reason,
                    amount=charge.amount,
                    currency=charge.currency,
                    gap_type=gap_type,
                    severity="HIGH",
                    description="Charge cannot be linked to any shipment or order record.",
                    expected_types=expected_types,
                    responsible_stage="Inbound Fulfillment / Integration",
                    missing_evidence="Missing shipment or order ID link in operational feed",
                    shipment_id=resolution.shipment_id,
                    order_id=resolution.order_id,
                    sku=resolution.sku
                ))
                charge_has_gap = True
                charge_needs_attention = True
            elif not resolution.shipment_id:
                gap_type = "UNRESOLVED_ENTITY"
                gap_breakdown[gap_type] = gap_breakdown.get(gap_type, 0) + 1
                evidence_gaps.append(EvidenceGapItem(
                    charge_id=charge.charge_id,
                    reason=charge.reason,
                    amount=charge.amount,
                    currency=charge.currency,
                    gap_type=gap_type,
                    severity="MEDIUM",
                    description="Missing shipment entity resolution for order.",
                    expected_types=expected_types,
                    responsible_stage="Fulfillment Logistics",
                    missing_evidence="Shipment association for order",
                    shipment_id=resolution.shipment_id,
                    order_id=resolution.order_id,
                    sku=resolution.sku
                ))
                charge_has_gap = True

            # Check B: No Evidence
            if len(relevant_evidence) == 0:
                gap_type = "NO_EVIDENCE"
                gap_breakdown[gap_type] = gap_breakdown.get(gap_type, 0) + 1
                primary_stage = expected_types[0].capitalize() if expected_types else "Dock / Prep"
                evidence_gaps.append(EvidenceGapItem(
                    charge_id=charge.charge_id,
                    reason=charge.reason,
                    amount=charge.amount,
                    currency=charge.currency,
                    gap_type=gap_type,
                    severity="HIGH",
                    description="No operational evidence found in warehouse/carrier logs.",
                    expected_types=expected_types,
                    responsible_stage=primary_stage,
                    missing_evidence=f"Verified {primary_stage} inspection scan and signoff",
                    shipment_id=resolution.shipment_id,
                    order_id=resolution.order_id,
                    sku=resolution.sku
                ))
                charge_has_gap = True
                charge_needs_attention = True
            else:
                # Check C: Conflicting Evidence
                has_favorable = any(e.result.upper() in FAVORABLE_RESULTS for e in relevant_evidence)
                has_defect = any(e.result.upper() in DEFECT_RESULTS for e in relevant_evidence)

                if has_favorable and has_defect:
                    gap_type = "CONFLICTING_EVIDENCE"
                    gap_breakdown[gap_type] = gap_breakdown.get(gap_type, 0) + 1
                    evidence_gaps.append(EvidenceGapItem(
                        charge_id=charge.charge_id,
                        reason=charge.reason,
                        amount=charge.amount,
                        currency=charge.currency,
                        gap_type=gap_type,
                        severity="HIGH",
                        description="Operational logs contain conflicting results (both pass and defect logged).",
                        expected_types=expected_types,
                        responsible_stage="Quality Assurance",
                        missing_evidence="Discrepancy reconciliation report between conflicting logs",
                        shipment_id=resolution.shipment_id,
                        order_id=resolution.order_id,
                        sku=resolution.sku
                    ))
                    charge_has_gap = True
                    charge_needs_attention = True

                # Check D: Missing Expected Evidence Types (Flag as gap when audit is inconclusive/silent)
                found_types = {e.evidence_type.lower() for e in relevant_evidence}
                missing_types = [t for t in expected_types if t.lower() not in found_types]
                if missing_types and verdict == "SILENT":
                    gap_type = "MISSING_EXPECTED_TYPE"
                    gap_breakdown[gap_type] = gap_breakdown.get(gap_type, 0) + 1
                    primary_missing = missing_types[0].capitalize()
                    evidence_gaps.append(EvidenceGapItem(
                        charge_id=charge.charge_id,
                        reason=charge.reason,
                        amount=charge.amount,
                        currency=charge.currency,
                        gap_type=gap_type,
                        severity="MEDIUM",
                        description=f"Incomplete evidence coverage: missing {', '.join(missing_types)} logs preventing conclusive audit.",
                        expected_types=missing_types,
                        responsible_stage=primary_missing,
                        missing_evidence=f"Complete {primary_missing} operational log",
                        shipment_id=resolution.shipment_id,
                        order_id=resolution.order_id,
                        sku=resolution.sku
                    ))
                    charge_has_gap = True
                    charge_needs_attention = True

            if charge_has_gap:
                charges_with_gaps_set.add(charge.charge_id)
            if charge_needs_attention:
                attention_charges_set.add(charge.charge_id)

        charges_with_sufficient_evidence = total_charges - len(charges_with_gaps_set)
        if charges_with_sufficient_evidence < 0:
            charges_with_sufficient_evidence = 0

        coverage_pct = round((charges_with_sufficient_evidence / total_charges) * 100.0, 1)

        return EvidenceHealthMetrics(
            total_charges=total_charges,
            charges_with_sufficient_evidence=charges_with_sufficient_evidence,
            charges_with_evidence_gaps=len(charges_with_gaps_set),
            supported_count=supported_count,
            contradicted_count=contradicted_count,
            silent_count=silent_count,
            evidence_coverage_percentage=coverage_pct,
            investigations_requiring_attention=len(attention_charges_set),
            evidence_type_distribution=evidence_type_dist,
            gap_breakdown=gap_breakdown,
            evidence_gaps=evidence_gaps
        )
