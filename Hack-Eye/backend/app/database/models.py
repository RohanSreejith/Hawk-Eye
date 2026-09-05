from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, JSON
from sqlalchemy.sql import func
from app.database.database import Base

class Site(Base):
    __tablename__ = "sites"

    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    location = Column(String(200), nullable=False)
    status = Column(String(50), default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Camera(Base):
    __tablename__ = "cameras"

    id = Column(String(50), primary_key=True, index=True)
    site_id = Column(String(50), ForeignKey("sites.id"), nullable=False)
    name = Column(String(100), nullable=False)
    source = Column(String(255), default="webcam")
    zone = Column(String(100), nullable=False)
    status = Column(String(50), default="online")
    last_seen = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Zone(Base):
    __tablename__ = "zones"

    id = Column(String(50), primary_key=True, index=True)
    site_id = Column(String(50), ForeignKey("sites.id"), nullable=False)
    name = Column(String(100), nullable=False)
    type = Column(String(50), default="standard")  # standard, restricted, loading, crane, excavation
    polygon = Column(JSON, nullable=False)         # [{"x": 0.1, "y": 0.2}, ...]
    risk_level = Column(String(50), default="medium") # low, medium, high, critical
    required_ppe = Column(JSON, default=lambda: ["helmet", "vest"]) # list of mandatory PPE

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    event_id = Column(String(100), unique=True, index=True)
    camera_id = Column(String(50), nullable=False)
    site_id = Column(String(50), default="SITE_01")
    zone = Column(String(100), nullable=False)
    event_type = Column(String(100), nullable=False) # no_helmet, no_vest, no_harness, vehicle_person_proximity, zone_breach, compound_ppe_violation
    severity = Column(String(50), nullable=False)   # low, warning, high, critical
    confidence = Column(Float, default=0.90)
    risk_score = Column(Integer, default=50)        # 0 - 100
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    description = Column(Text, nullable=False)
    recommended_action = Column(Text, nullable=False)
    ai_summary = Column(Text, nullable=True)
    status = Column(String(50), default="open")     # open, acknowledged, resolved
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

class EvidenceClip(Base):
    __tablename__ = "evidence_clips"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    incident_id = Column(String(100), nullable=False, index=True)
    path = Column(String(255), nullable=False)
    duration = Column(Float, default=10.0)
    start_time = Column(DateTime(timezone=True), nullable=True)
    end_time = Column(DateTime(timezone=True), nullable=True)

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    incident_id = Column(String(100), nullable=False, index=True)
    channel = Column(String(50), default="websocket") # websocket, telegram, sms
    recipient = Column(String(100), default="site_supervisor")
    status = Column(String(50), default="sent")       # pending, sent, failed
    sent_at = Column(DateTime(timezone=True), server_default=func.now())

class TrackedObject(Base):
    __tablename__ = "tracked_objects"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    camera_id = Column(String(50), nullable=False)
    track_id = Column(String(50), nullable=False)
    object_type = Column(String(50), nullable=False) # person, truck, car, excavator
    first_seen = Column(DateTime(timezone=True), server_default=func.now())
    last_seen = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
