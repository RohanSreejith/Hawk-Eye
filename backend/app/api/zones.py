from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.database.models import Zone

router = APIRouter(prefix="/api/zones", tags=["zones"])

@router.get("")
def list_zones(db: Session = Depends(get_db)):
    zones = db.query(Zone).all()
    return [
        {
            "id": z.id,
            "site_id": z.site_id,
            "name": z.name,
            "type": z.type,
            "polygon": z.polygon,
            "risk_level": z.risk_level,
            "required_ppe": z.required_ppe
        }
        for z in zones
    ]
