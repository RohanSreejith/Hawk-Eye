import os
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.database.models import Incident
from app.services.hawk_engine import hawk_engine, VIDEO_DIR
from app.services.camera_manager import camera_manager
from app.agents.analyst_agent import analyst_agent

router = APIRouter(prefix="/api/hawk", tags=["HAWK Multi-Agent"])

class VideoSelectionRequest(BaseModel):
    camera_a: Optional[str] = None
    camera_b: Optional[str] = None

class ScenarioTriggerRequest(BaseModel):
    step: int = 4  # 1 to 6

@router.get("/state")
async def get_hawk_state():
    """Returns the live HAWK shared state across all cameras and perception agents."""
    return hawk_engine.get_state()

@router.get("/videos")
async def list_available_videos():
    """Lists all available video files that can be assigned to cameras."""
    if not os.path.exists(VIDEO_DIR):
        return []
    videos = [
        f for f in os.listdir(VIDEO_DIR)
        if f.lower().endswith((".mp4", ".avi", ".mov", ".mkv"))
    ]
    return {
        "videos": videos,
        "current_camera_a": hawk_engine.camera_a_video,
        "current_camera_b": hawk_engine.camera_b_video
    }

@router.post("/select-video")
async def select_camera_videos(req: VideoSelectionRequest):
    """Assigns custom video footage to Camera A and/or Camera B."""
    hawk_engine.set_camera_videos(camera_a=req.camera_a, camera_b=req.camera_b)
    await hawk_engine.broadcast_state()
    return {
        "status": "success",
        "camera_a": hawk_engine.camera_a_video,
        "camera_b": hawk_engine.camera_b_video
    }

@router.post("/trigger-scenario")
async def trigger_scenario(req: ScenarioTriggerRequest):
    """
    Drives the HAWK anticipation scenario through steps:
    1: Safe Baseline
    2: Vehicle at Entrance
    3: Inbound Broadcast
    4: Anticipated Conflict & Kiosk Warning (Blindspot anticipation)
    5: Critical Collision Proximity
    6: Resolved
    """
    await hawk_engine.run_scenario_step(req.step)
    return {
        "status": "success",
        "step": req.step,
        "hawk_state": hawk_engine.get_state()
    }

@router.post("/reset")
async def reset_hawk_state():
    """Resets HAWK to initial monitoring baseline."""
    await hawk_engine.run_scenario_step(1)
    return {"status": "success", "hawk_state": hawk_engine.get_state()}

# ---------------------------------------------------------------------------
# Live MJPEG Camera Streams (real-time YOLO + PPE inference drawn on frames)
# ---------------------------------------------------------------------------

@router.get("/camera/a/stream")
async def stream_hawk_camera_a():
    """Streams live MJPEG video from HAWK Camera A with real-time YOLO + PPE HUD."""
    return StreamingResponse(
        camera_manager.hawk_streamer_a.generate_mjpeg_stream(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@router.get("/camera/b/stream")
async def stream_hawk_camera_b():
    """Streams live MJPEG video from HAWK Camera B with real-time YOLO + PPE HUD."""
    return StreamingResponse(
        camera_manager.hawk_streamer_b.generate_mjpeg_stream(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


@router.get("/incidents/{incident_id}/analysis")
async def get_incident_analysis(incident_id: int, db: Session = Depends(get_db)):
    """
    Returns deep LLM forensic analysis and playable forensic clip URL
    for the requested incident.
    """
    db_incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not db_incident:
        # Fallback to mock representation if not found in db
        incident_dict = {
            "id": incident_id,
            "event_id": f"EVT-{incident_id}",
            "event_type": "vehicle_person_proximity",
            "zone": "Zone B - Loading Area",
            "camera_id": "CAM_B",
            "severity": "critical",
            "timestamp": "10:24:17",
            "worker_id": "Worker P17",
            "equipment_id": "Forklift V01",
            "clip_url": "/clips/evt_veh_84247.mp4"
        }
    else:
        # Check if there is an evidence clip
        from app.database.models import EvidenceClip
        clip_row = db.query(EvidenceClip).filter(EvidenceClip.incident_id == db_incident.event_id).first()
        clip_url = None
        if clip_row and clip_row.path:
            clip_filename = os.path.basename(clip_row.path)
            clip_url = f"/clips/{clip_filename}"
        else:
            clip_url = "/clips/evt_veh_84247.mp4"

        incident_dict = {
            "id": db_incident.id,
            "event_id": db_incident.event_id,
            "event_type": db_incident.event_type,
            "zone": db_incident.zone,
            "camera_id": db_incident.camera_id,
            "severity": db_incident.severity,
            "timestamp": db_incident.timestamp.strftime("%H:%M:%S") if db_incident.timestamp else "10:24:17",
            "worker_id": "Worker P17",
            "equipment_id": "Forklift V01",
            "clip_url": clip_url
        }

    analysis = await analyst_agent.generate_deep_incident_analysis(incident_dict)
    return analysis
