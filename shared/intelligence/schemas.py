"""Phase 2 data types: schemas for investigation, evidence health, AI reasoning, and claim dossiers.

All types are plain dataclasses convertible to/from JSON dicts. No external dependencies.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from typing import Any


# ---------------------------------------------------------------- Enums
class Verdict(str, Enum):
    SUPPORTS = "SUPPORTS"
    CONTRADICTS = "CONTRADICTS"
    SILENT = "SILENT"


class EvidenceStatus(str, Enum):
    SUFFICIENT = "SUFFICIENT"
    INSUFFICIENT = "INSUFFICIENT"
    CONFLICTING = "CONFLICTING"


class InvestigationDecision(str, Enum):
    CLAIM = "CLAIM"
    NO_CLAIM = "NO_CLAIM"
    REVIEW = "REVIEW"
    ERROR = "ERROR"


class GapStatus(str, Enum):
    OPEN = "OPEN"
    REQUESTED = "REQUESTED"
    FILLED = "FILLED"
    UNFILLABLE = "UNFILLABLE"


class AIStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    UNAVAILABLE = "UNAVAILABLE"
    DEGRADED = "DEGRADED"


# ---------------------------------------------------------------- AI Reasoning
@dataclass
class AIReasoningOutput:
    """Structured output from AI reasoning over a charge investigation."""
    verdict: str  # SUPPORTS / CONTRADICTS / SILENT
    confidence: float  # 0.0-1.0
    evidence_ids_used: list[str] = field(default_factory=list)
    reasoning_summary: str = ""
    missing_evidence: list[str] = field(default_factory=list)
    contradictions: list[str] = field(default_factory=list)
    recommended_action: str = ""  # claim / no_claim / review / request_evidence
    raw_llm_response: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


# ---------------------------------------------------------------- Evidence Health
@dataclass
class EvidenceRequirement:
    """What evidence is required for a specific charge type."""
    charge_type: str
    required_stages: list[str] = field(default_factory=list)
    required_check_keys: list[str] = field(default_factory=list)
    description: str = ""


@dataclass
class EvidenceHealthResult:
    """Health assessment of evidence for a charge or investigation."""
    charge_id: str
    charge_type: str
    status: str  # SUFFICIENT / INSUFFICIENT / CONFLICTING
    expected_evidence: list[str] = field(default_factory=list)
    available_evidence: list[str] = field(default_factory=list)
    missing_evidence: list[str] = field(default_factory=list)
    conflicting_evidence: list[str] = field(default_factory=list)
    coverage_ratio: float = 0.0
    details: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


# ---------------------------------------------------------------- Evidence Gap
@dataclass
class EvidenceGap:
    """A structured request for missing evidence."""
    gap_id: str = field(default_factory=lambda: f"GAP-{uuid.uuid4().hex[:8]}")
    charge_id: str = ""
    order_id: str = ""
    shipment_id: str = ""
    sku: str = ""
    subject_id: str = ""
    missing_stage: str = ""
    missing_check_keys: list[str] = field(default_factory=list)
    responsible_agent: str = ""
    status: str = "OPEN"  # OPEN / REQUESTED / FILLED / UNFILLABLE
    correlation_id: str = ""
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))
    resolved_at: str | None = None
    resolution_evidence_id: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


# ---------------------------------------------------------------- Investigation Graph
@dataclass
class GraphNode:
    """A node in the investigation graph."""
    node_id: str
    node_type: str  # charge / order / shipment / sku / evidence / assessment / decision
    label: str = ""
    entity_id: str = ""
    data: dict = field(default_factory=dict)
    timestamp: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class GraphEdge:
    """An edge in the investigation graph."""
    source: str
    target: str
    relationship: str  # belongs_to / references / supports / contradicts / produces / consumes
    verified: bool = True  # Must be True; no LLM-guessed relationships
    data: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class InvestigationGraph:
    """The complete investigation graph for a charge/workflow."""
    workflow_id: str
    nodes: list[GraphNode] = field(default_factory=list)
    edges: list[GraphEdge] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "workflow_id": self.workflow_id,
            "nodes": [n.to_dict() for n in self.nodes],
            "edges": [e.to_dict() for e in self.edges],
        }

    def add_node(self, node: GraphNode) -> None:
        if not any(n.node_id == node.node_id for n in self.nodes):
            self.nodes.append(node)

    def add_edge(self, edge: GraphEdge) -> None:
        if not any(e.source == edge.source and e.target == edge.target
                   and e.relationship == edge.relationship for e in self.edges):
            self.edges.append(edge)


# ---------------------------------------------------------------- Timeline
@dataclass
class TimelineEvent:
    """A chronological event in the investigation timeline."""
    timestamp: str
    event_type: str  # charge_posted / evidence_produced / investigation / decision
    stage: str | None = None
    entity_id: str = ""
    description: str = ""
    evidence_id: str | None = None
    data: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class InvestigationTimeline:
    """Chronological timeline of events for an investigation."""
    workflow_id: str
    events: list[TimelineEvent] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "workflow_id": self.workflow_id,
            "events": [e.to_dict() for e in sorted(self.events, key=lambda x: x.timestamp)],
        }

    def add_event(self, event: TimelineEvent) -> None:
        self.events.append(event)


# ---------------------------------------------------------------- Charge Investigation
@dataclass
class ChargeInvestigation:
    """Complete investigation result for a single charge."""
    charge_id: str
    charge_type: str
    amount_usd: float
    subject_id: str
    workflow_id: str
    # Entity resolution
    order_id: str | None = None
    shipment_id: str | None = None
    sku: str | None = None
    # Evidence retrieval
    retrieved_evidence_ids: list[str] = field(default_factory=list)
    # Evidence health
    evidence_health: EvidenceHealthResult | None = None
    # AI reasoning (optional)
    ai_reasoning: AIReasoningOutput | None = None
    # Deterministic position (Phase 1)
    deterministic_verdict: str = "SILENT"
    deterministic_reason: str = ""
    deterministic_evidence_ids: list[str] = field(default_factory=list)
    # Final decision (deterministic validation wins)
    final_verdict: str = "SILENT"
    final_confidence: float = 0.0
    final_reason: str = ""
    decision: str = "NO_CLAIM"  # CLAIM / NO_CLAIM / REVIEW
    # Gaps
    gaps: list[EvidenceGap] = field(default_factory=list)

    def to_dict(self) -> dict:
        d = asdict(self)
        if self.evidence_health:
            d["evidence_health"] = self.evidence_health.to_dict()
        if self.ai_reasoning:
            d["ai_reasoning"] = self.ai_reasoning.to_dict()
        d["gaps"] = [g.to_dict() for g in self.gaps]
        return d


# ---------------------------------------------------------------- Claim Dossier
@dataclass
class ClaimDossier:
    """A structured recovery claim dossier — generated only when deterministic validation confirms support."""
    dossier_id: str = field(default_factory=lambda: f"CLM-{uuid.uuid4().hex[:8]}")
    workflow_id: str = ""
    subject_id: str = ""
    org_id: str = ""
    # Charge info
    charge_id: str = ""
    charge_type: str = ""
    charge_amount_usd: float = 0.0
    # Decision
    decision: str = ""  # CLAIM / NO_CLAIM / REVIEW
    claimable_amount_usd: float = 0.0
    # Evidence
    evidence_ids: list[str] = field(default_factory=list)
    evidence_summary: str = ""
    # Investigation
    timeline_summary: str = ""
    reasoning: str = ""
    confidence: float = 0.0
    # Gaps
    contradictions: list[str] = field(default_factory=list)
    missing_evidence: list[str] = field(default_factory=list)
    recommended_action: str = ""
    # Metadata
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))
    deterministic_validated: bool = False

    def to_dict(self) -> dict:
        return asdict(self)


# ---------------------------------------------------------------- Full Investigation Result
@dataclass
class InvestigationResult:
    """Complete Phase 2 investigation result for a workflow."""
    workflow_id: str
    subject_id: str
    org_id: str
    # Per-charge investigations
    charge_investigations: list[ChargeInvestigation] = field(default_factory=list)
    # Overall
    overall_decision: str = "NO_CLAIM"  # CLAIM / NO_CLAIM / REVIEW
    total_claimable_usd: float = 0.0
    # Graph and timeline
    investigation_graph: InvestigationGraph | None = None
    investigation_timeline: InvestigationTimeline | None = None
    # Claim dossiers (only for confirmed claims)
    claim_dossiers: list[ClaimDossier] = field(default_factory=list)
    # Evidence health summary
    overall_evidence_health: str = "UNKNOWN"
    evidence_gaps: list[EvidenceGap] = field(default_factory=list)
    # AI status
    ai_used: bool = False
    ai_status: str = "UNAVAILABLE"
    # Fallback
    deterministic_fallback_used: bool = False
    # Metadata
    investigated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))

    def to_dict(self) -> dict:
        d = {
            "workflow_id": self.workflow_id,
            "subject_id": self.subject_id,
            "org_id": self.org_id,
            "charge_investigations": [ci.to_dict() for ci in self.charge_investigations],
            "overall_decision": self.overall_decision,
            "total_claimable_usd": self.total_claimable_usd,
            "investigation_graph": self.investigation_graph.to_dict() if self.investigation_graph else None,
            "investigation_timeline": self.investigation_timeline.to_dict() if self.investigation_timeline else None,
            "claim_dossiers": [cd.to_dict() for cd in self.claim_dossiers],
            "overall_evidence_health": self.overall_evidence_health,
            "evidence_gaps": [g.to_dict() for g in self.evidence_gaps],
            "ai_used": self.ai_used,
            "ai_status": self.ai_status,
            "deterministic_fallback_used": self.deterministic_fallback_used,
            "investigated_at": self.investigated_at,
        }
        return d
