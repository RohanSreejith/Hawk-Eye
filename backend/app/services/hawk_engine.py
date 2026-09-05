import os
import time
import asyncio
from datetime import datetime
from typing import Dict, Any, List, Optional
from app.config import settings
from app.api.websocket import manager

VIDEO_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "data", "videos")

class HawkEngine:
    """
    HAWK (Harm Anticipation for Workplace Safety)
    Multi-Agent Collaborative Situational Awareness Engine.
    Coordinates perception agents across multiple cameras and maintains
    a centralized Shared State to anticipate hazards across warehouse zones.
    """
    # Scenario-specific video assignments from real multi-camera Cosmos warehouse folders
    SCENARIO_VIDEOS = {
        # step 1 - Baseline: Normal safe operations (box pickup in warehouse)
        1: {
            "camera_a": "box_pickup-rgb-00000/008caa590c5e5b7b4bca_run_8_seed_4731920.cam_00.rgb.mp4",
            "camera_b": "box_pickup-rgb-00000/008caa590c5e5b7b4bca_run_8_seed_4731920.cam_01.rgb.mp4",
        },
        # step 2 - Vehicle First Spotted
        2: {
            "camera_a": "nearmiss-rgb-00000/001e53453441935632ae_run_1_seed_1288693302.ceiling_00.rgb.mp4",
            "camera_b": "nearmiss-rgb-00000/001e53453441935632ae_run_1_seed_1288693302.ceiling_01.rgb.mp4",
        },
        # step 3 - Inbound Machinery Warning: forklift approaching entrance outside & worker inside doorway
        3: {
            "camera_a": "forklift_approaching_entrance.mp4",
            "camera_b": "worker_at_entrance_inside.mp4",
        },
        # step 4 - Anticipate: vehicle approaching loading zone (nearmiss setup)
        4: {
            "camera_a": "nearmiss-rgb-00000/001e53453441935632ae_run_1_seed_1288693302.ceiling_00.rgb.mp4",
            "camera_b": "nearmiss-rgb-00000/001e53453441935632ae_run_1_seed_1288693302.ceiling_01.rgb.mp4",
        },
        # step 5 - Conflict: forklift collision incident
        5: {
            "camera_a": "forklift_collision-rgb-00000/0021d0743dc26041d97b_run_5_seed_574698367.cam_01.rgb.mp4",
            "camera_b": "forklift_collision-rgb-00000/0021d0743dc26041d97b_run_5_seed_574698367.cam_00.rgb.mp4",
        },
        # step 6 - Resolve: back to calm baseline
        6: {
            "camera_a": "box_pickup-rgb-00000/008caa590c5e5b7b4bca_run_8_seed_4731920.cam_00.rgb.mp4",
            "camera_b": "box_pickup-rgb-00000/008caa590c5e5b7b4bca_run_8_seed_4731920.cam_01.rgb.mp4",
        },
        # step 7 - Fire Hazard: emergency smoke and flame in warehouse
        7: {
            "camera_a": "fire-rgb-00000/00023b5323028ab83e67_run_6_seed_1486583949.ceiling_00.rgb.mp4",
            "camera_b": "fire-rgb-00000/00023b5323028ab83e67_run_6_seed_1486583949.ceiling_01.rgb.mp4",
        },
    }

    def __init__(self):
        # Default assigned videos for Camera A (Entrance) and Camera B (Loading Area)
        self.camera_a_video = "box_pickup-rgb-00000/008caa590c5e5b7b4bca_run_8_seed_4731920.cam_00.rgb.mp4"
        self.camera_b_video = "box_pickup-rgb-00000/008caa590c5e5b7b4bca_run_8_seed_4731920.cam_01.rgb.mp4"

        # Shared State Data Structure matching HAWK UI (Default: Step 1 - Baseline All-Clear)
        self.active_events: List[Dict[str, Any]] = []

        self.known_entities: List[Dict[str, Any]] = [
            {
                "id": "P04",
                "name": "Worker P04",
                "type": "worker",
                "status": "Moving Cargo",
                "color": "#10b981",
                "location": "Zone A (Entrance)",
                "confidence": 0.88
            },
            {
                "id": "P17",
                "name": "Worker P17",
                "type": "worker",
                "status": "Loading Bay",
                "color": "#10b981",
                "location": "Zone B (Loading Area)",
                "confidence": 0.87
            },
            {
                "id": "V01",
                "name": "Forklift V01",
                "type": "vehicle",
                "status": "Stationary",
                "color": "#38bdf8",
                "location": "Zone A Bay",
                "confidence": 0.76
            }
        ]

        self.warehouse_zones: Dict[str, Any] = {
            "zone_a": {"name": "Zone A Entrance", "status": "clear", "entity": "V01"},
            "zone_b": {"name": "Zone B Loading Area", "status": "clear", "entity": "P17"},
            "transit_progress": 0.0
        }

        self.risk_assessment: Dict[str, Any] = {
            "vehicle_worker_proximity": "Clear (>8m)",
            "proximity_status": "safe",
            "trajectory_analysis": "Normal Warehouse Operations",
            "zone_conflict": "None",
            "conflict_status": "safe",
            "overall_risk": "LOW",
            "risk_level": "low",
            "risk_score": 12
        }

        self.event_stream: List[Dict[str, Any]] = [
            {"time": "10:24:00", "agent": "System", "color": "#10b981", "message": "All agents online & synchronized"},
            {"time": "10:24:05", "agent": "System", "color": "#10b981", "message": "Monitoring building zones under normal safety baseline."}
        ]

        self.safety_kiosk: Dict[str, Any] = {
            "active": False,
            "zone": "Zone B",
            "title": "ALL CLEAR",
            "message": "Zone B monitoring active - No hazards detected",
            "subtext": "Normal Operations",
            "severity": "safe",
            "timestamp": "10:24:00"
        }

        self.camera_overlays: Dict[str, Any] = {
            "camera_a": {
                "id": "CAM_A",
                "name": "Camera A – Entrance (Agent A)",
                "zone": "Zone A (Entrance)",
                "status": "LIVE",
                "detection": {
                    "label": "Forklift V01",
                    "conf": 0.76,
                    "box": [120, 180, 260, 420],
                    "color": "#38bdf8"
                },
                "caption": "Zone A – Safe Box Handling",
                "caption_color": "#ffffff",
                "timestamp": "10:24:00"
            },
            "camera_b": {
                "id": "CAM_B",
                "name": "Camera B – Loading Area (Agent B)",
                "zone": "Zone B (Loading Area)",
                "status": "LIVE",
                "detection": {
                    "label": "Worker P17",
                    "conf": 0.87,
                    "box": [820, 240, 900, 490],
                    "color": "#10b981"
                },
                "caption": "Zone B – Normal Activity",
                "subcaption": "All safety protocols compliant",
                "caption_color": "#10b981",
                "timestamp": "10:24:00"
            }
        }

    def get_state(self) -> Dict[str, Any]:
        """Returns the full HAWK shared state, dynamically synchronizing live AI vision detections."""
        now_time = datetime.now().strftime("%H:%M:%S")

        active_events = list(self.active_events)
        known_entities = list(self.known_entities)
        warehouse_zones = dict(self.warehouse_zones)
        risk_assessment = dict(self.risk_assessment)
        safety_kiosk = dict(self.safety_kiosk)
        cameras = dict(self.camera_overlays)

        # In baseline / live monitoring mode (step 1), reflect what the real-time AI CV cameras detect!
        if getattr(self, "current_step", 1) == 1:
            try:
                from app.services.camera_manager import camera_manager as _cm
                cam_a = _cm.hawk_streamer_a
                cam_b = _cm.hawk_streamer_b

                # Check Camera B (Loading Area / Zone B)
                ppe_violations_b = []
                with cam_b._state_lock:
                    for d in cam_b.active_detections:
                        if d.get("label") == "person":
                            hv = d.get("has_vest", True)
                            hh = d.get("has_helmet", True)
                            if not hv or not hh:
                                ppe_violations_b.append((d, hv, hh))

                # Check Camera A (Entrance / Zone A)
                ppe_violations_a = []
                with cam_a._state_lock:
                    for d in cam_a.active_detections:
                        if d.get("label") == "person":
                            hv = d.get("has_vest", True)
                            hh = d.get("has_helmet", True)
                            if not hv or not hh:
                                ppe_violations_a.append((d, hv, hh))

                if ppe_violations_b or ppe_violations_a:
                    live_events = []

                    if ppe_violations_b:
                        _, hv, hh = ppe_violations_b[0]
                        missing_b = []
                        if not hh: missing_b.append("Helmet")
                        if not hv: missing_b.append("Safety Vest")
                        items_b_str = " & ".join(missing_b)

                        live_events.append({
                            "id": "EVT_PPE_B",
                            "event_type": "PPE_VIOLATION",
                            "title": f"Missing {items_b_str}",
                            "worker_id": "P17",
                            "zone": "Zone B (Loading Area)",
                            "target_zone": "Zone B (Loading Area)",
                            "detail": f"Worker active without required {items_b_str}",
                            "time": now_time,
                            "status": "active",
                            "severity": "warning"
                        })

                        # ZONE B SAFETY KIOSK MUST TRIGGER ALARM!
                        safety_kiosk = {
                            "active": True,
                            "zone": "Zone B",
                            "title": "PPE NON-COMPLIANCE DETECTED",
                            "message": f"Worker in Zone B missing required {items_b_str}!",
                            "subtext": "MANDATORY SAFETY GEAR REQUIRED • SECURE HEAD & BODY PROTECTION",
                            "severity": "warning",
                            "timestamp": now_time
                        }

                        cameras["camera_b"] = {
                            **cameras.get("camera_b", {}),
                            "caption": f"Zone B – PPE Violation (No {items_b_str})",
                            "subcaption": "Worker non-compliant with site safety policy",
                            "caption_color": "#ef4444"
                        }

                    if ppe_violations_a:
                        _, hv, hh = ppe_violations_a[0]
                        missing_a = []
                        if not hh: missing_a.append("Helmet")
                        if not hv: missing_a.append("Safety Vest")
                        items_a_str = " & ".join(missing_a)

                        live_events.append({
                            "id": "EVT_PPE_A",
                            "event_type": "PPE_VIOLATION",
                            "title": f"Missing {items_a_str}",
                            "worker_id": "P04",
                            "zone": "Zone A (Entrance)",
                            "target_zone": "Zone A (Entrance)",
                            "detail": f"Worker active without required {items_a_str}",
                            "time": now_time,
                            "status": "active",
                            "severity": "warning"
                        })

                        cameras["camera_a"] = {
                            **cameras.get("camera_a", {}),
                            "caption": f"Zone A – PPE Violation (No {items_a_str})",
                            "caption_color": "#f59e0b"
                        }

                    active_events = live_events

                    # Update Risk Assessment
                    risk_assessment = {
                        "vehicle_worker_proximity": "Clear (>8m)",
                        "proximity_status": "safe",
                        "trajectory_analysis": "Normal Warehouse Operations",
                        "zone_conflict": "PPE Protocol Breach",
                        "conflict_status": "warning",
                        "overall_risk": "ELEVATED",
                        "risk_level": "medium",
                        "risk_score": 45
                    }

                    # Update Known Entities
                    known_entities = [
                        {
                            "id": "P04",
                            "name": "Worker P04",
                            "type": "worker",
                            "status": "No Vest" if ppe_violations_a else "Compliant",
                            "color": "#f59e0b" if ppe_violations_a else "#10b981",
                            "location": "Zone A (Entrance)",
                            "confidence": 0.88
                        },
                        {
                            "id": "P17",
                            "name": "Worker P17",
                            "type": "worker",
                            "status": "Non-Compliant (No PPE)" if ppe_violations_b else "Compliant",
                            "color": "#ef4444" if ppe_violations_b else "#10b981",
                            "location": "Zone B (Loading Area)",
                            "confidence": 0.91
                        },
                        {
                            "id": "V01",
                            "name": "Forklift V01",
                            "type": "vehicle",
                            "status": "Stationary",
                            "color": "#38bdf8",
                            "location": "Zone A Bay",
                            "confidence": 0.76
                        }
                    ]

                    # Throttle event stream logging to avoid spam
                    last_log = getattr(self, "_last_ppe_log_time", 0)
                    if time.time() - last_log > 20:
                        self._last_ppe_log_time = time.time()
                        self.add_event_stream_message(
                            "Agent B" if ppe_violations_b else "Agent A",
                            f"⚠️ PPE Alert: Worker detected without required safety equipment!",
                            "#f59e0b"
                        )

            except Exception as e:
                print(f"[HAWK GET_STATE ERROR]: {e}")

        # Live CV Vehicle Proximity Synchronization across all modes
        try:
            from app.services.camera_manager import camera_manager as _cm
            cam_a = _cm.hawk_streamer_a
            cam_b = _cm.hawk_streamer_b

            step = getattr(self, "current_step", 1)
            active_pair = getattr(cam_a, 'closest_pair', None) or getattr(cam_b, 'closest_pair', None)
            if active_pair and step in [1, 2, 4, 5]:
                _, _, _, dist_m = active_pair

                if step == 1:
                    # In Baseline, machine is parked/stationary in the bay! Not a collision hazard!
                    risk_assessment["vehicle_worker_proximity"] = f"Stationary ({dist_m:.1f}m Clearance)"
                    risk_assessment["proximity_status"] = "safe"
                    for ent in known_entities:
                        if ent.get("id") == "V01":
                            ent["status"] = "Stationary (Parked in Bay)"
                    if getattr(cam_a, 'closest_pair', None):
                        cameras["camera_a"] = {
                            **cameras.get("camera_a", {}),
                            "caption": f"Zone A – Stationary Forklift ({dist_m:.1f}m Clearance)"
                        }
                elif step in [2, 4]:
                    # Anticipate mode (Steps 2, 4): Proactive Warning for Inbound Vehicle from Agent A!
                    risk_assessment["vehicle_worker_proximity"] = f"Inbound ({dist_m:.1f}m)"
                    risk_assessment["proximity_status"] = "warning"
                    if risk_assessment.get("overall_risk") not in ["CRITICAL", "HIGH"]:
                        risk_assessment["overall_risk"] = "ELEVATED"
                        risk_assessment["risk_level"] = "medium"
                        risk_assessment["risk_score"] = 55
                    for ent in known_entities:
                        if ent.get("id") == "V01":
                            ent["status"] = f"Inbound ({dist_m:.1f}m)"
                            ent["color"] = "#f59e0b"
                    safety_kiosk = {
                        "active": True,
                        "zone": "Zone B",
                        "title": "VEHICLE APPROACHING",
                        "message": f"Vehicle V01 inbound to Zone B (Estimated {dist_m:.1f}m)",
                        "subtext": "Stay Alert • Maintain Safe Distance",
                        "severity": "warning",
                        "timestamp": now_time
                    }
                    if getattr(cam_a, 'closest_pair', None):
                        cameras["camera_a"] = {
                            **cameras.get("camera_a", {}),
                            "caption": f"Vehicle approaching Zone B corridor ({dist_m:.1f}m)"
                        }
                    cameras["camera_b"] = {
                        **cameras.get("camera_b", {}),
                        "caption": f"Zone B – Inbound Corridor Monitored ({dist_m:.1f}m)",
                        "subcaption": "Synchronized multi-angle tracking with Agent A"
                    }
                elif step == 5:
                    # Conflict / Incident step: Critical Collision Proximity
                    risk_assessment["vehicle_worker_proximity"] = f"{dist_m:.1f}m Critical Breach"
                    risk_assessment["proximity_status"] = "critical"
                    risk_assessment["overall_risk"] = "CRITICAL"
                    risk_assessment["risk_level"] = "critical"
                    risk_assessment["risk_score"] = 95
                    safety_kiosk = {
                        "active": True,
                        "zone": "Zone B",
                        "title": "IMMINENT COLLISION HAZARD",
                        "message": f"Forklift V01 impact breach ({dist_m:.1f}m)! Emergency Brake Engaged!",
                        "subtext": "AUTONOMOUS BRAKE ARMED • MAINTAIN SAFE DISTANCE",
                        "severity": "critical",
                        "timestamp": now_time
                    }

                    # Update Known Entities V01 status dynamically for collision
                    for ent in known_entities:
                        if ent.get("id") == "V01":
                            ent["status"] = f"Collision Breach ({dist_m:.1f}m)"

                    if getattr(cam_a, 'closest_pair', None):
                        cameras["camera_a"] = {
                            **cameras.get("camera_a", {}),
                            "caption": f"Imminent Collision Risk ({dist_m:.1f}m)"
                        }
                    if getattr(cam_b, 'closest_pair', None):
                        cameras["camera_b"] = {
                            **cameras.get("camera_b", {}),
                            "caption": f"Impact Hazard in Zone B ({dist_m:.1f}m)"
                        }
        except Exception as e:
            pass

        return {
            "system_name": "HAWK – Harm Anticipation for Workplace Safety",
            "subtitle": "Multi-Agent AI Safety Network",
            "system_status": "System Online",
            "active_events": active_events,
            "known_entities": known_entities,
            "warehouse_zones": warehouse_zones,
            "risk_assessment": risk_assessment,
            "event_stream": self.event_stream,
            "safety_kiosk": safety_kiosk,
            "cameras": cameras,
            "camera_a_video": self.camera_a_video,
            "camera_b_video": self.camera_b_video
        }

    async def broadcast_state(self):
        """Broadcasts the entire HAWK state over WebSocket to all clients."""
        await manager.broadcast({
            "type": "hawk_state_updated",
            "hawk_state": self.get_state()
        })

    def set_camera_videos(self, camera_a: Optional[str] = None, camera_b: Optional[str] = None):
        """Assigns video files to Camera A and/or Camera B."""
        if camera_a:
            self.camera_a_video = camera_a
        if camera_b:
            self.camera_b_video = camera_b

    def add_event_stream_message(self, agent: str, message: str, color: str = "#00f2fe"):
        """Appends a new event message to the event stream."""
        now_time = datetime.now().strftime("%H:%M:%S")
        entry = {
            "time": now_time,
            "agent": agent,
            "color": color,
            "message": message
        }
        self.event_stream.append(entry)
        if len(self.event_stream) > 30:
            self.event_stream.pop(0)

    async def run_scenario_step(self, step: int):
        """
        Drives the multi-agent anticipation scenario through progressive stages:
        Step 1: Normal monitoring
        Step 2: Agent A detects Forklift V01 at entrance
        Step 3: Agent A publishes VEHICLE_INBOUND; Shared State updates
        Step 4: Agent B receives event, anticipates conflict with Worker P17, arms Zone B Kiosk!
        Step 5: Forklift arrives in Zone B, proximity conflict imminent
        Step 6: Worker yields, forklift stops, incident resolved
        """
        now = datetime.now().strftime("%H:%M:%S")
        self.current_step = step

        # Determine scenario mode for live CV evaluation
        mode_map = {
            1: "baseline",
            2: "anticipate",
            3: "warn",
            4: "anticipate",
            5: "conflict",
            6: "baseline",
            7: "fire",
        }
        mode = mode_map.get(step, "baseline")

        # Switch camera footage for this scenario step — hot-swap live MJPEG streamers
        if step in self.SCENARIO_VIDEOS:
            vids = self.SCENARIO_VIDEOS[step]
            self.camera_a_video = vids["camera_a"]
            self.camera_b_video = vids["camera_b"]
            # Hot-swap the live streamers so inference runs on the right footage
            try:
                from app.services.camera_manager import camera_manager as _cm
                import os as _os
                path_a = _os.path.join(VIDEO_DIR, vids["camera_a"])
                path_b = _os.path.join(VIDEO_DIR, vids["camera_b"])
                _cm.set_hawk_videos(path_a, path_b)
                _cm.set_scenario_mode(mode)
            except Exception as e:
                print(f"[HAWK ENGINE] Could not swap streamer videos: {e}")

        if step == 1:
            self.risk_assessment = {
                "vehicle_worker_proximity": "Clear (>8m)",
                "proximity_status": "safe",
                "trajectory_analysis": "Normal Warehouse Operations",
                "zone_conflict": "None",
                "conflict_status": "safe",
                "overall_risk": "LOW",
                "risk_level": "low",
                "risk_score": 12
            }
            self.safety_kiosk = {
                "active": False,
                "zone": "Zone B",
                "title": "ALL CLEAR",
                "message": "Zone B monitoring active - No hazards detected",
                "subtext": "Normal Operations",
                "severity": "safe",
                "timestamp": now
            }
            self.active_events = []
            self.known_entities = [
                {"id": "P04", "name": "Worker P04", "type": "worker", "status": "Moving Cargo",
                 "color": "#10b981", "location": "Zone A (Entrance)", "confidence": 0.88},
                {"id": "P17", "name": "Worker P17", "type": "worker", "status": "Loading Bay",
                 "color": "#10b981", "location": "Zone B (Loading Area)", "confidence": 0.87},
                {"id": "V01", "name": "Forklift V01", "type": "vehicle", "status": "Stationary",
                 "color": "#38bdf8", "location": "Zone A Bay", "confidence": 0.76}
            ]
            self.camera_overlays["camera_a"]["detection"] = {
                "label": "Forklift V01", "conf": 0.76, "box_pct": [20.9, 26.6, 15.7, 24.4], "color": "#38bdf8"
            }
            self.camera_overlays["camera_a"]["detections"] = [
                {"label": "Forklift V01", "conf": 0.76, "box_pct": [20.9, 26.6, 15.7, 24.4], "color": "#38bdf8"},
                {"label": "Worker P04", "conf": 0.88, "box_pct": [41.1, 40.0, 6.3, 25.0], "color": "#10b981"}
            ]
            self.camera_overlays["camera_a"]["caption"] = "Zone A – Safe Box Handling"
            self.camera_overlays["camera_a"]["timestamp"] = now

            self.camera_overlays["camera_b"]["detection"] = {
                "label": "Worker P17", "conf": 0.87, "box_pct": [50.7, 50.0, 4.2, 17.6], "color": "#10b981"
            }
            self.camera_overlays["camera_b"]["detections"] = [
                {"label": "Worker P17", "conf": 0.87, "box_pct": [50.7, 50.0, 4.2, 17.6], "color": "#10b981"}
            ]
            self.camera_overlays["camera_b"]["caption"] = "Zone B – Normal Activity"
            self.camera_overlays["camera_b"]["subcaption"] = "All safety protocols compliant"
            self.camera_overlays["camera_b"]["timestamp"] = now

            self.warehouse_zones["transit_progress"] = 0.0
            self.warehouse_zones["zone_a"]["status"] = "clear"
            self.warehouse_zones["zone_b"]["status"] = "clear"
            self.add_event_stream_message("System", "Monitoring building zones under normal safety baseline.", "#10b981")

        elif step == 2:
            self.known_entities = [
                {"id": "V01", "name": "Forklift V01", "type": "vehicle", "status": "At entrance",
                 "color": "#f59e0b", "location": "Zone A (Corridor)", "confidence": 0.89},
                {"id": "P17", "name": "Worker P17", "type": "worker", "status": "In zone B",
                 "color": "#10b981", "location": "Zone B (Loading Area)", "confidence": 0.90}
            ]
            self.camera_overlays["camera_a"]["detection"] = {
                "label": "Worker P04", "conf": 0.89, "box_pct": [35.3, 43.7, 9.1, 34.2], "color": "#00f2fe"
            }
            self.camera_overlays["camera_a"]["detections"] = [
                {"label": "Worker P04", "conf": 0.89, "box_pct": [35.3, 43.7, 9.1, 34.2], "color": "#00f2fe"}
            ]
            self.camera_overlays["camera_a"]["caption"] = f"Vehicle detected at entrance – {now}"
            self.camera_overlays["camera_a"]["timestamp"] = now
            self.warehouse_zones["zone_a"]["status"] = "active_traffic"
            self.add_event_stream_message("Agent A", "Detected vehicle V01 entering transit corridor (Conf: 0.89)", "#00f2fe")

        elif step == 3:
            # INBOUND MACHINERY WARNING SCENARIO:
            # Forklift approaching entrance outside (Cam 1), worker standing at doorway inside (Cam 2)
            # System warns the worker that heavy machinery is coming and to move out of the way!
            self.risk_assessment = {
                "vehicle_worker_proximity": "Inbound to Doorway (~3.5m)",
                "proximity_status": "warning",
                "trajectory_analysis": "Heavy Machinery Approaching Entrance Doorway",
                "zone_conflict": "Critical Clearance Required",
                "conflict_status": "warning",
                "overall_risk": "HIGH",
                "risk_level": "high",
                "risk_score": 84
            }
            self.safety_kiosk = {
                "active": True,
                "zone": "Entrance Doorway (Zone A -> Zone B)",
                "title": "HEAVY MACHINERY APPROACHING",
                "message": "Warning: Heavy machinery approaching entrance! Move out of the way immediately!",
                "subtext": "DOORWAY CLEARANCE ALERT • AUTONOMOUS SENSOR INTERLOCK",
                "severity": "warning",
                "timestamp": now
            }
            self.active_events = [{
                "id": "EVT_INBOUND_MACHINERY",
                "event_type": "INBOUND_MACHINERY",
                "title": "Heavy Machinery Approaching Entrance",
                "vehicle_id": "Forklift V01",
                "worker_id": "Worker P12 (Doorway)",
                "zone": "Entrance Exterior (Zone A)",
                "target_zone": "Entrance Doorway (Zone B)",
                "detail": "Forklift V01 detected approaching entrance from outside. Worker P12 standing at entrance doorway from inside. Clear doorway pathway immediately!",
                "time": now,
                "status": "warning",
                "severity": "warning"
            }]
            self.known_entities = [
                {"id": "V01", "name": "Forklift V01", "type": "vehicle", "status": "Approaching Entrance (Exterior)",
                 "color": "#f59e0b", "location": "Entrance Exterior (Zone A)", "confidence": 0.89},
                {"id": "P12", "name": "Worker P12", "type": "worker", "status": "In Doorway Pathway (Warned to Clear)",
                 "color": "#ef4444", "location": "Entrance Doorway (Zone B)", "confidence": 0.92},
                {"id": "P04", "name": "Worker P04", "type": "worker", "status": "Safe in Corridor",
                 "color": "#10b981", "location": "Zone A (Interior)", "confidence": 0.86}
            ]
            self.camera_overlays["camera_a"]["detection"] = {
                "label": "Forklift V01", "conf": 0.89, "box_pct": [25.0, 30.0, 45.0, 40.0], "color": "#f59e0b"
            }
            self.camera_overlays["camera_a"]["detections"] = [
                {"label": "Forklift V01", "conf": 0.89, "box_pct": [25.0, 30.0, 45.0, 40.0], "color": "#f59e0b"}
            ]
            self.camera_overlays["camera_a"]["caption"] = "Cam 1 Entrance (Outside) — Forklift Approaching Doorway"
            self.camera_overlays["camera_a"]["timestamp"] = now

            self.camera_overlays["camera_b"]["detection"] = {
                "label": "Worker P12", "conf": 0.92, "box_pct": [40.0, 20.0, 25.0, 60.0], "color": "#ef4444"
            }
            self.camera_overlays["camera_b"]["detections"] = [
                {"label": "Worker P12", "conf": 0.92, "box_pct": [40.0, 20.0, 25.0, 60.0], "color": "#ef4444"}
            ]
            self.camera_overlays["camera_b"]["caption"] = "Cam 2 Entrance (Inside) — Worker in Doorway Pathway"
            self.camera_overlays["camera_b"]["subcaption"] = "Warning Broadcasted: Move Out of the Way"
            self.camera_overlays["camera_b"]["timestamp"] = now

            self.warehouse_zones["transit_progress"] = 0.55
            self.warehouse_zones["zone_a"]["status"] = "warning"
            self.warehouse_zones["zone_b"]["status"] = "warning"
            self.add_event_stream_message("Cam 1 (Outside)", "Detected Forklift V01 approaching entrance doorway", "#00f2fe")
            self.add_event_stream_message("Cam 2 (Inside)", "⚠️ Worker P12 in doorway pathway: Warning dispatched to move out of the way!", "#ef4444")
            self.add_event_stream_message("Safety Kiosk", "DOORWAY ALERT: Heavy machinery approaching, vacate entrance immediately!", "#f59e0b")

        elif step == 4:
            # ANTICIPATION: Vehicle not visible on Camera B yet, but kiosk is armed!
            self.warehouse_zones["transit_progress"] = 0.75
            self.risk_assessment = {
                "vehicle_worker_proximity": "Approaching Corridor",
                "proximity_status": "warning",
                "trajectory_analysis": "Inbound (Not yet visible on Cam B)",
                "zone_conflict": "Possible",
                "conflict_status": "warning",
                "overall_risk": "MEDIUM",
                "risk_level": "medium",
                "risk_score": 68
            }
            self.active_events = [{
                "id": "EVT_INBOUND_01",
                "event_type": "VEHICLE_INBOUND",
                "title": "Inbound Vehicle Approaching Zone B",
                "worker_id": "P17 (Target Area)",
                "zone": "Transit Corridor",
                "target_zone": "Zone B (Loading Area)",
                "detail": "Forklift V01 in transit approaching Zone B loading dock. Pre-warning active on Zone B Kiosk.",
                "time": now,
                "status": "anticipating",
                "severity": "warning"
            }]
            self.known_entities = [
                {"id": "V01", "name": "Forklift V01", "type": "vehicle", "status": "Inbound to Zone B",
                 "color": "#f59e0b", "location": "Transit Corridor", "confidence": 0.92},
                {"id": "P17", "name": "Worker P17", "type": "worker", "status": "Working in Bay (Pre-Warned)",
                 "color": "#10b981", "location": "Zone B (Loading Area)", "confidence": 0.90},
                {"id": "P04", "name": "Worker P04", "type": "worker", "status": "Clear of Transit Path",
                 "color": "#10b981", "location": "Zone A (Entrance)", "confidence": 0.88}
            ]
            self.safety_kiosk = {
                "active": True,
                "zone": "Zone B",
                "title": "VEHICLE APPROACHING",
                "message": "Vehicle V01 inbound to this area",
                "subtext": "Stay Alert • Maintain Safe Distance",
                "severity": "warning",
                "timestamp": now
            }
            self.camera_overlays["camera_a"]["detection"] = {
                "label": "Worker P04", "conf": 0.89, "box_pct": [35.3, 43.7, 9.1, 34.2], "color": "#00f2fe"
            }
            self.camera_overlays["camera_a"]["detections"] = [
                {"label": "Worker P04", "conf": 0.89, "box_pct": [35.3, 43.7, 9.1, 34.2], "color": "#00f2fe"}
            ]
            self.camera_overlays["camera_a"]["caption"] = "Vehicle approaching Zone B corridor"
            self.camera_overlays["camera_a"]["timestamp"] = now

            self.camera_overlays["camera_b"]["detection"] = {
                "label": "Worker P17", "conf": 0.90, "box_pct": [58.4, 16.8, 6.8, 28.3], "color": "#10b981"
            }
            self.camera_overlays["camera_b"]["detections"] = [
                {"label": "Worker P17", "conf": 0.90, "box_pct": [58.4, 16.8, 6.8, 28.3], "color": "#10b981"}
            ]
            self.camera_overlays["camera_b"]["caption"] = "Zone B – Inbound Corridor Monitored"
            self.camera_overlays["camera_b"]["subcaption"] = "Synchronized multi-angle tracking with Agent A"
            self.camera_overlays["camera_b"]["timestamp"] = now

            self.add_event_stream_message("Agent B", "← Received VEHICLE_INBOUND: Anticipating conflict with Worker P17", "#818cf8")
            self.add_event_stream_message("System", "Safety Kiosk in Zone B Armed: VEHICLE APPROACHING", "#f59e0b")

        elif step == 5:
            # Forklift Collision in Zone B -> CRITICAL
            self.warehouse_zones["transit_progress"] = 1.0
            self.warehouse_zones["zone_b"]["status"] = "critical"
            self.risk_assessment = {
                "vehicle_worker_proximity": "CRITICAL (<1.0m)",
                "proximity_status": "critical",
                "trajectory_analysis": "Direct Impact Vector Detected",
                "zone_conflict": "IMMINENT COLLISION",
                "conflict_status": "critical",
                "overall_risk": "CRITICAL",
                "risk_level": "critical",
                "risk_score": 98
            }
            self.active_events = [{
                "id": "EVT_CONFLICT_01",
                "event_type": "COLLISION_IMMINENT",
                "title": "Imminent Vehicle Collision Breach",
                "worker_id": "P17 / AGV-01",
                "zone": "Zone B (Loading Bay)",
                "target_zone": "Zone B Impact Area",
                "detail": "Forklift V01 direct collision breach (<1.5m) in Zone B! Autonomous Emergency Brake Engaged!",
                "time": now,
                "status": "active",
                "severity": "critical"
            }]
            self.known_entities = [
                {"id": "V01", "name": "Forklift V01", "type": "vehicle", "status": "Emergency Brake Engaged",
                 "color": "#ef4444", "location": "Zone B", "confidence": 0.96},
                {"id": "P17", "name": "Worker P17", "type": "worker", "status": "In Impact Path",
                 "color": "#ef4444", "location": "Zone B", "confidence": 0.94},
                {"id": "P04", "name": "Worker P04", "type": "worker", "status": "Safe (Zone A)",
                 "color": "#10b981", "location": "Zone A (Entrance)", "confidence": 0.88}
            ]
            self.safety_kiosk = {
                "active": True,
                "zone": "Zone B",
                "title": "COLLISION HAZARD - STOP",
                "message": "Forklift V01 collision event in Zone B!",
                "subtext": "EMERGENCY BRAKE ENGAGED • EVACUATE OPERATING PATH",
                "severity": "critical",
                "timestamp": now
            }
            self.camera_overlays["camera_a"]["detection"] = {
                "label": "Forklift V01", "conf": 0.94, "box_pct": [40.3, 0.4, 38.8, 59.7], "color": "#ef4444"
            }
            self.camera_overlays["camera_a"]["detections"] = [
                {"label": "Forklift V01", "conf": 0.94, "box_pct": [40.3, 0.4, 38.8, 59.7], "color": "#ef4444"}
            ]
            self.camera_overlays["camera_a"]["caption"] = "CRITICAL: Forklift collision in Zone B"
            self.camera_overlays["camera_a"]["timestamp"] = now

            self.camera_overlays["camera_b"]["detection"] = {
                "label": "Collision Zone", "conf": 0.91, "box_pct": [42.2, 23.8, 16.3, 33.1], "color": "#ef4444"
            }
            self.camera_overlays["camera_b"]["detections"] = [
                {"label": "Collision Zone", "conf": 0.91, "box_pct": [42.2, 23.8, 16.3, 33.1], "color": "#ef4444"}
            ]
            self.camera_overlays["camera_b"]["caption"] = "IMPACT DETECTED - FORKLIFT HAZARD"
            self.camera_overlays["camera_b"]["subcaption"] = "Emergency Stop Broadcasted to Site Systems"
            self.camera_overlays["camera_b"]["timestamp"] = now

            self.add_event_stream_message("Agent B", "🚨 CRITICAL: Forklift collision impact detected in Zone B!", "#ef4444")
            self.add_event_stream_message("System", "Autonomous Emergency Brake Triggered for Vehicle V01", "#ef4444")

        elif step == 7:
            # Fire Emergency
            self.warehouse_zones["transit_progress"] = 0.0
            self.warehouse_zones["zone_b"]["status"] = "critical"
            self.warehouse_zones["zone_a"]["status"] = "warning"
            self.risk_assessment = {
                "vehicle_worker_proximity": "Emergency Evacuation",
                "proximity_status": "critical",
                "trajectory_analysis": "Active Smoke & Flame Spread",
                "zone_conflict": "FIRE HAZARD",
                "conflict_status": "critical",
                "overall_risk": "CRITICAL EMERGENCY",
                "risk_level": "critical",
                "risk_score": 99
            }
            self.safety_kiosk = {
                "active": True,
                "zone": "Zone B",
                "title": "FIRE EMERGENCY - EVACUATE",
                "message": "Thermal anomaly & active combustion detected!",
                "subtext": "PROCEED TO NEAREST EMERGENCY EXIT IMMEDIATELY",
                "severity": "critical",
                "timestamp": now
            }
            self.camera_overlays["camera_a"]["detection"] = {
                "label": "Fire Hazard (F-01)", "conf": 0.96, "box_pct": [60.0, 40.0, 28.0, 35.0], "color": "#dc2626"
            }
            self.camera_overlays["camera_a"]["detections"] = [
                {"label": "Fire Hazard (F-01)", "conf": 0.96, "box_pct": [60.0, 40.0, 28.0, 35.0], "color": "#dc2626"},
                {"label": "Evacuating Worker", "conf": 0.82, "box_pct": [76.2, 61.9, 2.8, 10.0], "color": "#f59e0b"}
            ]
            self.camera_overlays["camera_a"]["caption"] = "FIRE SENSOR ALERT: Evacuation Corridor Active"
            self.camera_overlays["camera_a"]["subcaption"] = "Workers Proceeding to Nearest Emergency Exit"
            self.camera_overlays["camera_a"]["timestamp"] = now

            self.camera_overlays["camera_b"]["detection"] = {
                "label": "Active Smoke Spread", "conf": 0.91, "box_pct": [20.0, 25.0, 45.0, 40.0], "color": "#dc2626"
            }
            self.camera_overlays["camera_b"]["detections"] = [
                {"label": "Active Smoke Spread", "conf": 0.91, "box_pct": [20.0, 25.0, 45.0, 40.0], "color": "#dc2626"}
            ]
            self.camera_overlays["camera_b"]["caption"] = "EVACUATION ORDER IN EFFECT"
            self.camera_overlays["camera_b"]["subcaption"] = "Fire Suppression Sprinklers Armed"
            self.camera_overlays["camera_b"]["timestamp"] = now

            self.active_events = [
                {
                    "id": "EVT_FIRE_01",
                    "event_type": "FIRE_EMERGENCY",
                    "title": "Thermal Combustion Anomaly",
                    "worker_id": "P04 / P17",
                    "zone": "Zone B (Storage Bay)",
                    "target_zone": "Building Wide Evacuation",
                    "detail": "High-temperature combustion and active smoke spread detected in Zone B storage racking!",
                    "time": now,
                    "status": "active",
                    "severity": "critical"
                }
            ]
            self.known_entities = [
                {"id": "FIRE_01", "name": "Thermal Hazard F-01", "type": "hazard", "status": "Active Flame",
                 "color": "#ef4444", "location": "Zone B (Storage Bay)", "confidence": 0.96},
                {"id": "P04", "name": "Worker P04", "type": "worker", "status": "Evacuating",
                 "color": "#f59e0b", "location": "Exit Corridor", "confidence": 0.82}
            ]
            self.add_event_stream_message("Agent A", "🚨 THERMAL ALERT: Active fire detected in Zone B storage racking!", "#dc2626")
            self.add_event_stream_message("System", "Building Fire Alarms Activated • HVAC Damper Shutdown Initiated", "#dc2626")

        elif step == 6:
            # Resolved
            self.risk_assessment = {
                "vehicle_worker_proximity": "Clear (>10m)",
                "proximity_status": "safe",
                "trajectory_analysis": "All Hazards Clear",
                "zone_conflict": "None",
                "conflict_status": "safe",
                "overall_risk": "RESOLVED",
                "risk_level": "safe",
                "risk_score": 10
            }
            self.safety_kiosk = {
                "active": False,
                "zone": "Zone B",
                "title": "ALL CLEAR",
                "message": "Zone B secured - All hazards cleared",
                "subtext": "Normal Operations",
                "severity": "safe",
                "timestamp": now
            }
            self.active_events = []
            self.warehouse_zones["transit_progress"] = 0.0
            self.warehouse_zones["zone_a"]["status"] = "clear"
            self.warehouse_zones["zone_b"]["status"] = "clear"
            self.camera_overlays["camera_a"]["detection"] = None
            self.camera_overlays["camera_a"]["detections"] = []
            self.camera_overlays["camera_a"]["caption"] = "Zone A – Safe Baseline Monitoring"
            self.camera_overlays["camera_b"]["detection"] = None
            self.camera_overlays["camera_b"]["detections"] = []
            self.camera_overlays["camera_b"]["caption"] = "Zone B – Area Secured & All Clear"
            self.camera_overlays["camera_b"]["subcaption"] = "All agents returned to surveillance mode"
            self.known_entities = [
                {"id": "P17", "name": "Worker P17", "type": "worker", "status": "Safe – Clear",
                 "color": "#10b981", "location": "Zone B", "confidence": 0.88},
                {"id": "P04", "name": "Worker P04", "type": "worker", "status": "Safe – Clear",
                 "color": "#10b981", "location": "Zone A", "confidence": 0.89}
            ]
            self.add_event_stream_message("Supervisor", "Incident marked resolved. Area cleared and verified safe.", "#10b981")
            self.add_event_stream_message("System", "All HAWK agents returning to baseline monitoring.", "#10b981")

        await self.broadcast_state()

hawk_engine = HawkEngine()
