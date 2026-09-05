from datetime import datetime, timedelta, timezone
from app.database.database import engine, SessionLocal, Base
from app.database.models import Site, Camera, Zone, Incident, EvidenceClip, Notification

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Clear existing if needed or check if already seeded
    existing_site = db.query(Site).filter_by(id="SITE_01").first()
    if existing_site:
        print("[SEED] Database already populated with site data.")
        db.close()
        return

    print("[SEED] Seeding Sahayi Construction Site Data...")

    # 1. Site
    site = Site(
        id="SITE_01",
        name="Sahayi Demo Construction Site",
        location="Sector 42 Commercial Complex, Gurgaon",
        status="active"
    )
    db.add(site)

    # 2. Cameras
    cameras = [
        Camera(id="CAM_01", site_id="SITE_01", name="CAM 01 Main Gate", source="webcam", zone="Main Gate", status="online"),
        Camera(id="CAM_02", site_id="SITE_01", name="CAM 02 Loading Zone", source="webcam", zone="Loading Zone", status="online"),
        Camera(id="CAM_03", site_id="SITE_01", name="CAM 03 Floor 1", source="webcam", zone="Floor 1", status="online"),
        Camera(id="CAM_04", site_id="SITE_01", name="CAM 04 Crane Area", source="webcam", zone="Crane Area", status="online"),
        Camera(id="CAM_05", site_id="SITE_01", name="CAM 05 Material Storage", source="webcam", zone="Material Storage", status="online"),
    ]
    db.add_all(cameras)

    # 3. Zones with Polygons (normalized 0.0 - 1.0 coordinates for camera overlay)
    zones = [
        Zone(
            id="ZONE_GATE",
            site_id="SITE_01",
            name="Main Gate",
            type="standard",
            risk_level="low",
            polygon=[{"x": 0.05, "y": 0.1}, {"x": 0.95, "y": 0.1}, {"x": 0.95, "y": 0.9}, {"x": 0.05, "y": 0.9}],
            required_ppe=["helmet", "vest"]
        ),
        Zone(
            id="ZONE_LOADING",
            site_id="SITE_01",
            name="Loading Zone",
            type="loading",
            risk_level="high",
            polygon=[{"x": 0.15, "y": 0.25}, {"x": 0.85, "y": 0.25}, {"x": 0.85, "y": 0.85}, {"x": 0.15, "y": 0.85}],
            required_ppe=["helmet", "vest", "boots"]
        ),
        Zone(
            id="ZONE_FLOOR1",
            site_id="SITE_01",
            name="Floor 1",
            type="height",
            risk_level="high",
            polygon=[{"x": 0.1, "y": 0.2}, {"x": 0.9, "y": 0.2}, {"x": 0.9, "y": 0.8}, {"x": 0.1, "y": 0.8}],
            required_ppe=["helmet", "vest", "harness", "boots"]
        ),
        Zone(
            id="ZONE_CRANE",
            site_id="SITE_01",
            name="Crane Area",
            type="restricted",
            risk_level="critical",
            polygon=[{"x": 0.2, "y": 0.15}, {"x": 0.8, "y": 0.15}, {"x": 0.85, "y": 0.75}, {"x": 0.15, "y": 0.75}],
            required_ppe=["helmet", "vest", "harness", "eye_protection"]
        ),
        Zone(
            id="ZONE_MATERIAL",
            site_id="SITE_01",
            name="Material Storage",
            type="standard",
            risk_level="medium",
            polygon=[{"x": 0.1, "y": 0.1}, {"x": 0.9, "y": 0.1}, {"x": 0.9, "y": 0.9}, {"x": 0.1, "y": 0.9}],
            required_ppe=["helmet", "vest", "gloves", "boots"]
        ),
        Zone(
            id="ZONE_EXCAVATION",
            site_id="SITE_01",
            name="Excavation Area",
            type="restricted",
            risk_level="critical",
            polygon=[{"x": 0.2, "y": 0.2}, {"x": 0.8, "y": 0.2}, {"x": 0.8, "y": 0.8}, {"x": 0.2, "y": 0.8}],
            required_ppe=["helmet", "vest", "boots", "harness"]
        ),
    ]
    db.add_all(zones)

    # 4. Realistic Historical Incidents (for initial charts and audit log)
    now = datetime.now(timezone.utc)
    sample_incidents = [
        Incident(
            event_id="evt_init_001",
            camera_id="CAM_02",
            site_id="SITE_01",
            zone="Loading Zone",
            event_type="vehicle_person_proximity",
            severity="high",
            confidence=0.92,
            risk_score=84,
            timestamp=now - timedelta(minutes=45),
            description="Worker PERSON_014 entered active reversing radius of Heavy Truck VEH_003.",
            recommended_action="Instruct worker to maintain 5m standoff distance and halt vehicle reverse.",
            ai_summary="Proximity condition persisted for 1.8 seconds at distance 1.2m.",
            status="acknowledged",
            acknowledged_at=now - timedelta(minutes=43)
        ),
        Incident(
            event_id="evt_init_002",
            camera_id="CAM_03",
            site_id="SITE_01",
            zone="Floor 1",
            event_type="no_harness",
            severity="high",
            confidence=0.89,
            risk_score=78,
            timestamp=now - timedelta(minutes=30),
            description="Worker observed near edge perimeter without safety harness lanyard secured.",
            recommended_action="Halt elevated work immediately; attach harness to lifeline.",
            ai_summary="Fall-hazard detected: worker within 1 meter of unprotected floor edge.",
            status="resolved",
            acknowledged_at=now - timedelta(minutes=28),
            resolved_at=now - timedelta(minutes=20)
        ),
        Incident(
            event_id="evt_init_003",
            camera_id="CAM_01",
            site_id="SITE_01",
            zone="Main Gate",
            event_type="no_helmet",
            severity="warning",
            confidence=0.94,
            risk_score=42,
            timestamp=now - timedelta(minutes=15),
            description="Subcontractor entered staging area without hard-hat.",
            recommended_action="Kiosk warning dispatched; issue PPE at checkpoint.",
            ai_summary="Head protection absent upon entry scan.",
            status="open"
        ),
        Incident(
            event_id="evt_init_004",
            camera_id="CAM_04",
            site_id="SITE_01",
            zone="Crane Area",
            event_type="zone_breach",
            severity="critical",
            confidence=0.96,
            risk_score=92,
            timestamp=now - timedelta(minutes=5),
            description="Unauthorized personnel breached live crane swing radius boundary.",
            recommended_action="Sound audible zone siren; operator hold hoist immediately.",
            ai_summary="Critical boundary breach detected during overhead load transit.",
            status="open"
        ),
    ]
    db.add_all(sample_incidents)

    db.commit()
    db.close()
    print("[SEED] Sahayi database successfully initialized and seeded!")

if __name__ == "__main__":
    seed_database()
