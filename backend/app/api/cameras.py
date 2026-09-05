from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.services.camera_manager import camera_manager

router = APIRouter(prefix="/api/cameras", tags=["cameras"])

@router.get("")
def list_cameras():
    return camera_manager.list_cameras()

@router.get("/{id}")
def get_camera(id: str):
    cam = camera_manager.get_camera(id)
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    return {
        "id": cam.camera_id,
        "name": cam.name,
        "zone": cam.zone,
        "status": "online" if cam.is_active else "offline",
        "stream_url": f"/api/cameras/{cam.camera_id}/stream"
    }

@router.get("/{id}/stream")
def stream_camera(id: str):
    cam = camera_manager.get_camera(id)
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    return StreamingResponse(
        cam.generate_mjpeg_stream(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )
