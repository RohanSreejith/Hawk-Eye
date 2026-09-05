from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
from app.database.database import get_db
from app.database.models import Incident, EvidenceClip
from app.api.websocket import manager

router = APIRouter(prefix="/api/incidents", tags=["incidents"])

@router.get("")
def list_incidents(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Incident)
    if status:
        query = query.filter(Incident.status == status)
    if severity:
        query = query.filter(Incident.severity == severity)
    incidents = query.order_by(Incident.timestamp.desc()).limit(100).all()

    result = []
    for inc in incidents:
        clip = db.query(EvidenceClip).filter_by(incident_id=inc.event_id).first()
        result.append({
            "id": inc.id,
            "event_id": inc.event_id,
            "camera_id": inc.camera_id,
            "site_id": inc.site_id,
            "zone": inc.zone,
            "event_type": inc.event_type,
            "severity": inc.severity,
            "confidence": inc.confidence,
            "risk_score": inc.risk_score,
            "timestamp": inc.timestamp.isoformat() if inc.timestamp else None,
            "description": inc.description,
            "recommended_action": inc.recommended_action,
            "ai_summary": inc.ai_summary,
            "status": inc.status,
            "acknowledged_at": inc.acknowledged_at.isoformat() if inc.acknowledged_at else None,
            "resolved_at": inc.resolved_at.isoformat() if inc.resolved_at else None,
            "evidence_clip_path": clip.path if clip else f"/clips/{inc.event_id}.mp4"
        })
    return result

@router.get("/{id}")
def get_incident(id: int, db: Session = Depends(get_db)):
    inc = db.query(Incident).filter(Incident.id == id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    clip = db.query(EvidenceClip).filter_by(incident_id=inc.event_id).first()
    return {
        "id": inc.id,
        "event_id": inc.event_id,
        "camera_id": inc.camera_id,
        "site_id": inc.site_id,
        "zone": inc.zone,
        "event_type": inc.event_type,
        "severity": inc.severity,
        "confidence": inc.confidence,
        "risk_score": inc.risk_score,
        "timestamp": inc.timestamp.isoformat() if inc.timestamp else None,
        "description": inc.description,
        "recommended_action": inc.recommended_action,
        "ai_summary": inc.ai_summary,
        "status": inc.status,
        "acknowledged_at": inc.acknowledged_at.isoformat() if inc.acknowledged_at else None,
        "resolved_at": inc.resolved_at.isoformat() if inc.resolved_at else None,
        "evidence_clip_path": clip.path if clip else f"/clips/{inc.event_id}.mp4"
    }

@router.post("/{id}/acknowledge")
async def acknowledge_incident(id: int, db: Session = Depends(get_db)):
    inc = db.query(Incident).filter(Incident.id == id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    inc.status = "acknowledged"
    inc.acknowledged_at = datetime.now(timezone.utc)
    db.commit()

    # Broadcast status change
    await manager.broadcast({
        "type": "incident_updated",
        "incident_id": inc.id,
        "event_id": inc.event_id,
        "status": "acknowledged",
        "acknowledged_at": inc.acknowledged_at.isoformat()
    })
    return {"status": "ok", "message": "Incident acknowledged by supervisor"}

@router.post("/{id}/resolve")
async def resolve_incident(id: int, db: Session = Depends(get_db)):
    inc = db.query(Incident).filter(Incident.id == id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    inc.status = "resolved"
    inc.resolved_at = datetime.now(timezone.utc)
    db.commit()

    # Broadcast status change
    await manager.broadcast({
        "type": "incident_updated",
        "incident_id": inc.id,
        "event_id": inc.event_id,
        "status": "resolved",
        "resolved_at": inc.resolved_at.isoformat()
    })
    return {"status": "ok", "message": "Incident marked as resolved"}
