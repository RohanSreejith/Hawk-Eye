import os
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    APP_ENV: str = "development"
    PROJECT_NAME: str = "SAHAYI - AI Construction Safety Platform"
    DEMO_MODE: bool = False
    DATABASE_URL: str = "sqlite:///./sahayi.db"
    
    # Video Ingestion
    VIDEO_SOURCE_TYPE: str = "webcam"  # "webcam", "file", "rtsp", "demo"
    VIDEO_SOURCE: str = "0"             # camera index (0) or path to video file
    RTSP_URL: Optional[str] = None
    
    # Computer Vision & Models
    MODEL_NAME: str = "yolo11n.pt"
    MODEL_DEVICE: str = "auto"          # "cuda", "cpu", "auto"
    CONFIDENCE_THRESHOLD: float = 0.35
    
    # Proximity & Rules
    PROXIMITY_THRESHOLD_PX: float = 180.0
    PROXIMITY_PERSISTENCE_SEC: float = 0.5
    ALERT_COOLDOWN_SECONDS: int = 25
    PRE_EVENT_SECONDS: int = 5
    POST_EVENT_SECONDS: int = 5
    
    # Local LLM (Ollama)
    LLM_ENABLED: bool = True
    LLM_BASE_URL: str = "http://localhost:11434"
    LLM_MODEL: str = "llama3.1:latest"
    VISION_LLM_MODEL: str = "qwen2.5vl:latest"
    
    # Notifications
    TELEGRAM_BOT_TOKEN: Optional[str] = None
    TELEGRAM_CHAT_ID: Optional[str] = None
    
    # Paths
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    EVIDENCE_DIR: str = os.path.join(os.path.dirname(BASE_DIR), "data", "clips")
    DEMO_DATA_DIR: str = os.path.join(os.path.dirname(BASE_DIR), "data", "demo")

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
os.makedirs(settings.EVIDENCE_DIR, exist_ok=True)
os.makedirs(settings.DEMO_DATA_DIR, exist_ok=True)
