from app.models.entities import Charge

class ClaimCalculationService:
    @staticmethod
    def calculate_claim_amount(charge: Charge, verdict: str) -> float:
        """
        Rules from Master Build Prompt (Section 8):
        - A claim may only be generated when evidence supports a defensible conclusion.
        - Claim amount must come directly from the charge.
        - Never invent or modify monetary values.
        - SILENT -> claim amount = 0.
        - SUPPORTED -> fee is supported/valid -> claim amount = 0.
        - CONTRADICTED -> fee is contradicted by evidence -> defensible claim amount = charge.amount.
        - Preserve currency.
        """
        if verdict == "CONTRADICTED":
            return round(float(charge.amount), 2)
        elif verdict == "SUPPORTED":
            return 0.0
        elif verdict == "SILENT":
            return 0.0
        else:
            return 0.0
