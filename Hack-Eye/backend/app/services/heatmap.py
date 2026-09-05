from typing import List, Dict, Any
from app.database.database import SessionLocal
from app.database.models import Zone, Incident

class HeatmapService:
    @staticmethod
    def get_site_heatmap() -> List[Dict[str, Any]]:
        db = SessionLocal()
        try:
            zones = db.query(Zone).all()
            incidents = db.query(Incident).all()

            zone_stats = []
            for z in zones:
                z_incidents = [inc for inc in incidents if inc.zone == z.name]
                high_risk = [inc for inc in z_incidents if inc.severity in ["high", "critical"]]
                
                # Determine top hazard
                hazard_counts = {}
                for inc in z_incidents:
                    hazard_counts[inc.event_type] = hazard_counts.get(inc.event_type, 0) + 1
                top_hazard = max(hazard_counts.items(), key=lambda x: x[1])[0] if hazard_counts else "None"

                # Calculate calculated risk index (0 to 100)
                if z_incidents:
                    avg_score = sum(inc.risk_score for inc in z_incidents) / len(z_incidents)
                    dynamic_risk = min(100, int(avg_score * 0.7 + len(high_risk) * 6))
                else:
                    dynamic_risk = 15 if z.risk_level == "low" else 35

                recent = z_incidents[-1].timestamp.strftime("%H:%M:%S") if z_incidents else "N/A"

                zone_stats.append({
                    "zone_id": z.id,
                    "name": z.name,
                    "type": z.type,
                    "risk_level": z.risk_level,
                    "polygon": z.polygon,
                    "required_ppe": z.required_ppe,
                    "total_incidents": len(z_incidents),
                    "high_risk_incidents": len(high_risk),
                    "risk_index": dynamic_risk,
                    "top_hazard": top_hazard.replace("_", " ").title(),
                    "recent_incident": recent
                })

            return zone_stats
        finally:
            db.close()

heatmap_service = HeatmapService()
