import math
import re
from typing import List, Dict, Any, Optional, Tuple
from collections import Counter
from sqlalchemy.orm import Session
from app.models.entities import Evidence

def tokenize(text: str) -> List[str]:
    clean = re.sub(r"[^\w\s-]", " ", text.lower())
    words = clean.split()
    tokens = []
    for w in words:
        if len(w) > 1:
            tokens.append(w)
    return tokens

class VectorRetrievalService:
    _index: Dict[str, Dict[str, Any]] = {}
    _is_indexed: bool = False

    @classmethod
    def index_evidence(cls, db: Session) -> int:
        """
        Builds or refreshes the in-memory semantic vector index from the relational evidence store.
        Every indexed record preserves evidence_id, source, timestamp, and metadata.
        """
        records = db.query(Evidence).all()
        cls._index.clear()
        
        for ev in records:
            # Build representative document text
            doc_text = f"{ev.evidence_type} {ev.result} {ev.description} {ev.source} {ev.sku or ''}"
            tokens = tokenize(doc_text)
            term_freq = Counter(tokens)
            magnitude = math.sqrt(sum(count ** 2 for count in term_freq.values())) or 1.0

            cls._index[ev.evidence_id] = {
                "evidence_id": ev.evidence_id,
                "evidence_type": ev.evidence_type,
                "result": ev.result,
                "description": ev.description,
                "source": ev.source,
                "timestamp": ev.timestamp,
                "shipment_id": ev.shipment_id,
                "order_id": ev.order_id,
                "sku": ev.sku,
                "term_freq": term_freq,
                "magnitude": magnitude
            }

        cls._is_indexed = True
        return len(cls._index)

    @classmethod
    def semantic_search(
        cls,
        query: str,
        evidence_pool: Optional[List[Evidence]] = None,
        top_k: int = 5,
        min_score: float = 0.05
    ) -> List[Tuple[Evidence, float]]:
        """
        Ranks candidate evidence records against a query (e.g. charge reason)
        using vector space cosine similarity over term frequencies.
        Preserves all relational attributes.
        """
        if not query or not evidence_pool:
            return [(ev, 1.0) for ev in (evidence_pool or [])[:top_k]]

        query_tokens = tokenize(query)
        if not query_tokens:
            return [(ev, 1.0) for ev in evidence_pool[:top_k]]

        query_tf = Counter(query_tokens)
        query_mag = math.sqrt(sum(count ** 2 for count in query_tf.values())) or 1.0

        scored_candidates: List[Tuple[Evidence, float]] = []

        for ev in evidence_pool:
            doc_text = f"{ev.evidence_type} {ev.result} {ev.description} {ev.source} {ev.sku or ''}"
            doc_tf = Counter(tokenize(doc_text))
            doc_mag = math.sqrt(sum(count ** 2 for count in doc_tf.values())) or 1.0

            # Compute dot product
            dot = sum(query_tf[term] * doc_tf[term] for term in query_tf if term in doc_tf)
            cosine_sim = dot / (query_mag * doc_mag)

            # Boost if evidence result matches charge keywords (e.g., packaging pass vs packaging defect)
            boost = 0.0
            r_upper = ev.result.upper()
            if any(term in doc_text.lower() for term in query_tokens):
                boost += 0.15
            if r_upper in {"PASS", "VERIFIED", "FAIL", "DAMAGED"}:
                boost += 0.1

            final_score = round(cosine_sim + boost, 4)
            scored_candidates.append((ev, final_score))

        # Sort descending by score
        scored_candidates.sort(key=lambda x: x[1], reverse=True)
        return scored_candidates[:top_k]

    @classmethod
    def get_index_status(cls, db: Optional[Session] = None) -> Dict[str, Any]:
        count = len(cls._index)
        if not cls._is_indexed and db is not None:
            count = cls.index_evidence(db)
        return {
            "status": "ready" if cls._is_indexed or count > 0 else "empty",
            "indexed_count": count
        }
