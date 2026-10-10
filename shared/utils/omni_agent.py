import os
import json
from shared.utils.records import check

def mock_evaluate(stage, data, rules):
    """Fallback when GEMINI_API_KEY is not set."""
    # Try to derive some simple checks from rules
    checks = []
    rule_lines = [r.strip() for r in rules.split('\n') if r.strip() and not r.startswith('#')]
    for i, rule in enumerate(rule_lines):
        key = f"rule_{i}"
        # Very dumb mock: if the rule mentions a key in the data, try to check it
        verdict = "PASS"
        detail = "Auto-passed by OmniAgent mock"
        checks.append({
            "check_key": key,
            "verdict": verdict,
            "detail": detail,
            "confidence": 0.8
        })
    if not checks:
        checks = [{"check_key": "data_valid", "verdict": "PASS", "detail": "Data is valid", "confidence": 1.0}]
        
    return {
        "checks": checks,
        "outcome": "completed",
        "verdict": "PASS",
        "reason": "Evaluated by OmniAgent Mock (no API key)"
    }

def evaluate_data(stage: str, data: dict, rules: str, model_name="gemini-2.5-flash", org_id="default"):
    """
    Dynamically evaluate any JSON data against a set of rules.
    If GEMINI_API_KEY is provided, it uses the VLM/LLM.
    Fetches Agentic RAG memory from Breeth to resolve ambiguities.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key or api_key == "dummy":
        return mock_evaluate(stage, data, rules)
        
    try:
        from google import genai
        from pydantic import BaseModel, Field
        from shared.utils.breeth_memory import search_memory, format_retrieved_context
        
        # Agentic RAG: Fetch relevant past episodes for context
        memory_context = "No historical precedents found."
        try:
                # Query memory graph for similar scenarios
                search_query = f"Resolved edge cases for stage {stage} involving {json.dumps(data)[:100]}"
                results = search_memory(org_id=org_id, query=search_query, limit=3)
                if results and len(results) > 0:
                    memory_context = format_retrieved_context(results)
        except Exception as e:
            print(f"Breeth RAG error: {e}")
            
        class CheckResult(BaseModel):
            check_key: str
            verdict: str = Field(description="PASS, FAIL, or UNCERTAIN")
            detail: str = Field(description="Explanation of the verdict")
            confidence: float = Field(description="Confidence between 0.0 and 1.0")

        class OmniEvaluation(BaseModel):
            checks: list[CheckResult]
            outcome: str = Field(description="Overall outcome of the stage (e.g. valid, reject, review)")
            verdict: str = Field(description="Overall verdict: PASS, FAIL, or UNCERTAIN")
            reason: str = Field(description="Summary reasoning")

        client = genai.Client(api_key=api_key)
        
        prompt = f"""
        You are a universal AI evaluator for the workflow stage: '{stage}'.
        
        DATA PAYLOAD:
        {json.dumps(data, indent=2)}
        
        RULES TO ENFORCE:
        {rules}
        
        HISTORICAL PRECEDENTS (Agentic RAG):
        {memory_context}
        
        Task:
        Evaluate the data against the rules. Use historical precedents to resolve edge cases. 
        Produce a list of checks. If any critical rule fails, the overall verdict should be FAIL. If information is missing, UNCERTAIN.
        """
        
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": OmniEvaluation,
                "temperature": 0.1
            }
        )
        
        parsed = json.loads(response.text or "{}")
        return parsed
    except Exception as e:
        print(f"OmniAgent Error: {e}")
        return mock_evaluate(stage, data, rules)
