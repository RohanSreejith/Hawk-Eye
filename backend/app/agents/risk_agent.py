from typing import Dict, Any
from app.risk.risk_engine import risk_engine

class RiskAgent:
    """
    Risk Agent:
    Calculates heuristic risk score (0-100), assigns safety severity tiers,
    and determines actionable OSHA recommendations.
    """
    def __init__(self):
        self.name = "Risk Agent"

    RECOMMENDED_ACTIONS = {
        "no_helmet": "Issue hard hat immediately; halt worker until head protection secured.",
        "no_vest": "Dispatch hi-vis vest to worker; restrict transit in active vehicle lanes.",
        "no_harness": "CRITICAL FALL HAZARD: Order worker off edge/height immediately and hook lifeline.",
        "no_gloves": "Provide cut-resistant work gloves before material handling resumes.",
        "no_boots": "Prohibit entry into heavy machinery corridor without certified safety boots.",
        "no_eye_protection": "Enforce safety goggles before continuing grinding/cutting operation.",
        "compound_ppe_violation": "IMMEDIATE STOP-WORK: Multiple PPE missing. Escort worker to safety staging.",
        "vehicle_person_proximity": "SOUND OPERATOR CAB ALARM: Worker in blindspot. Halt vehicle motion and clear path.",
        "zone_breach": "EVACUATE HAZARD ZONE: Unauthorized personnel in restricted radius.",
    }

    def assess_risk(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        event_type = event_data.get("event_type", "no_helmet")
        zone = event_data.get("zone", "Main Gate")
        prox_factor = event_data.get("proximity_factor", 1.0)
        vehicle_involved = event_data.get("vehicle_involved", False)

        score, severity, breakdown = risk_engine.calculate_risk(
            event_type=event_type,
            zone=zone,
            proximity_factor=prox_factor,
            vehicle_involved=vehicle_involved
        )

        rec_action = self.RECOMMENDED_ACTIONS.get(
            event_type,
            "Halt activity, verify safety protocol, and notify designated site safety steward."
        )

        return {
            **event_data,
            "risk_score": score,
            "severity": severity,
            "recommended_action": rec_action,
            "risk_breakdown": breakdown
        }

risk_agent = RiskAgent()
