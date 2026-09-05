import httpx
from typing import Dict, Any, List
from app.config import settings

class AnalystAgent:
    """
    Analyst Agent:
    Leverages Local Ollama LLM (llama3.1) for natural language incident explanations,
    recurring hazard synthesis, and daily safety executive reporting.
    Falls back gracefully to deterministic templates if Ollama is offline.
    """
    def __init__(self):
        self.name = "Analyst Agent"

    async def generate_incident_explanation(
        self,
        event_type: str,
        zone: str,
        camera_id: str,
        risk_score: int,
        severity: str
    ) -> str:
        """
        Generates a concise, professional, industrial OSHA safety explanation.
        """
        prompt = (
            f"You are the AI Safety Officer for a heavy construction site. "
            f"Generate a concise 2-sentence forensic incident explanation for the EHS report:\n"
            f"Incident: {event_type.replace('_', ' ')}\n"
            f"Zone: {zone}\n"
            f"Camera: {camera_id}\n"
            f"Risk Score: {risk_score}/100 ({severity})\n"
            f"State precisely what was detected and the immediate safety risk without filler words."
        )

        if settings.LLM_ENABLED:
            try:
                async with httpx.AsyncClient(timeout=3.0) as client:
                    resp = await client.post(
                        f"{settings.LLM_BASE_URL}/api/generate",
                        json={
                            "model": settings.LLM_MODEL,
                            "prompt": prompt,
                            "stream": False
                        }
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        explanation = data.get("response", "").strip()
                        if explanation:
                            return explanation
            except Exception:
                # LLM offline or slow, proceed to deterministic fallback
                pass

        # Deterministic Industrial Fallback Template
        templates = {
            "vehicle_person_proximity": f"At {zone}, a worker entered the active operating radius of heavy machinery on {camera_id}. Proximity hazard persisted, elevating struck-by collision probability.",
            "no_helmet": f"Worker observed entering {zone} without mandatory head protection. Elevated traumatic impact risk detected under overhead staging.",
            "no_vest": f"Personnel active in {zone} vehicle lane lacking high-visibility apparel, reducing operator line-of-sight visual contrast.",
            "no_harness": f"Worker tracked within 1.0m of elevated perimeter in {zone} without fall-arrest anchorage. Severe fall hazard flagged.",
            "zone_breach": f"Unauthorized track breached physical safety perimeter in {zone}. Live equipment hoisting suspended until clearance.",
            "compound_ppe_violation": f"Multiple critical PPE items missing for worker in {zone}. Compound OSHA non-compliance triggers mandatory stop-work."
        }
        return templates.get(event_type, f"Safety violation observed in {zone} via {camera_id}. Risk assessed at {risk_score}/100.")

analyst_agent = AnalystAgent()
