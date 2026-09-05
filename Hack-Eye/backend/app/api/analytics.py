from fastapi import APIRouter
from app.services.statistics import statistics_service

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("")
def get_analytics():
    return statistics_service.get_analytics()

@router.get("/kpis")
def get_kpis():
    return statistics_service.get_kpis()
