from typing import List, Dict, Any
from app.cv.ppe import ppe_engine

class PerceptionAgent:
    """
    Perception Agent:
    Consumes raw CV detector output, normalizes observations, tracks anonymous entities,
    and runs multi-PPE classification.
    """
    def __init__(self):
        self.name = "Perception Agent"

    def process_observations(
        self,
        camera_id: str,
        zone_name: str,
        raw_detections: List[Dict[str, Any]],
        frame = None
    ) -> Dict[str, Any]:
        people = []
        vehicles = []

        for det in raw_detections:
            label = det.get("label", "").lower()
            if label == "person":
                # Evaluate PPE if frame is available
                ppe_status = None
                if frame is not None and "bbox" in det:
                    ppe_status = ppe_engine.evaluate_worker_ppe(frame, det["bbox"], zone_name)
                
                people.append({
                    "track_id": det.get("track_id", "PERSON_NEW"),
                    "label": "person",
                    "confidence": det.get("confidence", 0.90),
                    "bbox": det.get("bbox"),
                    "ppe_status": ppe_status
                })
            elif label in ["truck", "car", "bus", "motorcycle", "excavator"]:
                vehicles.append({
                    "track_id": det.get("track_id", "VEHICLE_NEW"),
                    "label": label,
                    "confidence": det.get("confidence", 0.90),
                    "bbox": det.get("bbox")
                })

        return {
            "camera_id": camera_id,
            "zone_name": zone_name,
            "people": people,
            "vehicles": vehicles,
            "total_workers": len(people),
            "total_vehicles": len(vehicles)
        }

perception_agent = PerceptionAgent()
