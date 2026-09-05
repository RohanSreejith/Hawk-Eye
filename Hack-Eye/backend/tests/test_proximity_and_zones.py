import pytest
from app.cv.proximity import proximity_engine
from app.cv.zones import zone_engine

def test_proximity_evaluation():
    people = [{"track_id": "P1", "bbox": {"x1": 100, "y1": 100, "x2": 150, "y2": 200}}]
    vehicles = [{"track_id": "V1", "label": "truck", "bbox": {"x1": 120, "y1": 110, "x2": 250, "y2": 220}}]

    hazards = proximity_engine.evaluate_vehicle_person_proximity(people, vehicles, threshold_px=150.0)
    assert len(hazards) == 1
    assert hazards[0]["person_track_id"] == "P1"
    assert hazards[0]["vehicle_track_id"] == "V1"
    assert hazards[0]["proximity_factor"] > 1.0

def test_danger_zone_ray_casting():
    # Square polygon from (0.2, 0.2) to (0.6, 0.6)
    polygon = [
        {"x": 0.2, "y": 0.2},
        {"x": 0.6, "y": 0.2},
        {"x": 0.6, "y": 0.6},
        {"x": 0.2, "y": 0.6}
    ]

    # Inside point
    assert zone_engine.point_in_polygon(0.4, 0.4, polygon) is True
    # Outside point
    assert zone_engine.point_in_polygon(0.8, 0.8, polygon) is False
    assert zone_engine.point_in_polygon(0.1, 0.3, polygon) is False
