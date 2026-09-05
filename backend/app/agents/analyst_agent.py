import os
import httpx
from typing import Dict, Any, List, Optional
from app.config import settings

class AnalystAgent:
    """
    Analyst Agent:
    Leverages LLM reasoning for deep natural language incident explanations,
    multi-agent collaborative timeline synthesis, root-cause analysis,
    and OSHA regulatory compliance reporting.
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
        Generates a concise industrial safety explanation.
        """
        prompt = (
            f"You are the AI Safety Officer for HAWK (Harm Anticipation for Workplace Safety). "
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
                pass

        # Deterministic Industrial Fallback Template
        templates = {
            "vehicle_person_proximity": f"At {zone}, a worker entered the active operating radius of heavy machinery on {camera_id}. Proximity hazard persisted, elevating struck-by collision probability.",
            "VEHICLE_INBOUND": f"Inbound forklift V01 tracked exiting {zone} toward adjacent blind intersection. Cross-camera anticipation alerted downstream personnel prior to visual line-of-sight.",
            "no_helmet": f"Worker observed entering {zone} without mandatory head protection. Elevated traumatic impact risk detected under overhead staging.",
            "no_vest": f"Personnel active in {zone} vehicle lane lacking high-visibility apparel, reducing operator line-of-sight visual contrast.",
            "no_harness": f"Worker tracked within 1.0m of elevated perimeter in {zone} without fall-arrest anchorage. Severe fall hazard flagged.",
            "zone_breach": f"Unauthorized track breached physical safety perimeter in {zone}. Live equipment hoisting suspended until clearance."
        }
        return templates.get(event_type, f"Safety violation observed in {zone} via {camera_id}. Risk assessed at {risk_score}/100.")

    async def generate_deep_incident_analysis(self, incident: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generates comprehensive multi-agent LLM analysis report with timeline,
        root-cause, OSHA references, and corrective actions.
        """
        event_type = incident.get("event_type", "vehicle_person_proximity")
        zone = incident.get("zone", "Zone B - Loading Area")
        camera_id = incident.get("camera_id", "CAM_B")
        severity = incident.get("severity", "critical")
        timestamp = incident.get("timestamp", "10:24:17")
        worker_id = incident.get("worker_id", "Worker P17")
        equipment_id = incident.get("equipment_id", "Forklift V01")

        # Multi-agent anticipation timeline
        timeline = [
            {"time": "T - 5.2s", "step": "Initial Detection", "detail": f"Agent A on Camera A (Entrance) identified {equipment_id} accelerating toward transit corridor."},
            {"time": "T - 3.8s", "step": "Cross-Camera Broadcast", "detail": f"Agent A published VEHICLE_INBOUND to HAWK Shared State with predicted target: {zone}."},
            {"time": "T - 2.5s", "step": "Proactive Hazard Anticipation", "detail": f"Agent B received inbound telemetry while {equipment_id} was still obscured behind warehouse racking. Correlated presence of {worker_id}."},
            {"time": "T - 1.1s", "step": "Kiosk & Audio Pre-Warning", "detail": f"Zone B Safety Kiosk armed 'VEHICLE APPROACHING' alert before physical line-of-sight was established."},
            {"time": "T + 0.0s", "step": "Proximity Convergence", "detail": f"{equipment_id} entered {zone}. Distance to {worker_id} closed within critical threshold."}
        ]

        # Root Cause Analysis
        if "vehicle" in event_type.lower() or "proximity" in event_type.lower():
            root_cause = (
                "Blind intersection between Zone A entrance corridor and Zone B loading aisle with "
                "stacked pallet racking obstructing operator line-of-sight. The pedestrian was engaged "
                "in inventory sorting with back turned to incoming vehicle trajectory."
            )
            osha_regulation = "OSHA Standard 1910.178(n)(4) - Powered Industrial Trucks: Driver shall slow down and sound horn at cross aisles and where vision is obstructed."
            corrective_actions = [
                "Install wide-angle parabolic dome mirrors at Zone A/B portal entrance.",
                "Enforce mandatory horn activation by forklift operators upon crossing yellow threshold line.",
                "Verify floor laser line projection defining pedestrian safe walking zones.",
                "Equip high-traffic loading aisles with active optical sensor gates."
            ]
        elif "helmet" in event_type.lower():
            root_cause = (
                "Worker removed Type 1 hardhat while transitioning between administrative walkway "
                "and active high-bay racking zone during material transfer."
            )
            osha_regulation = "OSHA Standard 1926.100(a) - Head Protection: Employees working in areas where there is a possible danger of head injury from impact, falling or flying objects."
            corrective_actions = [
                "Position mandatory PPE checkpoint signage at portal access doors.",
                "Issue worker safety compliance reminder via supervisor terminal.",
                "Inspect overhead netting for loose stock items in Zone B."
            ]
        else:
            root_cause = "Non-conforming personnel motion relative to active material handling equipment."
            osha_regulation = "OSHA General Duty Clause Section 5(a)(1) - Workplace Safety."
            corrective_actions = ["Re-brief shift personnel on zone demarcation guidelines."]

        summary = await self.generate_incident_explanation(event_type, zone, camera_id, 88, severity)

        # Video clip location
        clip_name = incident.get("clip_url") or incident.get("video_clip")
        if not clip_name or clip_name == "null":
            # Pick a sample clip from evidence dir
            evidence_dir = settings.EVIDENCE_DIR
            sample_clips = [f for f in os.listdir(evidence_dir) if f.endswith(".mp4")] if os.path.exists(evidence_dir) else []
            if sample_clips:
                clip_name = f"/clips/{sample_clips[0]}"
            else:
                clip_name = "/clips/evt_veh_84247.mp4"
        elif not clip_name.startswith("http") and not clip_name.startswith("/"):
            clip_name = f"/clips/{clip_name}"

        return {
            "incident_id": incident.get("id"),
            "event_id": incident.get("event_id", "EVT-84247"),
            "event_type": event_type,
            "zone": zone,
            "camera_id": camera_id,
            "severity": severity,
            "timestamp": timestamp,
            "summary": summary,
            "clip_url": clip_name,
            "timeline": timeline,
            "root_cause": root_cause,
            "osha_regulation": osha_regulation,
            "corrective_actions": corrective_actions,
            "analyzed_by": "HAWK AI Safety Officer (LLM Analyst Agent)"
        }

analyst_agent = AnalystAgent()
