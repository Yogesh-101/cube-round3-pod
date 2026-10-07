from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.entities import Charge, Evidence, Shipment, Order, Assessment, AIAssessment
from app.schemas.investigation import (
    InvestigationNode,
    InvestigationEdge,
    InvestigationTimelineEvent,
    InvestigationResponse
)
from app.services import tools
from app.services.resolution import EntityResolutionService
from app.services.evidence import EvidenceRetrievalService
from app.services.charge_understanding import ChargeUnderstandingService

FAVORABLE_RESULTS = {"PASS", "VERIFIED", "INTACT", "COMPLIANT", "MATCH", "CONFIRMED"}
DEFECT_RESULTS = {"FAIL", "FAILED", "DAMAGED", "DISCREPANCY", "DEFECTIVE", "SHORTAGE", "SHORT", "MISSING", "NON_COMPLIANT"}

class InvestigationGraphService:
    @staticmethod
    def get_investigation_graph(charge_id: str, db: Session) -> InvestigationResponse:
        """
        Builds a complete, relational evidence graph and chronological timeline:
        Charge -> Order -> Shipment -> SKU -> Operational Evidence -> Assessment -> Recovery Decision.
        Never invents relationships; uses actual database records as the source of truth.
        """
        charge = tools.get_charge(charge_id, db)
        if not charge:
            raise ValueError(f"Charge '{charge_id}' not found in database")

        # 1. Entity Resolution
        resolution = EntityResolutionService.resolve_charge(db, charge)
        order_id = resolution.order_id
        shipment_id = resolution.shipment_id
        sku = resolution.sku

        # 2. Charge Understanding & Expected Evidence Types
        understanding = ChargeUnderstandingService.understand(charge)
        expected_types = understanding.relevant_evidence_types

        # 3. Evidence Retrieval
        relevant_evidence, all_linked = EvidenceRetrievalService.retrieve_evidence_for_charge(
            db, charge, resolution
        )

        # 4. Assessment Check (AI Assessment or Phase 1 Assessment)
        ai_asm = db.query(AIAssessment).filter(AIAssessment.charge_id == charge_id).first()
        std_asm = db.query(Assessment).filter(Assessment.charge_id == charge_id).first()

        is_ai_evaluated = ai_asm is not None
        if ai_asm:
            verdict = ai_asm.verdict
            claim_amount = ai_asm.claim_amount
            assessment_reason = ai_asm.reason
            evidence_strength = ai_asm.evidence_strength
            assessment_id = f"AI-ASM-{ai_asm.id}"
            asm_time = ai_asm.created_at
        elif std_asm:
            verdict = std_asm.verdict
            claim_amount = std_asm.claim_amount
            assessment_reason = std_asm.reason
            evidence_strength = "STRONG" if len(std_asm.evidence_ids or []) >= 2 else "MODERATE"
            assessment_id = std_asm.assessment_id
            asm_time = std_asm.created_at
        else:
            # Deterministic baseline on the fly
            det_eval = tools.assess_evidence(charge, relevant_evidence)
            verdict = det_eval["verdict"]
            claim_amount = tools.calculate_claim(charge, verdict)
            assessment_reason = det_eval["reason"]
            evidence_strength = det_eval["evidence_strength"]
            assessment_id = "ASM-PENDING"
            asm_time = datetime.now(timezone.utc)

        # 5. Evidence Classification (Supporting, Contradicting, Inconclusive, Missing)
        supporting: List[Dict[str, Any]] = []
        contradicting: List[Dict[str, Any]] = []
        inconclusive: List[Dict[str, Any]] = []
        found_types = set()

        for ev in relevant_evidence:
            found_types.add(ev.evidence_type.lower())
            item_dict = {
                "evidence_id": ev.evidence_id,
                "evidence_type": ev.evidence_type,
                "result": ev.result,
                "source": ev.source,
                "timestamp": ev.timestamp,
                "timestamp_str": ev.timestamp.strftime("%Y-%m-%d %H:%M") if ev.timestamp else "undated",
                "description": ev.description,
                "sku": ev.sku
            }
            r_upper = ev.result.upper()
            if r_upper in FAVORABLE_RESULTS:
                contradicting.append(item_dict)
            elif r_upper in DEFECT_RESULTS:
                supporting.append(item_dict)
            else:
                inconclusive.append(item_dict)

        missing_types = [t for t in expected_types if t.lower() not in found_types]

        # 6. Graph Construction (Nodes & Edges)
        nodes: List[InvestigationNode] = []
        edges: List[InvestigationEdge] = []

        # A. Charge Node
        nodes.append(InvestigationNode(
            id=f"charge:{charge.charge_id}",
            type="charge",
            label=f"Charge: {charge.charge_id}",
            status="verified",
            data={
                "charge_id": charge.charge_id,
                "amount": charge.amount,
                "currency": charge.currency,
                "reason": charge.reason,
                "charge_date": str(charge.charge_date),
                "unit_id": getattr(charge, "unit_id", None),
                "source_dataset": getattr(charge, "source_dataset", "internal")
            }
        ))

        # B. Order Node
        order_node_id = f"order:{order_id}" if order_id else "order:missing"
        nodes.append(InvestigationNode(
            id=order_node_id,
            type="order",
            label=f"Order: {order_id or 'Missing'}",
            status="verified" if order_id else "missing",
            data={"order_id": order_id}
        ))
        edges.append(InvestigationEdge(
            source=f"charge:{charge.charge_id}",
            target=order_node_id,
            relation="billed_for",
            verified=bool(order_id)
        ))

        # C. Shipment Node
        ship_node_id = f"shipment:{shipment_id}" if shipment_id else "shipment:missing"
        nodes.append(InvestigationNode(
            id=ship_node_id,
            type="shipment",
            label=f"Shipment: {shipment_id or 'Missing'}",
            status="verified" if shipment_id else "missing",
            data={"shipment_id": shipment_id}
        ))
        edges.append(InvestigationEdge(
            source=order_node_id,
            target=ship_node_id,
            relation="fulfilled_by",
            verified=bool(shipment_id)
        ))

        # D. SKU Node
        sku_node_id = f"sku:{sku}" if sku else "sku:unspecified"
        nodes.append(InvestigationNode(
            id=sku_node_id,
            type="sku",
            label=f"SKU: {sku or 'Unspecified'}",
            status="verified" if sku else "missing",
            data={"sku": sku}
        ))
        edges.append(InvestigationEdge(
            source=ship_node_id,
            target=sku_node_id,
            relation="contains_item",
            verified=bool(sku)
        ))

        # E. Assessment Node
        asm_node_id = f"assessment:{charge.charge_id}"
        nodes.append(InvestigationNode(
            id=asm_node_id,
            type="assessment",
            label=f"Assessment ({verdict})",
            status=verdict.lower(),
            data={
                "verdict": verdict,
                "evidence_strength": evidence_strength,
                "reason": assessment_reason,
                "is_ai": is_ai_evaluated
            }
        ))

        # F. Operational Evidence Nodes
        if relevant_evidence:
            for ev in relevant_evidence:
                ev_node_id = f"evidence:{ev.evidence_id}"
                r_upper = ev.result.upper()
                if r_upper in FAVORABLE_RESULTS:
                    ev_status = "contradicted"  # Favorable evidence contradicts the charge
                elif r_upper in DEFECT_RESULTS:
                    ev_status = "supported"     # Defect evidence supports the charge
                else:
                    ev_status = "inconclusive"

                nodes.append(InvestigationNode(
                    id=ev_node_id,
                    type="evidence",
                    label=f"[{ev.evidence_type.upper()}] {ev.result}",
                    status=ev_status,
                    data={
                        "evidence_id": ev.evidence_id,
                        "evidence_type": ev.evidence_type,
                        "result": ev.result,
                        "source": ev.source,
                        "timestamp": str(ev.timestamp),
                        "description": ev.description,
                        "unit_id": getattr(ev, "unit_id", None),
                        "source_dataset": getattr(ev, "source_dataset", "internal"),
                        "reference_data": ev.reference_data
                    }
                ))

                edges.append(InvestigationEdge(
                    source=sku_node_id,
                    target=ev_node_id,
                    relation="attested_by",
                    verified=True
                ))
                edges.append(InvestigationEdge(
                    source=ev_node_id,
                    target=asm_node_id,
                    relation="evaluated_by",
                    verified=True
                ))
        else:
            # Explicit Missing Evidence Node (Never break the graph)
            missing_ev_id = f"evidence:missing:{charge.charge_id}"
            nodes.append(InvestigationNode(
                id=missing_ev_id,
                type="evidence",
                label="No Evidence Found",
                status="missing",
                data={"missing_types": missing_types}
            ))
            edges.append(InvestigationEdge(
                source=sku_node_id,
                target=missing_ev_id,
                relation="attested_by",
                verified=False
            ))
            edges.append(InvestigationEdge(
                source=missing_ev_id,
                target=asm_node_id,
                relation="evaluated_by",
                verified=False
            ))

        # G. Recovery Decision Node
        decision_node_id = f"decision:{charge.charge_id}"
        decision_label = (
            f"Defensible Claim: ${claim_amount:.2f}"
            if verdict == "CONTRADICTED"
            else f"Valid Penalty (${charge.amount:.2f})"
            if verdict == "SUPPORTED"
            else "Inconclusive (No Claim)"
        )
        nodes.append(InvestigationNode(
            id=decision_node_id,
            type="decision",
            label=decision_label,
            status=verdict.lower(),
            data={
                "verdict": verdict,
                "claim_amount": claim_amount,
                "currency": charge.currency
            }
        ))
        edges.append(InvestigationEdge(
            source=asm_node_id,
            target=decision_node_id,
            relation="concluded_as",
            verified=True
        ))

        # 7. Chronological Investigation Timeline
        timeline: List[InvestigationTimelineEvent] = []

        # Find linked shipment record for shipment date
        if shipment_id:
            sh_rec = db.query(Shipment).filter(Shipment.shipment_id == shipment_id).first()
            if sh_rec and sh_rec.shipment_date:
                timeline.append(InvestigationTimelineEvent(
                    id=f"event:shipment:{sh_rec.shipment_id}",
                    event_type="shipment_dispatched",
                    title=f"Shipment {sh_rec.shipment_id} Dispatched",
                    description=f"Fulfillment dispatch of SKU {sh_rec.sku or sku} (Qty: {sh_rec.quantity})",
                    timestamp=sh_rec.shipment_date,
                    timestamp_str=sh_rec.shipment_date.strftime("%Y-%m-%d %H:%M"),
                    source="Carrier Handoff",
                    status_badge="DISPATCHED"
                ))

        # Operational Evidence Events
        for ev in (all_linked or relevant_evidence):
            timeline.append(InvestigationTimelineEvent(
                id=f"event:evidence:{ev.evidence_id}",
                event_type=f"evidence_{ev.evidence_type}",
                title=f"{ev.evidence_type.capitalize()} Inspection: {ev.evidence_id}",
                description=f"{ev.description} (Result: {ev.result})",
                timestamp=ev.timestamp,
                timestamp_str=ev.timestamp.strftime("%Y-%m-%d %H:%M") if ev.timestamp else "undated",
                source=ev.source,
                evidence_id=ev.evidence_id,
                result=ev.result,
                status_badge=ev.result.upper()
            ))

        # Charge Assessment Logged Event
        if charge.charge_date:
            timeline.append(InvestigationTimelineEvent(
                id=f"event:charge:{charge.charge_id}",
                event_type="charge_logged",
                title=f"Fulfillment Charge Levied: {charge.charge_id}",
                description=f"Penalty fee levied: ${charge.amount:.2f} {charge.currency} for reason '{charge.reason}'",
                timestamp=charge.charge_date,
                timestamp_str=charge.charge_date.strftime("%Y-%m-%d %H:%M"),
                source="Channel Partner Billing",
                status_badge="PENALTY"
            ))

        # Decision Engine / AI Audit Event
        if asm_time:
            timeline.append(InvestigationTimelineEvent(
                id=f"event:assessment:{charge.charge_id}",
                event_type="assessment_completed",
                title=f"Audit Completed: {verdict}",
                description=assessment_reason,
                timestamp=asm_time,
                timestamp_str=asm_time.strftime("%Y-%m-%d %H:%M") if isinstance(asm_time, datetime) else str(asm_time),
                source="RecoveryOS Agent" if is_ai_evaluated else "Deterministic Engine",
                status_badge=verdict
            ))

        def _normalize_dt(dt: Optional[datetime]) -> datetime:
            if not dt:
                return datetime.min
            if getattr(dt, "tzinfo", None) is not None:
                return dt.astimezone(timezone.utc).replace(tzinfo=None)
            return dt

        # Sort timeline chronologically (None timestamps at the beginning or end)
        timeline.sort(key=lambda x: _normalize_dt(x.timestamp))

        return InvestigationResponse(
            charge_id=charge.charge_id,
            verdict=verdict,
            claim_amount=claim_amount,
            currency=charge.currency,
            charge_reason=charge.reason,
            charge_amount=charge.amount,
            charge_date=charge.charge_date,
            assessment_id=assessment_id,
            assessment_reason=assessment_reason,
            evidence_strength=evidence_strength,
            is_ai_evaluated=is_ai_evaluated,
            nodes=nodes,
            edges=edges,
            timeline=timeline,
            missing_evidence_types=missing_types,
            supporting_evidence=supporting,
            contradicting_evidence=contradicting,
            inconclusive_evidence=inconclusive
        )
