import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from app.demo.demo_scenarios import DEMO_SCENARIOS
from app.agents.coordinator import agent_coordinator
from app.database.database import SessionLocal
from app.database.models import Incident, EvidenceClip, Notification
from app.api.websocket import manager

class DemoEngine:
    def __init__(self):
        self.is_running: bool = False
        self._task: Optional[asyncio.Task] = None
        self.current_step: int = 0

    async def trigger_scenario(self, scenario_key: str) -> Dict[str, Any]:
        """
        Executes an instant trigger of a demo scenario through the real agent pipeline.
        """
        scenario = DEMO_SCENARIOS.get(scenario_key)
        if not scenario:
            scenario = DEMO_SCENARIOS["vehicle_proximity"]

        now = datetime.now(timezone.utc)
        event_id = f"evt_{scenario_key[:3]}_{int(now.timestamp() * 1000) % 100000:05d}"

        # Synthesize detection payload for Coordinator
        detections = [
            {
                "label": "person",
                "track_id": scenario["track_id"],
                "confidence": scenario["confidence"],
                "bbox": {"x1": 380, "y1": 220, "x2": 450, "y2": 390}
            }
        ]
        if scenario.get("vehicle_involved"):
            detections.append({
                "label": "truck",
                "track_id": "VEHICLE_004",
                "confidence": 0.96,
                "bbox": {"x1": 490, "y1": 200, "x2": 670, "y2": 380}
            })

        print(f"[DEMO ENGINE] Triggering full pipeline for: {scenario['title']}")

        # Feed directly through Agent Coordinator
        incidents = await agent_coordinator.process_frame_event(
            camera_id=scenario["camera_id"],
            zone_name=scenario["zone"],
            detections=detections,
            frame=None,
            zone_definitions=[{"name": scenario["zone"], "type": "restricted" if "breach" in scenario_key else "standard"}]
        )

        if incidents:
            return incidents[0]

        # If deduplication caught it or needs direct injection:
        from app.agents.risk_agent import risk_agent
        from app.agents.response_agent import response_agent
        from app.agents.analyst_agent import analyst_agent

        assessed = risk_agent.assess_risk({
            "event_id": event_id,
            "camera_id": scenario["camera_id"],
            "zone": scenario["zone"],
            "event_type": scenario["event_type"],
            "track_id": scenario["track_id"],
            "proximity_factor": scenario.get("proximity_factor", 1.2),
            "vehicle_involved": scenario.get("vehicle_involved", False),
            "description": scenario["description"]
        })
        assessed["ai_summary"] = await analyst_agent.generate_incident_explanation(
            scenario["event_type"], scenario["zone"], scenario["camera_id"], assessed["risk_score"], assessed["severity"]
        )
        return await response_agent.execute_response(assessed)

    async def _run_loop(self):
        keys = ["no_helmet", "vehicle_proximity", "zone_breach", "no_harness", "compound_ppe"]
        idx = 0
        try:
            while self.is_running:
                await self.trigger_scenario(keys[idx % len(keys)])
                idx += 1
                await asyncio.sleep(18)
        except asyncio.CancelledError:
            self.is_running = False

    def start_loop(self):
        if not self.is_running:
            self.is_running = True
            self._task = asyncio.create_task(self._run_loop())
            print("[DEMO ENGINE] Automated simulation loop started.")

    def stop_loop(self):
        self.is_running = False
        if self._task and not self._task.done():
            self._task.cancel()
        print("[DEMO ENGINE] Automated simulation loop stopped.")

    def clear_incidents(self):
        db = SessionLocal()
        try:
            db.query(Notification).delete()
            db.query(EvidenceClip).delete()
            db.query(Incident).delete()
            db.commit()
            print("[DEMO ENGINE] Cleared all incidents from database.")
        finally:
            db.close()

demo_engine = DemoEngine()
