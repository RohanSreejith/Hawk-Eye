from fastapi import APIRouter, Body
from typing import Dict, Any
from app.services.settings_service import settings_service

router = APIRouter(prefix="/api/settings", tags=["settings"])

@router.get("")
def get_settings():
    return settings_service.get()

@router.post("")
def update_settings(payload: Dict[str, Any] = Body(...)):
    return settings_service.save(payload)

@router.post("/test-alert")
async def send_test_alert():
    test_incident = {
        "event_type": "vehicle_person_proximity",
        "zone": "Loading Zone",
        "risk_score": 88,
        "severity": "CRITICAL",
        "recommended_action": "TEST ALERT: Stand-clear of reversing forklift in Bay 3."
    }
    result = await settings_service.send_supervisor_alert(test_incident)
    return {
        "status": "ok",
        "dispatch_details": result
    }
