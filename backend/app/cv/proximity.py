import math
from typing import List, Dict, Tuple, Optional

class ProximityEngine:
    """
    Computes image-space Euclidean distance between detected workers and construction vehicles.
    Detects high-risk proximity hazards when distance drops below danger threshold.
    """

    @staticmethod
    def bbox_centroid(bbox: Dict[str, float]) -> Tuple[float, float]:
        cx = (bbox["x1"] + bbox["x2"]) / 2.0
        cy = (bbox["y1"] + bbox["y2"]) / 2.0
        return cx, cy

    @staticmethod
    def euclidean_distance(pt1: Tuple[float, float], pt2: Tuple[float, float]) -> float:
        return math.hypot(pt1[0] - pt2[0], pt1[1] - pt2[1])

    @classmethod
    def evaluate_vehicle_person_proximity(
        cls,
        people: List[Dict],
        vehicles: List[Dict],
        threshold_px: float = 180.0
    ) -> List[Dict]:
        """
        Evaluates pair-wise distance between all detected workers and vehicles in frame.
        Returns list of proximity hazard events.
        """
        hazards = []
        for person in people:
            p_bbox = person.get("bbox")
            if not p_bbox:
                continue
            p_center = cls.bbox_centroid(p_bbox)
            
            for vehicle in vehicles:
                v_bbox = vehicle.get("bbox")
                if not v_bbox:
                    continue
                v_center = cls.bbox_centroid(v_bbox)
                
                dist = cls.euclidean_distance(p_center, v_center)
                
                if dist < threshold_px:
                    # Calculate proximity factor (1.0 = at threshold, 2.0 = touching/imminent collision)
                    prox_factor = 1.0 + (max(0.0, threshold_px - dist) / threshold_px)
                    hazards.append({
                        "person_track_id": person.get("track_id", "PERSON_UNKNOWN"),
                        "vehicle_track_id": vehicle.get("track_id", "VEHICLE_UNKNOWN"),
                        "vehicle_type": vehicle.get("label", "truck"),
                        "distance_px": round(dist, 1),
                        "threshold_px": threshold_px,
                        "proximity_factor": round(prox_factor, 2),
                        "person_bbox": p_bbox,
                        "vehicle_bbox": v_bbox
                    })
        return hazards

proximity_engine = ProximityEngine()
