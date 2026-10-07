import json
import logging
from typing import List, Dict, Any, Optional, Callable
import httpx

from app.config import settings
from app.schemas.ai import AIReasoningOutput

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are RecoveryOS AI, an expert operational recovery and dispute reasoning agent.
Your objective is to evaluate a merchant fulfillment charge against actual warehouse/fulfillment evidence records.

Rules:
1. Verdict MUST be one of:
   - "SUPPORTED": The verified evidence confirms the defect/charge reported (e.g. FAIL/DAMAGED/DISCREPANCY logged before handoff).
   - "CONTRADICTED": Reliable verified evidence conflicts with the charge (e.g. Packaging PASS, compliant weight, intact seal).
   - "SILENT": Evidence is missing, incomplete, conflicting, or inconclusive. If uncertain, you MUST choose SILENT.
2. Grounding: You may ONLY reference evidence_ids that are explicitly provided in the verified evidence list. NEVER invent, fabricate, or hallucinate evidence_ids, timestamps, or sources.
3. Claim Amount:
   - If CONTRADICTED: set claim_amount to the full charge amount.
   - If SUPPORTED or SILENT: claim_amount MUST be 0.0.
4. Output must be strictly valid JSON matching this schema:
{
  "verdict": "SUPPORTED | CONTRADICTED | SILENT",
  "reason": "Detailed evidence-backed explanation referencing specific evidence_ids",
  "claim_amount": 0.0,
  "evidence_ids": ["EV-..."],
  "evidence_strength": "STRONG | MODERATE | WEAK | INSUFFICIENT",
  "missing_information": []
}
"""

class LLMService:
    # Testing hook to allow injecting mock responses in automated tests
    _mock_provider: Optional[Callable[[Dict[str, Any], List[Dict[str, Any]]], Optional[str]]] = None
    _circuit_broken: bool = False

    @classmethod
    def set_mock_provider(cls, mock_func: Optional[Callable[[Dict[str, Any], List[Dict[str, Any]]], Optional[str]]]):
        cls._mock_provider = mock_func

    @classmethod
    def is_available(cls) -> bool:
        if cls._mock_provider is not None:
            return True
        if cls._circuit_broken:
            return False
        return bool(settings.LLM_API_KEY and settings.LLM_API_KEY.strip())

    @classmethod
    def reset_circuit(cls):
        cls._circuit_broken = False

    @classmethod
    def reason_over_evidence(
        cls,
        charge_info: Dict[str, Any],
        evidence_records: List[Dict[str, Any]],
        charge_understanding: Optional[Dict[str, Any]] = None
    ) -> Optional[AIReasoningOutput]:
        """
        Sends structured charge and verified evidence to the LLM.
        Returns parsed AIReasoningOutput or None if unavailable / malformed.
        """
        # If test mock provider is active, use it
        if cls._mock_provider is not None:
            try:
                raw_text = cls._mock_provider(charge_info, evidence_records)
                if not raw_text:
                    return None
                data = json.loads(raw_text)
                return AIReasoningOutput.model_validate(data)
            except Exception as e:
                logger.warning(f"Mock LLM failed/malformed: {e}")
                return None

        # Check API key configuration or broken circuit
        if not cls.is_available():
            return None

        # Format user prompt with verified database facts
        user_content = {
            "charge": charge_info,
            "domain_understanding": charge_understanding,
            "verified_evidence_records": evidence_records
        }

        try:
            base_url = settings.LLM_BASE_URL or "https://api.openai.com/v1"
            endpoint = f"{base_url.rstrip('/')}/chat/completions"

            headers = {
                "Authorization": f"Bearer {settings.LLM_API_KEY}",
                "Content-Type": "application/json"
            }

            payload = {
                "model": settings.LLM_MODEL,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": json.dumps(user_content, indent=2)}
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.0
            }

            with httpx.Client(timeout=3.0) as client:
                res = client.post(endpoint, headers=headers, json=payload)
                if res.status_code != 200:
                    cls._circuit_broken = True
                    logger.warning(f"LLM API returned status {res.status_code}: {res.text}. Circuit tripped.")
                    return None

                result_json = res.json()
                content = result_json["choices"][0]["message"]["content"]
                parsed = json.loads(content)
                return AIReasoningOutput.model_validate(parsed)

        except Exception as e:
            cls._circuit_broken = True
            logger.warning(f"LLM call failed with error: {e}. Circuit tripped, falling back to deterministic safety engine.")
            return None
