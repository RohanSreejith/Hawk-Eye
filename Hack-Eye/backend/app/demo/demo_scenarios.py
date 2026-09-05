from typing import Dict, Any

DEMO_SCENARIOS: Dict[str, Dict[str, Any]] = {
    "no_helmet": {
        "scenario_id": "no_helmet",
        "title": "Scenario 1: No Helmet / Hard Hat Violation",
        "camera_id": "CAM_01",
        "zone": "Main Gate",
        "event_type": "no_helmet",
        "severity": "warning",
        "confidence": 0.94,
        "track_id": "PERSON_012",
        "description": "Worker PERSON_012 observed walking through Main Gate staging area without mandatory hard-hat.",
        "recommended_action": "Dispatched voice alert to site kiosk; halt entry until approved helmet issued.",
        "objects": {"person_count": 1, "violation": "no_helmet"}
    },
    "vehicle_proximity": {
        "scenario_id": "vehicle_proximity",
        "title": "Scenario 2: Vehicle-Person Proximity Hazard",
        "camera_id": "CAM_04",
        "zone": "Loading Zone",
        "event_type": "vehicle_person_proximity",
        "severity": "critical",
        "confidence": 0.96,
        "track_id": "PERSON_012",
        "description": "Forklift FORKLIFT_01 in critical near-miss trajectory with Worker PERSON_012 in Loading Zone.",
        "recommended_action": "EMERGENCY STOP: HALT FORKLIFT IMMEDIATELY; EVACUATE COLLISION PATH.",
        "proximity_factor": 1.9,
        "vehicle_involved": True,
        "objects": {"person_count": 1, "vehicle": "forklift", "distance_m": 0.8}
    },
    "zone_breach": {
        "scenario_id": "zone_breach",
        "title": "Scenario 3: Restricted Crane Swing Radius Breach",
        "camera_id": "CAM_04",
        "zone": "Crane Area",
        "event_type": "zone_breach",
        "severity": "critical",
        "confidence": 0.96,
        "track_id": "PERSON_019",
        "description": "Unauthorized personnel crossed safety barricade into active Crane overhead load transit zone.",
        "recommended_action": "AUTOMATIC CRITICAL STOP: Tower crane hoist locked; supervisor and spotter dispatched.",
        "proximity_factor": 1.5,
        "objects": {"person_count": 1, "zone": "Crane Swing Envelope"}
    },
    "no_harness": {
        "scenario_id": "no_harness",
        "title": "Scenario 4: Elevated Height Fall Hazard (No Harness)",
        "camera_id": "CAM_03",
        "zone": "Floor 1",
        "event_type": "no_harness",
        "severity": "high",
        "confidence": 0.91,
        "track_id": "PERSON_007",
        "description": "Worker operating within 0.8m of un-netted slab edge without fall-arrest safety harness attached.",
        "recommended_action": "Emergency step-back instruction to kiosk; suspend slab work until lifeline attached.",
        "proximity_factor": 1.4,
        "objects": {"person_count": 1, "fall_height_m": 4.5}
    },
    "compound_ppe": {
        "scenario_id": "compound_ppe",
        "title": "Scenario 5: Compound Multi-PPE Failure (No Helmet + No Vest)",
        "camera_id": "CAM_02",
        "zone": "Loading Zone",
        "event_type": "compound_ppe_violation",
        "severity": "critical",
        "confidence": 0.95,
        "track_id": "PERSON_023",
        "description": "Worker observed in active equipment zone missing both head protection and high-visibility vest.",
        "recommended_action": "IMMEDIATE STOP-WORK ESCALATION: Worker escort requested; high probability of blindspot collision.",
        "proximity_factor": 1.6,
        "objects": {"person_count": 1, "missing_ppe": ["helmet", "vest"]}
    }
}
