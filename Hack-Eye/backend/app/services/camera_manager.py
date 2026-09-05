import os
os.environ["OPENCV_FFMPEG_THREADS"] = "1"
import cv2
cv2.setNumThreads(1)
import time
import asyncio
import threading
import numpy as np
from typing import Dict, Any, List, Optional
from app.config import settings
from app.cv.detector import model_manager
from app.cv.ppe import ppe_engine
from app.cv.proximity import proximity_engine
from app.agents.coordinator import agent_coordinator

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SAHAYI_ROOT = os.path.dirname(BACKEND_DIR)
VIDEO_DIR = os.path.join(SAHAYI_ROOT, "data", "videos")
os.makedirs(VIDEO_DIR, exist_ok=True)

_cv_lock = threading.Lock()

class CameraStreamer:
    """
    Manages live camera feeds with real YOLO inference on video files or camera streams.
    Draws industrial bounding boxes (TRUCK #4, PERSON #12 NO HELMET) directly on the stream.
    """
    def __init__(self, camera_id: str, name: str, zone: str, video_path: Optional[str] = None):
        self.camera_id = camera_id
        self.name = name
        self.zone = zone
        self.is_active = True
        self.video_path = video_path
        self.cap = None
        self.step = 0
        self.active_detections = []
        self._init_capture()

    def _init_capture(self):
        with _cv_lock:
            if self.cap is not None:
                self.cap.release()
                self.cap = None

            if self.video_path and os.path.exists(self.video_path):
                self.cap = cv2.VideoCapture(self.video_path)
            else:
                # Check if default sample video exists
                default_vid = os.path.join(VIDEO_DIR, "loading_zone_truck.mp4")
                if os.path.exists(default_vid):
                    self.video_path = default_vid
                    self.cap = cv2.VideoCapture(default_vid)

    def set_video(self, path: str):
        self.video_path = path
        self._init_capture()

    def get_frame(self) -> np.ndarray:
        self.step += 1
        width, height = 960, 540

        frame = None
        with _cv_lock:
            if self.cap and self.cap.isOpened():
                ret, grabbed = self.cap.read()
                if not ret:
                    # Rewind and loop video continuously
                    self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    ret, grabbed = self.cap.read()
                if ret and grabbed is not None:
                    frame = cv2.resize(grabbed, (width, height))

        if frame is None:
            # Synthesize crisp industrial construction backdrop
            frame = np.full((height, width, 3), (30, 36, 44), dtype=np.uint8)
            cv2.rectangle(frame, (0, int(height * 0.5)), (width, height), (65, 75, 85), -1)
            cv2.putText(frame, "CCTV FEED CONNECTING...", (int(width * 0.35), int(height * 0.5)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 210, 220), 2)

        # Run Real YOLO Detection every 3 frames for smooth performance
        detector = model_manager.get_detector()
        ppe_spec = model_manager.get_ppe_model()
        if self.step % 3 == 0:
            raw_dets = detector.detect(frame)

            min_vehicle_area = (width * height) * 0.015  # 1.5% of frame
            filtered_dets = []
            found_vehicle = None

            for d in raw_dets:
                lbl = d.get("label", "")
                b = d.get("bbox", {})
                area = (b.get("x2", 0) - b.get("x1", 0)) * (b.get("y2", 0) - b.get("y1", 0))
                conf = d.get("confidence", 0)
                if lbl in ["forklift", "truck", "car", "bus"]:
                    if area >= min_vehicle_area:
                        filtered_dets.append(d)
                        found_vehicle = d
                else:
                    filtered_dets.append(d)

            # Persist vehicle detection across minor frame skips
            if found_vehicle:
                self.persisted_vehicle = found_vehicle
                self.vehicle_hold_count = 8
            elif getattr(self, 'vehicle_hold_count', 0) > 0:
                self.vehicle_hold_count -= 1
                if getattr(self, 'persisted_vehicle', None) and not any(d.get("label") in ["forklift", "truck", "car", "bus"] for d in filtered_dets):
                    filtered_dets.append(self.persisted_vehicle)
            else:
                self.persisted_vehicle = None

            self.active_detections = filtered_dets

            # Also run PPE specialist model over the full frame
            if ppe_spec.is_loaded:
                self.active_ppe_items = ppe_spec.detect_ppe(frame)
            else:
                self.active_ppe_items = []

        # --- Helmet guard ---
        ppe_items = getattr(self, 'active_ppe_items', [])
        frame_has_any_helmet = any(i["label"] == "helmet" for i in ppe_items)
        use_ppe_model_for_helmet = ppe_spec.is_loaded and frame_has_any_helmet

        # --- Collision & Proximity Evaluation (Edge-to-Edge Distance) ---
        people_dets = [d for d in self.active_detections if d.get("label") == "person"]
        vehicle_dets = [d for d in self.active_detections if d.get("label") in ["forklift", "truck", "car", "bus"]]

        is_collision_hazard = False
        min_edge_dist = 9999.0
        closest_pair = None

        for p in people_dets:
            pb = p.get("bbox", {})
            for v in vehicle_dets:
                vb = v.get("bbox", {})
                dx = max(0, max(pb.get("x1", 0) - vb.get("x2", 0), vb.get("x1", 0) - pb.get("x2", 0)))
                dy = max(0, max(pb.get("y1", 0) - vb.get("y2", 0), vb.get("y1", 0) - pb.get("y2", 0)))
                dist = (dx**2 + dy**2)**0.5
                if dist < min_edge_dist:
                    min_edge_dist = dist
                    closest_pair = (pb, vb, dist)

        if closest_pair and min_edge_dist < 140.0:
            is_collision_hazard = True

        # --- ALERT PRIORITIZATION LOGIC ---
        current_time = time.time()
        has_helmet_violation_in_frame = False

        # First evaluate whether any person has helmet violation
        for p in people_dets:
            pb = p.get("bbox", {})
            if use_ppe_model_for_helmet:
                found = ppe_spec.check_person_ppe(pb, ppe_items)
                if not found.get("has_helmet", True):
                    has_helmet_violation_in_frame = True
            else:
                crop = frame[max(0, int(pb.get("y1", 0))):min(height, int(pb.get("y2", 0))),
                             max(0, int(pb.get("x1", 0))):min(width, int(pb.get("x2", 0)))]
                if crop.size > 0 and not ppe_engine.analyze_head_roi(crop):
                    has_helmet_violation_in_frame = True

        # Check if there is an unresolved incident currently active
        is_incident_active = False
        try:
            from app.database.database import SessionLocal
            from app.database.models import Incident
            db = SessionLocal()
            unresolved = db.query(Incident).filter(Incident.status != "resolved").first()
            is_incident_active = unresolved is not None
            db.close()
        except Exception:
            is_incident_active = False

        # 1. PRIORITIZE CRASH / PROXIMITY HAZARD OVER HELMET
        if is_collision_hazard:
            if current_time - getattr(self, 'last_crash_trigger', 0) > 18:
                self.last_crash_trigger = current_time
                self.pending_helmet_alert = has_helmet_violation_in_frame
                print(f"[SAFETY ENGINE] CRITICAL COLLISION HAZARD DETECTED (dist={min_edge_dist:.1f}px) - PRIORITIZING CRASH OVER HELMET!")
                camera_manager.trigger_violation(self.camera_id, self.zone, "vehicle_proximity")
        else:
            # 2. DO NOT SHOW NEXT ALERT UNTIL CURRENT ALERT IS RESOLVED
            # Only trigger secondary helmet warning when all prior incidents are resolved
            if not is_incident_active:
                time_since_crash = current_time - getattr(self, 'last_crash_trigger', 0)
                if has_helmet_violation_in_frame and time_since_crash > 3.0 and (current_time - getattr(self, 'last_helmet_trigger', 0) > 15):
                    self.last_helmet_trigger = current_time
                    self.pending_helmet_alert = False
                    print("[SAFETY ENGINE] Prior incident resolved. Now triggering next warning: NO HELMET")
                    camera_manager.trigger_violation(self.camera_id, self.zone, "no_helmet")

        # Draw HUD overlays on frame matching Hack-eye aesthetics
        canvas = frame.copy()

        # Draw Proximity Danger line if collision hazard
        if is_collision_hazard and closest_pair:
            pb, vb, dist = closest_pair
            p_cx, p_cy = int((pb["x1"] + pb["x2"]) / 2), int((pb["y1"] + pb["y2"]) / 2)
            v_cx, v_cy = int((vb["x1"] + vb["x2"]) / 2), int((vb["y1"] + vb["y2"]) / 2)
            # Glowing red hazard line
            cv2.line(canvas, (p_cx, p_cy), (v_cx, v_cy), (0, 0, 240), 3)
            mid_x, mid_y = int((p_cx + v_cx) / 2), int((p_cy + v_cy) / 2)
            cv2.rectangle(canvas, (mid_x - 85, mid_y - 14), (mid_x + 85, mid_y + 14), (0, 0, 200), -1)
            cv2.putText(canvas, f"COLLISION RISK: {max(0.5, dist / 80.0):.1f}m", (mid_x - 80, mid_y + 5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1, cv2.LINE_AA)

        # Draw Bounding Boxes
        for idx, obj in enumerate(self.active_detections):
            bbox = obj.get("bbox")
            if not bbox:
                continue
            x1, y1 = int(bbox["x1"]), int(bbox["y1"])
            x2, y2 = int(bbox["x2"]), int(bbox["y2"])
            label = obj.get("label", "hazard").lower()

            if label == "person":
                track_id = f"PERSON #{12 + idx}"

                # === Helmet detection ===
                if use_ppe_model_for_helmet:
                    found = ppe_spec.check_person_ppe(bbox, ppe_items)
                    has_helmet = found.get("has_helmet", True)
                else:
                    crop = frame[max(0, y1):min(height, y2), max(0, x1):min(width, x2)]
                    has_helmet = ppe_engine.analyze_head_roi(crop) if crop.size > 0 else True

                # === Vest detection ===
                if ppe_spec.is_loaded and hasattr(self, 'active_ppe_items'):
                    found_full = ppe_spec.check_person_ppe(bbox, ppe_items)
                    has_vest = found_full.get("has_vest", True)
                else:
                    crop = frame[max(0, y1):min(height, y2), max(0, x1):min(width, x2)]
                    has_vest = ppe_engine.analyze_torso_roi(crop) if crop.size > 0 else True

                # Pick label & color (Collision takes visual priority if active)
                if is_collision_hazard:
                    box_color = (0, 0, 240)  # Bright Red
                    tag = f"{track_id} - COLLISION HAZARD"
                elif not has_helmet:
                    box_color = (0, 0, 235)  # Red — helmet violation
                    tag = f"{track_id} - NO HELMET"
                elif not has_vest:
                    box_color = (0, 140, 255)  # Orange — vest violation
                    tag = f"{track_id} - NO VEST"
                else:
                    box_color = (0, 220, 80)  # Green — PPE OK
                    tag = f"{track_id} - PPE OK"

                # Draw Box and Header
                cv2.rectangle(canvas, (x1, y1), (x2, y2), box_color, 2)
                cv2.rectangle(canvas, (x1, max(0, y1 - 22)), (x1 + 210, y1), box_color, -1)
                cv2.putText(canvas, tag, (x1 + 6, y1 - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1, cv2.LINE_AA)

            elif label in ["forklift", "truck", "car", "bus"]:
                veh_name = "FORKLIFT #01" if label == "forklift" else f"TRUCK #04"
                if is_collision_hazard:
                    box_color = (0, 0, 240) # Flashing Red
                    tag = f"{veh_name} - IMMINENT IMPACT"
                else:
                    box_color = (0, 150, 255) # High-vis Amber
                    tag = f"{veh_name}"

                cv2.rectangle(canvas, (x1, y1), (x2, y2), box_color, 2)
                cv2.rectangle(canvas, (x1, max(0, y1 - 22)), (x1 + 190, y1), box_color, -1)
                cv2.putText(canvas, tag, (x1 + 6, y1 - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)

        # Top In-Feed Live Bar
        cv2.rectangle(canvas, (0, 0), (width, 32), (15, 18, 24), -1)
        cv2.circle(canvas, (18, 16), 5, (0, 0, 230), -1) # Red Live Dot
        cv2.putText(canvas, f"LIVE • {self.name.upper()}", (32, 21), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (240, 245, 250), 1, cv2.LINE_AA)
        
        # Source filename badge
        src_label = os.path.basename(self.video_path) if self.video_path else "DEMO VIDEO"
        cv2.putText(canvas, f"SOURCE: {src_label}", (width - 260, 21), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (160, 175, 190), 1, cv2.LINE_AA)

        return canvas

    def generate_mjpeg_stream(self):
        while self.is_active:
            frame = self.get_frame()
            ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if not ret:
                continue
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
            time.sleep(0.05) # ~20 FPS

class CameraManager:
    def __init__(self):
        default_video = os.path.join(VIDEO_DIR, "loading_zone_truck.mp4")
        self.active_video_name = "loading_zone_truck.mp4"
        self.active_video_path = default_video
        self.main_loop: Optional[asyncio.AbstractEventLoop] = None

        self.cameras: Dict[str, CameraStreamer] = {
            "CAM_04": CameraStreamer("CAM_04", "CAM 04 - Loading Zone", "Loading Zone", default_video),
            "CAM_01": CameraStreamer("CAM_01", "CAM 01 - Main Gate", "Main Gate", os.path.join(VIDEO_DIR, "worker_no_helmet.mp4")),
            "CAM_02": CameraStreamer("CAM_02", "CAM 02 - Floor 1 Slab", "Floor 1"),
            "CAM_03": CameraStreamer("CAM_03", "CAM 03 - Crane Area", "Crane Area"),
            "CAM_05": CameraStreamer("CAM_05", "CAM 05 - Material Storage", "Material Storage"),
        }

    def set_main_loop(self, loop: asyncio.AbstractEventLoop):
        self.main_loop = loop

    def trigger_violation(self, camera_id: str, zone: str, event_type: str):
        if self.main_loop and self.main_loop.is_running():
            from app.demo.demo_engine import demo_engine
            scenario_key = "no_helmet" if event_type == "no_helmet" else "vehicle_proximity"
            asyncio.run_coroutine_threadsafe(
                demo_engine.trigger_scenario(scenario_key),
                self.main_loop
            )

    def set_active_video(self, path: str, filename: str):
        self.active_video_path = path
        self.active_video_name = filename
        for cam in self.cameras.values():
            cam.set_video(path)
        print(f"[CAMERA MANAGER] Active video set across stream nodes: {filename}")

    def get_camera(self, camera_id: str) -> Optional[CameraStreamer]:
        return self.cameras.get(camera_id) or self.cameras.get("CAM_04")

    def list_cameras(self) -> List[Dict[str, Any]]:
        return [
            {
                "id": c.camera_id,
                "name": c.name,
                "zone": c.zone,
                "status": "online" if c.is_active else "offline",
                "stream_url": f"/api/cameras/{c.camera_id}/stream"
            }
            for c in self.cameras.values()
        ]

camera_manager = CameraManager()
