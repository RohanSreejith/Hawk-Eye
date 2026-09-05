from typing import List, Dict, Any, Optional
from app.cv.proximity import proximity_engine
from app.cv.zones import zone_engine
from app.events.deduplicator import deduplicator

class SafetyAgent:
    """
    Safety Agent:
    Evaluates safety-critical deterministic operational rules.
    Detects proximity hazards, restricted zone entries, and multi-PPE violations.
    Applies deduplication and cooldown to suppress alert fatigue.
    """
    def __init__(self):
        self.name = "Safety Agent"

    def evaluate_rules(
        self,
        camera_id: str,
        zone_name: str,
        perception_data: Dict[str, Any],
        zone_definitions: List[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        candidate_events = []
        people = perception_data.get("people", [])
        vehicles = perception_data.get("vehicles", [])

        # 1. Evaluate Vehicle-Worker Proximity
        if people and vehicles:
            prox_hazards = proximity_engine.evaluate_vehicle_person_proximity(people, vehicles)
            for hazard in prox_hazards:
                p_id = hazard["person_track_id"]
                if deduplicator.should_trigger(p_id, camera_id, "vehicle_person_proximity"):
                    candidate_events.append({
                        "event_type": "vehicle_person_proximity",
                        "camera_id": camera_id,
                        "zone": zone_name,
                        "track_id": p_id,
                        "hazard_details": hazard,
                        "vehicle_involved": True,
                        "proximity_factor": hazard["proximity_factor"],
                        "description": f"Worker {p_id} in active proximity ({hazard['distance_px']}px) of {hazard['vehicle_type']} {hazard['vehicle_track_id']}."
                    })

        # 2. Evaluate Zone Breaches
        if zone_definitions:
            for person in people:
                bbox = person.get("bbox")
                if not bbox:
                    continue
                # Use bottom center (feet) for polygon check
                foot_x = ((bbox["x1"] + bbox["x2"]) / 2.0) / 1280.0
                foot_y = bbox["y2"] / 720.0
                breaches = zone_engine.check_zone_breaches(foot_x, foot_y, zone_definitions)
                for b_zone in breaches:
                    p_id = person["track_id"]
                    if deduplicator.should_trigger(p_id, camera_id, "zone_breach"):
                        candidate_events.append({
                            "event_type": "zone_breach",
                            "camera_id": camera_id,
                            "zone": b_zone.get("name", zone_name),
                            "track_id": p_id,
                            "hazard_details": {"breached_zone": b_zone.get("name")},
                            "vehicle_involved": False,
                            "proximity_factor": 1.2,
                            "description": f"Worker {p_id} breached restricted perimeter of {b_zone.get('name')}."
                        })

        # 3. Evaluate PPE Violations
        for person in people:
            ppe = person.get("ppe_status")
            if ppe and not ppe.get("is_compliant", True):
                p_id = person["track_id"]
                violation_type = ppe.get("primary_violation", "no_helmet")
                if deduplicator.should_trigger(p_id, camera_id, violation_type):
                    desc = f"PPE Violation: Worker {p_id} missing {', '.join(ppe.get('violations', []))} in {zone_name}."
                    candidate_events.append({
                        "event_type": violation_type,
                        "camera_id": camera_id,
                        "zone": zone_name,
                        "track_id": p_id,
                        "hazard_details": {"violations": ppe.get("violations")},
                        "vehicle_involved": False,
                        "proximity_factor": 1.0,
                        "description": desc
                    })

        return candidate_events

safety_agent = SafetyAgent()
