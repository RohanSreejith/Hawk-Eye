from fastapi import APIRouter
from app.cv.detector import model_manager
from app.agents.coordinator import agent_coordinator
from app.notifications.telegram import TelegramNotificationProvider
from app.services.statistics import statistics_service
from app.config import settings

router = APIRouter(prefix="/api", tags=["system"])

@router.get("/health")
def health_check():
    return {"status": "ok", "service": "sahayi_safety_backend"}

@router.get("/system/status")
def system_status():
    model_status = model_manager.get_status()
    telegram = TelegramNotificationProvider()
    kpis = statistics_service.get_kpis()

    return {
        "system_status": "ONLINE",
        "vision_engine": "ONLINE",
        "vision_mode": model_status.get("active_mode", "DEMO_CV"),
        "model_name": model_status.get("model_name", "yolo11n.pt"),
        "device": model_status.get("device", "CPU/GPU (Auto)"),
        "event_engine": "ONLINE",
        "agent_coordinator": "ONLINE",
        "database": "ONLINE",
        "notification_service": "ONLINE (Telegram)" if telegram.is_configured else "ONLINE (Simulated Mobile / Demo)",
        "cameras_online": kpis.get("cameras_online", "5/5"),
        "llm_service": "ONLINE (Ollama)" if settings.LLM_ENABLED else "OPTIONAL (Deterministic Templates)",
        "privacy_policy": "Video analysis is performed strictly for site safety. Sahayi does not require facial recognition or biometric identification."
    }

@router.get("/agents/logs")
def get_agent_logs():
    return agent_coordinator.decision_logs
