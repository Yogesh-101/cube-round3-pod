"""Where workflow state and evidence live. Two implementations of one tiny interface.

MemoryStore: tests and library use. FileStore: the CLI and API (JSON files under out/).
Swap in a database by implementing the same four methods. Evidence is IMMUTABLE: a record_id, once written,
can only be written again with identical content.
"""
from __future__ import annotations

import json
import os
from pathlib import Path


class EvidenceConflict(Exception):
    pass


class MemoryStore:
    def __init__(self) -> None:
        self.workflows: dict[str, dict] = {}
        self.evidence: dict[str, dict] = {}

    def load_workflow(self, workflow_id: str) -> dict | None:
        wf = self.workflows.get(workflow_id)
        return json.loads(json.dumps(wf)) if wf else None

    def save_workflow(self, wf: dict) -> None:
        self.workflows[wf["workflow_id"]] = json.loads(json.dumps(wf))

    def get_evidence(self, record_id: str) -> dict | None:
        return self.evidence.get(record_id)

    def put_evidence(self, record: dict) -> None:
        existing = self.evidence.get(record["record_id"])
        if existing and existing["content_hash"] != record["content_hash"]:
            raise EvidenceConflict(f"{record['record_id']} already exists with different content; evidence is immutable")
        self.evidence.setdefault(record["record_id"], record)


class FileStore(MemoryStore):
    def __init__(self, root: str | Path | None = None) -> None:
        super().__init__()
        self.root = Path(root or os.environ.get("OUT_DIR", "out"))
        try:
            (self.root / "workflows").mkdir(parents=True, exist_ok=True)
            (self.root / "evidence").mkdir(parents=True, exist_ok=True)
        except OSError:
            # Serverless environments (Vercel) have read-only filesystems except /tmp
            self.root = Path("/tmp/out")
            (self.root / "workflows").mkdir(parents=True, exist_ok=True)
            (self.root / "evidence").mkdir(parents=True, exist_ok=True)

        self._seed_default_workflows()

    def _seed_default_workflows(self) -> None:
        """Seed pre-computed demo workflows if the directory is empty on a fresh deployment."""
        workflows_dir = self.root / "workflows"
        if workflows_dir.exists() and any(workflows_dir.glob("*.json")):
            return

        candidates = [
            Path(__file__).resolve().parent.parent / "web" / "src" / "data" / "embeddedWorkflows.json",
            Path("web/src/data/embeddedWorkflows.json"),
        ]
        for candidate in candidates:
            if candidate.is_file():
                try:
                    data = json.loads(candidate.read_text(encoding="utf-8"))
                    for wf in data:
                        wf_id = wf.get("workflow_id")
                        if wf_id:
                            (workflows_dir / f"{wf_id}.json").write_text(json.dumps(wf, indent=2))
                    break
                except Exception:
                    pass

    def load_workflow(self, workflow_id: str) -> dict | None:
        p = self.root / "workflows" / f"{workflow_id}.json"
        return json.loads(p.read_text()) if p.exists() else None

    def save_workflow(self, wf: dict) -> None:
        p = self.root / "workflows" / f"{wf['workflow_id']}.json"
        tmp = p.with_suffix(".tmp")
        tmp.write_text(json.dumps(wf, indent=2))
        tmp.replace(p)  # atomic: a crash never leaves half a workflow

    def get_evidence(self, record_id: str) -> dict | None:
        p = self.root / "evidence" / f"{record_id}.json"
        return json.loads(p.read_text()) if p.exists() else None

    def put_evidence(self, record: dict) -> None:
        existing = self.get_evidence(record["record_id"])
        if existing and existing["content_hash"] != record["content_hash"]:
            raise EvidenceConflict(f"{record['record_id']} already exists with different content; evidence is immutable")
        if not existing:
            (self.root / "evidence" / f"{record['record_id']}.json").write_text(json.dumps(record, indent=2))
