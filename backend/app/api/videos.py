import os
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException, Body
from typing import Dict, Any
from app.services.camera_manager import camera_manager

router = APIRouter(prefix="/api/videos", tags=["videos"])

# Root sahayi/data/videos
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SAHAYI_ROOT = os.path.dirname(BACKEND_DIR)
VIDEO_DIR = os.path.join(SAHAYI_ROOT, "data", "videos")
os.makedirs(VIDEO_DIR, exist_ok=True)

@router.get("")
def list_videos():
    files = []
    if os.path.exists(VIDEO_DIR):
        for f in os.listdir(VIDEO_DIR):
            if f.lower().endswith(('.mp4', '.mov', '.avi', '.webm', '.mkv')):
                full_path = os.path.join(VIDEO_DIR, f)
                files.append({
                    "filename": f,
                    "size_mb": round(os.path.getsize(full_path) / (1024 * 1024), 2),
                    "path": f"/videos/{f}",
                    "is_active": camera_manager.active_video_name == f
                })
    return files

@router.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(('.mp4', '.mov', '.avi', '.webm', '.mkv')):
        raise HTTPException(status_code=400, detail="Invalid video format. Supported: MP4, MOV, AVI, WEBM, MKV")
    
    clean_filename = os.path.basename(file.filename)
    dest_path = os.path.join(VIDEO_DIR, clean_filename)
    
    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    print(f"[VIDEO UPLOAD] Saved custom video: {dest_path}")
    
    # Automatically switch camera to uploaded video
    camera_manager.set_active_video(dest_path, clean_filename)
    
    return {
        "status": "ok",
        "message": f"Successfully uploaded {clean_filename}",
        "filename": clean_filename,
        "is_active": True
    }

@router.post("/select")
def select_video(payload: Dict[str, str] = Body(...)):
    filename = payload.get("filename")
    if not filename:
        raise HTTPException(status_code=400, detail="filename parameter required")
    
    target_path = os.path.join(VIDEO_DIR, filename)
    if not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail="Video file not found")
        
    camera_manager.set_active_video(target_path, filename)
    return {
        "status": "ok",
        "active_video": filename
    }
