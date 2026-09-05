from typing import List, Dict, Any, Optional
from datetime import datetime
from app.agents.perception_agent import perception_agent
from app.agents.safety_agent import safety_agent
from app.agents.risk_agent import risk_agent
from app.agents.analyst_agent import analyst_agent
from app.agents.response_agent import response_agent
from app.api.websocket import manager

class AgentCoordinator:
    """
    Agent Coordinator:
    Orchestrates the multi-agent safety pipeline across:
      Perception -> Safety -> Risk -> Analyst -> Response.
    Streams structured operational decisions to the frontend Agent Transparency Log.
    """
    def __init__(self):
        self.decision_logs: List[Dict[str, Any]] = []

    async def _log_agent_step(self, agent_name: str, action: str, detail: str, severity: str = "info"):
        log_entry = {
            "agent_name": agent_name,
            "action": action,
            "detail": detail,
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "severity": severity
        }
        self.decision_logs.append(log_entry)
        if len(self.decision_logs) > 50:
            self.decision_logs.pop(0)

        # Broadcast agent operational step to clients
        await manager.broadcast({
            "type": "agent_step",
            "log": log_entry
        })

    async def process_frame_event(
        self,
        camera_id: str,
        zone_name: str,
        detections: List[Dict[str, Any]],
        frame = None,
        zone_definitions: List[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        created_incidents = []

        # 1. Perception Agent
        perception = perception_agent.process_observations(camera_id, zone_name, detections, frame)
        await self._log_agent_step(
            "Perception Agent",
            "Normalized Observations",
            f"{camera_id}: {perception['total_workers']} workers, {perception['total_vehicles']} vehicles detected."
        )

        # 2. Safety Agent
        candidate_events = safety_agent.evaluate_rules(camera_id, zone_name, perception, zone_definitions)
        if not candidate_events:
            return []

        for cand in candidate_events:
            event_type = cand["event_type"]
            track_id = cand["track_id"]
            await self._log_agent_step(
                "Safety Agent",
                "Rule Threshold Exceeded",
                f"{event_type.replace('_', ' ').title()} confirmed for {track_id} in {zone_name}.",
                severity="warning"
            )

            # 3. Risk Agent
            assessed = risk_agent.assess_risk(cand)
            score = assessed["risk_score"]
            severity = assessed["severity"]
            await self._log_agent_step(
                "Risk Agent",
                "Risk Score Computed",
                f"Score: {score}/100 [{severity.upper()}] via heuristic multi-factor matrix.",
                severity="high" if score >= 50 else "warning"
            )

            # 4. Analyst Agent (AI summary)
            explanation = await analyst_agent.generate_incident_explanation(
                event_type, zone_name, camera_id, score, severity
            )
            assessed["ai_summary"] = explanation
            await self._log_agent_step(
                "Analyst Agent",
                "Synthesized Incident Brief",
                explanation[:110] + "..."
            )

            # 5. Response Agent
            incident = await response_agent.execute_response(assessed)
            await self._log_agent_step(
                "Response Agent",
                "Interventions Dispatched",
                f"Kiosk warned, evidence generated ({incident.get('evidence_clip_path')}), supervisor notified.",
                severity="critical" if severity == "critical" else "high"
            )

            created_incidents.append(incident)

        return created_incidents

agent_coordinator = AgentCoordinator()
