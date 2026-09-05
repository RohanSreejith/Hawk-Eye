import pytest
from fastapi.testclient import TestClient
from app.database.database import init_db
from app.database.seed import seed_database
from app.main import app

# Ensure database tables and seed records exist
init_db()
seed_database()

client = TestClient(app)

def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

def test_system_status():
    res = client.get("/api/system/status")
    assert res.status_code == 200
    data = res.json()
    assert data["system_status"] == "ONLINE"
    assert "vision_engine" in data

def test_list_cameras():
    res = client.get("/api/cameras")
    assert res.status_code == 200
    cameras = res.json()
    assert len(cameras) >= 5

def test_list_zones():
    res = client.get("/api/zones")
    assert res.status_code == 200
    zones = res.json()
    assert len(zones) >= 4

def test_list_incidents():
    res = client.get("/api/incidents")
    assert res.status_code == 200
    incidents = res.json()
    assert isinstance(incidents, list)
    assert len(incidents) >= 1

def test_demo_trigger():
    res = client.post("/api/demo/trigger?scenario=vehicle_proximity")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "incident" in data
    assert data["incident"]["event_type"] == "vehicle_person_proximity"
