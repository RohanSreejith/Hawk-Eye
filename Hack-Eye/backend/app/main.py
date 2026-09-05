import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database.seed import seed_database
from app.api import incidents, cameras, zones, analytics, heatmap, demo, system, websocket, settings as settings_api, videos

VIDEO_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "videos")
os.makedirs(VIDEO_DIR, exist_ok=True)
os.makedirs(settings.EVIDENCE_DIR, exist_ok=True)

from app.services.camera_manager import camera_manager
import asyncio

@asynccontextmanager
async def lifespan(app: FastAPI):
    camera_manager.set_main_loop(asyncio.get_running_loop())
    seed_database()
    print("[HACK-EYE BOOT] Database initialized and seeded.")
    print(f"[HACK-EYE BOOT] Video evidence directory: {settings.EVIDENCE_DIR}")
    print(f"[HACK-EYE BOOT] Videos directory: {VIDEO_DIR}")
    yield
    print("[HACK-EYE BOOT] System shutting down.")

app = FastAPI(
    title="Hack-eye - AI Construction Safety Intelligence Platform",
    description="Transforms construction CCTV into an active safety kiosk system.",
    version="2.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Static Directories
app.mount("/clips", StaticFiles(directory=settings.EVIDENCE_DIR), name="clips")
app.mount("/videos", StaticFiles(directory=VIDEO_DIR), name="videos")

# Include Routers
app.include_router(system.router)
app.include_router(websocket.router)
app.include_router(incidents.router)
app.include_router(cameras.router)
app.include_router(zones.router)
app.include_router(analytics.router)
app.include_router(heatmap.router)
app.include_router(demo.router)
app.include_router(settings_api.router)
app.include_router(videos.router)

@app.get("/")
def root():
    return {
        "service": "Hack-eye Safety Kiosk OS",
        "status": "ONLINE",
        "docs_url": "/docs",
        "tagline": "Turning CCTV into an active safety system."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8001, reload=True)
