import json
import os
import sqlite3
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "storage" / "returns_manager.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://xemrtvawehbbbcsovick.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_JWT_KEY", "")


def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initializes local SQLite database tables with complete audit and evaluation tracking."""
    with get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS inspections (
                id TEXT PRIMARY KEY,
                return_id TEXT NOT NULL,
                order_id TEXT NOT NULL,
                product_name TEXT,
                sku TEXT,
                serial_number TEXT,
                final_outcome TEXT NOT NULL,
                condition_grade TEXT,
                overall_confidence REAL,
                is_uncertain INTEGER DEFAULT 0,
                reason TEXT,
                model_version TEXT,
                processing_time_ms INTEGER,
                created_at TEXT DEFAULT (datetime('now')),
                raw_payload TEXT
            );

            CREATE TABLE IF NOT EXISTS condition_checks (
                id TEXT PRIMARY KEY,
                inspection_id TEXT,
                check_name TEXT NOT NULL,
                result TEXT NOT NULL,
                confidence REAL NOT NULL,
                details TEXT,
                evidence TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
                id TEXT PRIMARY KEY,
                inspection_id TEXT,
                action TEXT NOT NULL,
                actor TEXT NOT NULL,
                outcome TEXT,
                notes TEXT,
                timestamp TEXT DEFAULT (datetime('now')),
                metadata TEXT
            );

            CREATE TABLE IF NOT EXISTS evaluation_metrics (
                id TEXT PRIMARY KEY,
                suite_name TEXT NOT NULL,
                total_samples INTEGER NOT NULL,
                accuracy REAL NOT NULL,
                false_positives INTEGER NOT NULL,
                false_negatives INTEGER NOT NULL,
                uncertain_count INTEGER NOT NULL,
                uncertain_rate REAL NOT NULL,
                avg_latency_ms REAL NOT NULL,
                created_at TEXT DEFAULT (datetime('now')),
                summary TEXT
            );
            """
        )
        conn.commit()


def _supabase_request(table: str, method: str = "POST", data: Optional[Dict] = None, params: str = "") -> Optional[Any]:
    """Helper to perform REST calls to Supabase if configured."""
    if not (SUPABASE_URL and SUPABASE_KEY):
        return None
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/{table}{params}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    payload_bytes = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=payload_bytes, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            content = response.read()
            return json.loads(content) if content else {}
    except Exception as e:
        # Gracefully handle when table isn't created in remote Supabase yet or network is slow
        return None


def save_inspection_record(record: Dict[str, Any]) -> str:
    """Stores full structured decision flow and condition checks into SQLite and attempts Supabase sync."""
    init_db()
    insp_id = record.get("id")
    now_iso = datetime.now(timezone.utc).isoformat()

    # 1. Local SQLite store
    with get_db() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO inspections (
                id, return_id, order_id, product_name, sku, serial_number,
                final_outcome, condition_grade, overall_confidence, is_uncertain,
                reason, model_version, processing_time_ms, created_at, raw_payload
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                insp_id,
                record.get("returnId", ""),
                record.get("orderId", ""),
                record.get("productName", ""),
                record.get("sku", ""),
                record.get("serialNumber", ""),
                record.get("finalOutcome", "FURTHER_INSPECTION"),
                record.get("conditionGrade", "GRADE_B"),
                float(record.get("overallConfidence", 0.0)),
                1 if record.get("isUncertain") else 0,
                record.get("reason", ""),
                record.get("modelVersion", "returns-manager-agent:v2.1"),
                int(record.get("processingTimeMs", 0)),
                now_iso,
                json.dumps(record)
            )
        )

        for check in record.get("conditionChecks", []):
            conn.execute(
                """
                INSERT OR REPLACE INTO condition_checks (
                    id, inspection_id, check_name, result, confidence, details, evidence, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    f"{insp_id}_{check.get('name')}",
                    insp_id,
                    check.get("name", ""),
                    check.get("result", "UNCERTAIN"),
                    float(check.get("confidence", 0.0)),
                    check.get("details", ""),
                    json.dumps(check.get("evidence", [])),
                    now_iso
                )
            )

        conn.execute(
            """
            INSERT INTO audit_logs (id, inspection_id, action, actor, outcome, notes, timestamp, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                f"audit_{insp_id}_{int(datetime.now().timestamp())}",
                insp_id,
                "DECISION_RECORDED",
                record.get("operator", "ReturnsManagerAgent"),
                record.get("finalOutcome", "FURTHER_INSPECTION"),
                record.get("reason", ""),
                now_iso,
                json.dumps({"confidence": record.get("overallConfidence"), "modelVersion": record.get("modelVersion")})
            )
        )
        conn.commit()

    # 2. Sync to Supabase
    try:
        supabase_payload = {
            "id": insp_id,
            "return_id": record.get("returnId", ""),
            "order_id": record.get("orderId", ""),
            "product_name": record.get("productName", ""),
            "sku": record.get("sku", ""),
            "serial_number": record.get("serialNumber", ""),
            "final_outcome": record.get("finalOutcome", "FURTHER_INSPECTION"),
            "condition_grade": record.get("conditionGrade", ""),
            "overall_confidence": float(record.get("overallConfidence", 0.0)),
            "is_uncertain": bool(record.get("isUncertain")),
            "reason": record.get("reason", ""),
            "model_version": record.get("modelVersion", "returns-manager-agent:v2.1"),
            "processing_time_ms": int(record.get("processingTimeMs", 0)),
            "raw_payload": record
        }
        _supabase_request("inspections", method="POST", data=supabase_payload)
    except Exception:
        pass

    return insp_id


def get_inspections(limit: int = 50) -> List[Dict[str, Any]]:
    init_db()
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM inspections ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
        return [dict(r) for r in rows]


def get_inspection_details(insp_id: str) -> Optional[Dict[str, Any]]:
    init_db()
    with get_db() as conn:
        row = conn.execute("SELECT * FROM inspections WHERE id = ?", (insp_id,)).fetchone()
        if not row:
            return None
        checks = conn.execute("SELECT * FROM condition_checks WHERE inspection_id = ?", (insp_id,)).fetchall()
        logs = conn.execute("SELECT * FROM audit_logs WHERE inspection_id = ?", (insp_id,)).fetchall()
        data = dict(row)
        data["conditionChecks"] = [dict(c) for c in checks]
        data["auditLogs"] = [dict(l) for l in logs]
        if data.get("raw_payload"):
            try:
                data["raw_payload"] = json.loads(data["raw_payload"])
            except Exception:
                pass
        return data


def save_evaluation_metrics(metrics: Dict[str, Any]) -> str:
    init_db()
    eval_id = metrics.get("id") or f"eval_{int(datetime.now().timestamp())}"
    now_iso = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO evaluation_metrics (
                id, suite_name, total_samples, accuracy, false_positives, false_negatives,
                uncertain_count, uncertain_rate, avg_latency_ms, created_at, summary
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                eval_id,
                metrics.get("suiteName", "50_unseen_returns_eval"),
                int(metrics.get("totalSamples", 50)),
                float(metrics.get("accuracy", 0.0)),
                int(metrics.get("falsePositives", 0)),
                int(metrics.get("falseNegatives", 0)),
                int(metrics.get("uncertainCount", 0)),
                float(metrics.get("uncertainRate", 0.0)),
                float(metrics.get("avgLatencyMs", 0.0)),
                now_iso,
                json.dumps(metrics)
            )
        )
        conn.commit()

    try:
        _supabase_request("evaluation_metrics", method="POST", data={
            "id": eval_id,
            "suite_name": metrics.get("suiteName", "50_unseen_returns_eval"),
            "total_samples": int(metrics.get("totalSamples", 50)),
            "accuracy": float(metrics.get("accuracy", 0.0)),
            "false_positives": int(metrics.get("falsePositives", 0)),
            "false_negatives": int(metrics.get("falseNegatives", 0)),
            "uncertain_count": int(metrics.get("uncertainCount", 0)),
            "uncertain_rate": float(metrics.get("uncertainRate", 0.0)),
            "avg_latency_ms": float(metrics.get("avgLatencyMs", 0.0)),
            "summary": metrics
        })
    except Exception:
        pass

    return eval_id


def get_latest_evaluation() -> Optional[Dict[str, Any]]:
    init_db()
    with get_db() as conn:
        row = conn.execute("SELECT * FROM evaluation_metrics ORDER BY created_at DESC LIMIT 1").fetchone()
        if not row:
            return None
        res = dict(row)
        if res.get("summary"):
            try:
                res["summary"] = json.loads(res["summary"])
            except Exception:
                pass
        return res
