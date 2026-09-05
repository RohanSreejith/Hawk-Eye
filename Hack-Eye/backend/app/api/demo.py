from fastapi import APIRouter, Query, Body
from typing import Optional, Dict, Any
from app.demo.demo_engine import demo_engine
from app.demo.demo_scenarios import DEMO_SCENARIOS

router = APIRouter(prefix="/api/demo", tags=["demo"])

@router.get("/scenarios")
def list_scenarios():
    return [
        {
            "id": k,
            "title": v["title"],
            "zone": v["zone"],
            "severity": v["severity"],
            "event_type": v["event_type"]
        }
        for k, v in DEMO_SCENARIOS.items()
    ]

@router.post("/trigger")
async def trigger_scenario(scenario: str = Query("vehicle_proximity")):
    incident = await demo_engine.trigger_scenario(scenario)
    return {
        "status": "ok",
        "scenario": scenario,
        "incident": incident
    }

@router.post("/start")
def start_demo_loop():
    demo_engine.start_loop()
    return {"status": "ok", "message": "Automated simulation loop active"}

@router.post("/stop")
def stop_demo_loop():
    demo_engine.stop_loop()
    return {"status": "ok", "message": "Automated simulation loop stopped"}

@router.post("/clear")
def clear_demo_incidents():
    demo_engine.clear_incidents()
    return {"status": "ok", "message": "Incident history cleared"}
