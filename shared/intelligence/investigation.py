"""Investigation Graph & Timeline Builder.

Builds a directed graph and chronological timeline from real entities and evidence records.

Rules:
- Every node references a real entity/evidence
- Every edge represents a verified relationship
- No graph relationships from LLM guesses
- Timestamps come from actual evidence records
"""
from __future__ import annotations

from .schemas import (
    GraphEdge,
    GraphNode,
    InvestigationGraph,
    InvestigationTimeline,
    TimelineEvent,
)


def build_investigation_graph(
    workflow_id: str,
    subject_id: str,
    org_id: str,
    charges: list[dict],
    evidence_records: list[dict],
    charge_investigations: list | None = None,
) -> InvestigationGraph:
    """Build the investigation graph from real entities and verified relationships.

    Structure:
      Charge → Order → Shipment → SKU/Item
        ↓
      Evidence Records (per stage)
        ↓
      Assessment → Decision → Claim (if any)
    """
    graph = InvestigationGraph(workflow_id=workflow_id)

    # Subject node
    subject_node = GraphNode(
        node_id=f"subject:{subject_id}",
        node_type="subject",
        label=subject_id,
        entity_id=subject_id,
        data={"org_id": org_id},
    )
    graph.add_node(subject_node)

    # Extract unique entities from charges
    orders = set()
    shipments = set()
    skus = set()

    for charge in charges:
        # Charge node
        line_id = charge.get("line_id", "")
        charge_node = GraphNode(
            node_id=f"charge:{line_id}",
            node_type="charge",
            label=f"{charge.get('charge_type', 'unknown')} (${charge.get('amount_usd', 0)})",
            entity_id=line_id,
            data={
                "charge_type": charge.get("charge_type"),
                "amount_usd": float(charge.get("amount_usd", 0)),
                "posted_date": charge.get("posted_date", ""),
            },
            timestamp=charge.get("posted_date"),
        )
        graph.add_node(charge_node)

        # Charge → Subject
        graph.add_edge(GraphEdge(
            source=f"charge:{line_id}",
            target=f"subject:{subject_id}",
            relationship="belongs_to",
        ))

        # Order node (if present)
        order_id = charge.get("order_id", "")
        if order_id:
            orders.add(order_id)
            order_node = GraphNode(
                node_id=f"order:{order_id}",
                node_type="order",
                label=order_id,
                entity_id=order_id,
            )
            graph.add_node(order_node)
            graph.add_edge(GraphEdge(
                source=f"charge:{line_id}",
                target=f"order:{order_id}",
                relationship="belongs_to",
            ))

        # Shipment node (if present)
        ship_id = charge.get("fba_shipment_id", "")
        if ship_id:
            shipments.add(ship_id)
            ship_node = GraphNode(
                node_id=f"shipment:{ship_id}",
                node_type="shipment",
                label=ship_id,
                entity_id=ship_id,
            )
            graph.add_node(ship_node)
            graph.add_edge(GraphEdge(
                source=f"charge:{line_id}",
                target=f"shipment:{ship_id}",
                relationship="belongs_to",
            ))

        # SKU node (if present)
        sku = charge.get("sku", "")
        if sku:
            skus.add(sku)
            sku_node = GraphNode(
                node_id=f"sku:{sku}",
                node_type="sku",
                label=sku,
                entity_id=sku,
            )
            graph.add_node(sku_node)
            graph.add_edge(GraphEdge(
                source=f"charge:{line_id}",
                target=f"sku:{sku}",
                relationship="references",
            ))

    # Evidence record nodes
    for record in evidence_records:
        record_id = record.get("record_id", "")
        stage = record.get("stage", "")
        ev_node = GraphNode(
            node_id=f"evidence:{record_id}",
            node_type="evidence",
            label=f"{stage} evidence ({record.get('decision', {}).get('verdict', 'UNKNOWN')})",
            entity_id=record_id,
            data={
                "stage": stage,
                "verdict": record.get("decision", {}).get("verdict"),
                "outcome": record.get("decision", {}).get("outcome"),
                "status": record.get("status"),
                "agent_id": record.get("agent_id"),
            },
            timestamp=record.get("produced_at"),
        )
        graph.add_node(ev_node)

        # Evidence → Subject
        graph.add_edge(GraphEdge(
            source=f"evidence:{record_id}",
            target=f"subject:{subject_id}",
            relationship="about",
        ))

        # Evidence → upstream evidence
        for upstream_id in record.get("upstream_refs", []):
            graph.add_edge(GraphEdge(
                source=f"evidence:{record_id}",
                target=f"evidence:{upstream_id}",
                relationship="consumes",
            ))

        # Evidence → SKU (from refs)
        ref_sku = record.get("subject", {}).get("refs", {}).get("sku", "")
        if ref_sku:
            sku_node = GraphNode(
                node_id=f"sku:{ref_sku}",
                node_type="sku",
                label=ref_sku,
                entity_id=ref_sku,
            )
            graph.add_node(sku_node)
            graph.add_edge(GraphEdge(
                source=f"evidence:{record_id}",
                target=f"sku:{ref_sku}",
                relationship="references",
            ))

    # Add investigation results to graph
    if charge_investigations:
        for ci in charge_investigations:
            # Assessment node
            assess_node = GraphNode(
                node_id=f"assessment:{ci.charge_id}",
                node_type="assessment",
                label=f"Assessment: {ci.final_verdict}",
                entity_id=ci.charge_id,
                data={
                    "verdict": ci.final_verdict,
                    "confidence": ci.final_confidence,
                    "evidence_health": ci.evidence_health.status if ci.evidence_health else "UNKNOWN",
                },
            )
            graph.add_node(assess_node)
            graph.add_edge(GraphEdge(
                source=f"assessment:{ci.charge_id}",
                target=f"charge:{ci.charge_id}",
                relationship="assesses",
            ))

            # Assessment → Evidence used
            for eid in ci.retrieved_evidence_ids:
                graph.add_edge(GraphEdge(
                    source=f"assessment:{ci.charge_id}",
                    target=f"evidence:{eid}",
                    relationship="uses_evidence",
                ))

            # Decision node
            decision_node = GraphNode(
                node_id=f"decision:{ci.charge_id}",
                node_type="decision",
                label=f"Decision: {ci.decision}",
                entity_id=ci.charge_id,
                data={
                    "decision": ci.decision,
                    "amount_usd": ci.amount_usd,
                    "reason": ci.final_reason,
                },
            )
            graph.add_node(decision_node)
            graph.add_edge(GraphEdge(
                source=f"decision:{ci.charge_id}",
                target=f"assessment:{ci.charge_id}",
                relationship="based_on",
            ))

    return graph


def build_investigation_timeline(
    workflow_id: str,
    subject_id: str,
    charges: list[dict],
    evidence_records: list[dict],
    workflow_transitions: list[dict] | None = None,
    charge_investigations: list | None = None,
) -> InvestigationTimeline:
    """Build a chronological timeline from actual timestamps in the evidence chain."""
    timeline = InvestigationTimeline(workflow_id=workflow_id)

    # Add charge events
    for charge in charges:
        posted = charge.get("posted_date", "")
        if posted:
            # Normalize date to datetime format
            ts = posted if "T" in posted else f"{posted}T00:00:00Z"
            timeline.add_event(TimelineEvent(
                timestamp=ts,
                event_type="charge_posted",
                entity_id=charge.get("line_id", ""),
                description=f"Charge {charge.get('charge_type', 'unknown')}: ${charge.get('amount_usd', 0)}",
                data={
                    "charge_type": charge.get("charge_type"),
                    "amount_usd": float(charge.get("amount_usd", 0)),
                    "line_id": charge.get("line_id", ""),
                },
            ))

    # Add evidence production events
    for record in evidence_records:
        # Captured at (when the physical event happened)
        captured = record.get("captured_at", "")
        if captured:
            timeline.add_event(TimelineEvent(
                timestamp=captured,
                event_type="evidence_captured",
                stage=record.get("stage"),
                entity_id=record.get("record_id", ""),
                description=f"{record.get('stage', '')} observation captured",
                evidence_id=record.get("record_id"),
                data={
                    "agent_id": record.get("agent_id"),
                    "verdict": record.get("decision", {}).get("verdict"),
                },
            ))

        # Produced at (when the evidence record was created)
        produced = record.get("produced_at", "")
        if produced:
            timeline.add_event(TimelineEvent(
                timestamp=produced,
                event_type="evidence_produced",
                stage=record.get("stage"),
                entity_id=record.get("record_id", ""),
                description=f"{record.get('stage', '')} evidence: {record.get('decision', {}).get('verdict', 'UNKNOWN')}",
                evidence_id=record.get("record_id"),
                data={
                    "agent_id": record.get("agent_id"),
                    "verdict": record.get("decision", {}).get("verdict"),
                    "outcome": record.get("decision", {}).get("outcome"),
                },
            ))

    # Add workflow transitions
    if workflow_transitions:
        for transition in workflow_transitions:
            ts = transition.get("at", "")
            if ts:
                timeline.add_event(TimelineEvent(
                    timestamp=ts,
                    event_type="workflow_transition",
                    stage=transition.get("stage"),
                    entity_id=workflow_id,
                    description=f"{transition.get('event', 'unknown')}: {transition.get('detail', '')}",
                    data=transition,
                ))

    # Add investigation events
    if charge_investigations:
        for ci in charge_investigations:
            if hasattr(ci, 'to_dict'):
                timeline.add_event(TimelineEvent(
                    timestamp=ci.evidence_health.details if ci.evidence_health else "",
                    event_type="investigation",
                    entity_id=ci.charge_id,
                    description=f"Investigation: {ci.final_verdict} → {ci.decision}",
                    data={
                        "verdict": ci.final_verdict,
                        "decision": ci.decision,
                        "confidence": ci.final_confidence,
                    },
                ))

    return timeline
