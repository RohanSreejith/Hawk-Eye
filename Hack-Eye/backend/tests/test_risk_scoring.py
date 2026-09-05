import pytest
from app.risk.risk_engine import risk_engine

def test_risk_score_bounds():
    # Test low risk
    score, sev, breakdown = risk_engine.calculate_risk(
        event_type="no_gloves",
        zone="Main Gate",
        proximity_factor=0.8,
        exposed_workers_count=1
    )
    assert 0 <= score <= 100
    assert sev in ["low", "warning", "high", "critical"]

def test_critical_vehicle_proximity():
    # High risk struck-by condition
    score, sev, breakdown = risk_engine.calculate_risk(
        event_type="vehicle_person_proximity",
        zone="Loading Zone",
        proximity_factor=1.8,
        persistence_seconds=2.0,
        vehicle_involved=True
    )
    assert score >= 75
    assert sev == "critical"

def test_compound_ppe_risk():
    score, sev, breakdown = risk_engine.calculate_risk(
        event_type="compound_ppe_violation",
        zone="Crane Area",
        proximity_factor=1.5
    )
    assert score >= 50
    assert sev in ["high", "critical"]
