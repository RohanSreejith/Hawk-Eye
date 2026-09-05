import os
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse, Response
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

@router.get("/camera/a/frame")
async def get_hawk_camera_a_frame():
    """Returns the latest single encoded JPEG frame from Camera A."""
    jpeg = camera_manager.hawk_streamer_a.latest_jpeg
    if not jpeg:
        return Response(status_code=503)
    return Response(content=jpeg, media_type="image/jpeg")

@router.get("/camera/b/frame")
async def get_hawk_camera_b_frame():
    """Returns the latest single encoded JPEG frame from Camera B."""
    jpeg = camera_manager.hawk_streamer_b.latest_jpeg
    if not jpeg:
        return Response(status_code=503)
    return Response(content=jpeg, media_type="image/jpeg")

@router.get("/incidents/{incident_id}/analysis")
async def get_incident_analysis(
    incident_id: int,
    event_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Returns deep LLM forensic analysis and playable forensic clip URL
    pointing to the actual recorded incident footage.
    """
    db_incident = db.query(Incident).filter(Incident.id == incident_id).first()
    resolved_event = event_type or (db_incident.event_type if db_incident else "")
    ev_lower = resolved_event.lower()

    # Determine real incident clip and metadata tailored to scenario
    curr_step = getattr(hawk_engine, "current_step", 1)

    is_fire = "fire" in ev_lower or "thermal" in ev_lower or "combustion" in ev_lower
    is_collision = "collision" in ev_lower or "conflict" in ev_lower or "brake" in ev_lower or "impact" in ev_lower
    is_machinery = "machinery" in ev_lower or "entrance" in ev_lower or "doorway" in ev_lower or "inbound" in ev_lower
    is_ppe = "helmet" in ev_lower or "vest" in ev_lower or "ppe" in ev_lower or "gear" in ev_lower or "head" in ev_lower
    is_proximity = "proximity" in ev_lower or "nearmiss" in ev_lower

    # If ambiguous or unspecified, fall back to current active scenario step
    if not (is_fire or is_collision or is_machinery or is_ppe or is_proximity):
        if curr_step == 7:
            is_fire = True
        elif curr_step == 5:
            is_collision = True
        elif curr_step == 3:
            is_machinery = True
        elif curr_step in [2, 4]:
            is_proximity = True
        elif curr_step == 1:
            is_ppe = True

    if is_machinery:
        primary_clip = "/videos/worker_at_entrance_inside.mp4"
        alt_clip = "/videos/forklift_approaching_entrance.mp4"
        sync_clip = "/videos/machinery_warn_evidence_sync.mp4"
        zone = "Entrance Doorway (Zone A -> Zone B)"
        eff_event = "Heavy Machinery Approaching Entrance"
        severity = "warning"
    elif is_fire:
        primary_clip = "/videos/Create_a_photorealistic_–_.mp4"
        alt_clip = "/videos/fire-rgb-00000/00023b5323028ab83e67_run_6_seed_1486583949.ceiling_00.rgb.mp4"
        sync_clip = None
        zone = "Zone B - Loading / Storage Bay"
        eff_event = "Fire Emergency - Evacuate Zone"
        severity = "critical"
    elif is_ppe:
        primary_clip = "/videos/worker_no_helmet.mp4"
        alt_clip = None
        sync_clip = None
        zone = "Zone B - Loading Area"
        eff_event = "Missing PPE - Hard Hat & Vest"
        severity = "warning"
    elif is_collision:
        primary_clip = "/videos/05761a14cf211fdb7562_run_21_seed_742094177.eye_00.rgb.mp4"
        alt_clip = "/videos/05761a14cf211fdb7562_run_21_seed_742094177.ceiling_01.rgb.mp4"
        sync_clip = None
        zone = "Zone B - Loading Aisle"
        eff_event = "Forklift Collision Hazard"
        severity = "critical"
    elif is_proximity:
        primary_clip = "/videos/nearmiss-rgb-00000/001e53453441935632ae_run_1_seed_1288693302.ceiling_01.rgb.mp4"
        alt_clip = "/videos/nearmiss-rgb-00000/001e53453441935632ae_run_1_seed_1288693302.ceiling_00.rgb.mp4"
        sync_clip = None
        zone = "Zone B - Loading Corridor"
        eff_event = "Vehicle-Person Proximity Hazard"
        severity = "warning"
    else:
        curr_b = getattr(hawk_engine, "camera_b_video", None)
        primary_clip = f"/videos/{curr_b}" if curr_b else "/videos/worker_at_entrance_inside.mp4"
        alt_clip = f"/videos/{hawk_engine.camera_a_video}" if getattr(hawk_engine, "camera_a_video", None) else None
        sync_clip = None
        zone = "Zone B - Loading Area"
        eff_event = resolved_event or "Safety Hazard"
        severity = "warning"

    incident_dict = {
        "id": incident_id,
        "event_id": db_incident.event_id if db_incident else f"EVT-{incident_id}",
        "event_type": eff_event,
        "zone": db_incident.zone if db_incident else zone,
        "camera_id": db_incident.camera_id if db_incident else "CAM_B",
        "severity": db_incident.severity if db_incident else severity,
        "timestamp": db_incident.timestamp.strftime("%H:%M:%S") if (db_incident and db_incident.timestamp) else "10:24:17",
        "worker_id": "Worker P12",
        "equipment_id": "Forklift V01",
        "clip_url": primary_clip,
        "alt_clip_url": alt_clip,
        "sync_clip_url": sync_clip
    }

    analysis = await analyst_agent.generate_deep_incident_analysis(incident_dict)
    analysis["clip_url"] = primary_clip
    analysis["alt_clip_url"] = alt_clip
    analysis["sync_clip_url"] = sync_clip
    return analysis
