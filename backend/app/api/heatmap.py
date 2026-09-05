from fastapi import APIRouter
from app.services.heatmap import heatmap_service

router = APIRouter(prefix="/api/heatmap", tags=["heatmap"])

@router.get("")
def get_heatmap():
    return heatmap_service.get_site_heatmap()
