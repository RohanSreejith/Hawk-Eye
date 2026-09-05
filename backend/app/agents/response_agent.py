import asyncio
from typing import Dict, Any
from datetime import datetime, timezone
from app.evidence.clip_generator import clip_generator
from app.notifications.demo import notification_router
from app.database.database import SessionLocal
from app.database.models import Incident, EvidenceClip, Notification
from app.api.websocket import manager

class ResponseAgent:
    """
    Response Agent:
    Translates assessed risk into tangible real-world safety interventions:
      1. Site Kiosk Alarm (visual + SpeechSynthesis audio trigger)
      2. Supervisor Mobile Escalation (for HIGH / CRITICAL alerts)
      3. 10-second Forensic Video Evidence Generation
      4. Database Persistence & WebSocket Event Broadcast
    """
    def __init__(self):
        self.name = "Response Agent"

    async def execute_response(self, assessed_incident: Dict[str, Any]) -> Dict[str, Any]:
        event_id = assessed_incident.get("event_id") or f"evt_{int(datetime.now().timestamp() * 1000) % 100000:05d}"
        camera_id = assessed_incident.get("camera_id", "CAM_02")
        zone = assessed_incident.get("zone", "Loading Zone")
        event_type = assessed_incident.get("event_type", "vehicle_person_proximity")
        severity = assessed_incident.get("severity", "high")
        risk_score = assessed_incident.get("risk_score", 75)
        description = assessed_incident.get("description", "Safety incident detected.")
        rec_action = assessed_incident.get("recommended_action", "Clear hazard area.")
        ai_summary = assessed_incident.get("ai_summary") or f"Safety hazard detected in {zone}. Risk index: {risk_score}/100."
        now_dt = datetime.now(timezone.utc)

        # 1. Generate 10-second evidence clip asynchronously in threadpool
        clip_path = await asyncio.to_thread(
            clip_generator.generate_clip,
            event_id=event_id,
            camera_id=camera_id,
            event_type=event_type,
            severity=severity,
            risk_score=risk_score
        )

        # 2. Persist Incident into Database
        db = SessionLocal()
        try:
            db_incident = Incident(
                event_id=event_id,
                camera_id=camera_id,
                site_id="SITE_01",
                zone=zone,
                event_type=event_type,
                severity=severity,
                confidence=0.92,
                risk_score=risk_score,
                timestamp=now_dt,
                description=description,
                recommended_action=rec_action,
                ai_summary=ai_summary,
                status="open"
            )
            db.add(db_incident)
            db.flush()

            # Record Evidence Clip
            db_clip = EvidenceClip(
                incident_id=event_id,
                path=clip_path,
                duration=10.0,
                start_time=now_dt,
                end_time=now_dt
            )
            db.add(db_clip)

            # Record Notification if Warning, High or Critical
            if severity in ["high", "critical", "warning"]:
                db_notif = Notification(
                    incident_id=event_id,
                    channel="mobile_supervisor",
                    recipient="Site Supervisor (SMS)",
                    status="sent",
                    sent_at=now_dt
                )
                db.add(db_notif)

            db.commit()
            db.refresh(db_incident)
            db_id = db_incident.id
        finally:
            db.close()

        incident_payload = {
            "id": db_id,
            "event_id": event_id,
            "camera_id": camera_id,
            "site_id": "SITE_01",
            "zone": zone,
            "event_type": event_type,
            "severity": severity,
            "confidence": 0.92,
            "risk_score": risk_score,
            "timestamp": now_dt.isoformat(),
            "description": description,
            "recommended_action": rec_action,
            "ai_summary": ai_summary,
            "evidence_clip_path": clip_path,
            "status": "open"
        }

        # 3. Dispatch Supervisor Alert (SMS / Mobile / Real Twilio)
        from app.services.settings_service import settings_service
        cfg = settings_service.get()
        should_alert = (severity in ["critical", "high"]) or (severity == "warning" and cfg.get("alert_on_warning", True))
        if should_alert:
            await notification_router.dispatch_alert(incident_payload)

        # 4. Broadcast to WebSockets
        await manager.broadcast({
            "type": "incident_created",
            "incident": incident_payload,
            "kiosk_alert": {
                "active": True,
                "severity": severity,
                "title": f"CRITICAL SAFETY ALERT" if severity == "critical" else "SAFETY WARNING",
                "message": description,
                "action": rec_action,
                "zone": zone,
                "timestamp": now_dt.isoformat()
            }
        })

        return incident_payload

response_agent = ResponseAgent()
