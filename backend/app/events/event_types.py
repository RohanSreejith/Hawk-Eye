from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime

class BoundingBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float
    confidence: float = 0.9
    label: str
    track_id: Optional[str] = None

class PPEStatus(BaseModel):
    has_helmet: bool = True
    has_vest: bool = True
    has_harness: bool = True
    has_gloves: bool = True
    has_boots: bool = True
    has_eye_protection: bool = True
    violations: List[str] = Field(default_factory=list)

class TrackedEntity(BaseModel):
    track_id: str
    entity_type: str  # person, vehicle, equipment
    bbox: BoundingBox
    zone: str
    ppe_status: Optional[PPEStatus] = None
    speed_px_sec: float = 0.0

class EvidencePayload(BaseModel):
    clip_path: str
    duration_seconds: float = 10.0
    thumbnail_path: Optional[str] = None
    key_frame_timestamp: Optional[str] = None

class SafetyEvent(BaseModel):
    event_id: str
    site_id: str = "SITE_01"
    camera_id: str
    zone: str
    type: str  # no_helmet, no_vest, no_harness, no_gloves, no_boots, compound_ppe_violation, vehicle_person_proximity, zone_breach
    severity: str  # informational, warning, high, critical
    confidence: float
    risk_score: int  # 0 to 100
    timestamp: str
    objects: Dict[str, Any] = Field(default_factory=dict)
    evidence: Optional[EvidencePayload] = None
    recommended_action: str
    ai_summary: Optional[str] = None
    status: str = "open"  # open, acknowledged, resolved

class IncidentActionRequest(BaseModel):
    action: str  # acknowledge, resolve, escalate
    notes: Optional[str] = None
    resolved_by: Optional[str] = "Site Supervisor"

class DemoTriggerRequest(BaseModel):
    scenario: str  # no_helmet, vehicle_proximity, zone_breach, no_harness, compound_ppe
    camera_id: Optional[str] = "CAM_02"
    custom_description: Optional[str] = None

class AgentDecisionLog(BaseModel):
    agent_name: str
    action_taken: str
    detail: str
    timestamp: str
    severity: str = "info"
