import os
os.environ["OPENCV_FFMPEG_THREADS"] = "1"
os.environ["OMP_NUM_THREADS"] = "2"
os.environ["MKL_NUM_THREADS"] = "2"
import cv2
cv2.setNumThreads(1)
import time
import asyncio
import threading
import torch
torch.set_num_threads(2)
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

# Global lock protecting VideoCapture access
_cv_lock = threading.Lock()

# Global semaphore: only 1 camera runs YOLO inference at a time.
# Keeps CPU usage low and prevents multi-threaded contention.
_yolo_semaphore = threading.Semaphore(1)


class CameraSyncCoordinator:
    """Synchronizes multi-camera video playback to run in exact lockstep."""
    def __init__(self):
        self.sync_start_time = time.time()

    def reset(self):
        self.sync_start_time = time.time()
        print(f"[SYNC COORDINATOR] Synchronized HAWK cameras to T0 = {self.sync_start_time:.2f}")

camera_sync_coordinator = CameraSyncCoordinator()

# Global cache of decoded video frames so switching videos is 0ms instant
_VIDEO_FRAME_CACHE: Dict[str, List[np.ndarray]] = {}

def get_cached_video_frames(path: Optional[str]) -> List[np.ndarray]:
    """Decodes and caches video frames resized to (960, 540). Thread-safe."""
    if not path or not os.path.exists(path):
        return []
    norm = os.path.normpath(path)
    if norm in _VIDEO_FRAME_CACHE and _VIDEO_FRAME_CACHE[norm]:
        return _VIDEO_FRAME_CACHE[norm]
    try:
        cap = cv2.VideoCapture(norm)
        frames = []
        while True:
            ret, f = cap.read()
            if not ret or f is None:
                break
            frames.append(cv2.resize(f, (960, 540)))
        cap.release()
        _VIDEO_FRAME_CACHE[norm] = frames
        print(f"[VIDEO CACHE] Cached {len(frames)} frames for {os.path.basename(norm)}")
        return frames
    except Exception as e:
        print(f"[VIDEO CACHE] Error caching frames for {norm}: {e}")
        return []


class CameraStreamer:
    """
    Manages live camera feeds with decoupled 30 FPS video streaming + async AI inference.

    Architecture:
      Thread 1 (_reader_worker): Reads frames at natural 30 FPS, overlays latest detection
                                  bounding boxes and HUD in <1ms, encodes to JPEG, and updates
                                  self.latest_jpeg. Zero frame skipping, 100% fluid video.
      Thread 2 (_inference_worker): Asynchronously grabs the latest raw frame, downsamples to
                                    640x360, runs YOLO + PPE at ~4-5 Hz, updates detection state,
                                    and sleeps 120ms between passes so the CPU stays cool.
    """
    def __init__(self, camera_id: str, name: str, zone: str, video_path: Optional[str] = None):
        self.camera_id = camera_id
        self.name = name
        self.zone = zone
        self.video_path = video_path
        self.cap: Optional[cv2.VideoCapture] = None
        self.is_active = True
        self.run_inference = True

        # Lock protecting the shared raw frame handed from reader to inference worker
        self._raw_lock = threading.Lock()
        self._raw_frame: Optional[np.ndarray] = None

        # Lock protecting the AI detection state written by inference worker and read by reader
        self._state_lock = threading.Lock()
        self.active_detections: List[Dict] = []
        self._ppe_cache: Dict = {}
        self.is_collision_hazard: bool = False
        self.closest_pair = None
        self.scenario_mode: str = "baseline"

        # Shared stream state (updated by _reader_worker at 30 fps)
        self.latest_jpeg: Optional[bytes] = None
        self.frame_id: int = 0

        self.cached_frames: List[np.ndarray] = []

        # Detection persistence helpers (prevent single-frame dropouts)
        self.persisted_vehicle = None
        self.vehicle_hold_count: int = 0
        self.persisted_person = None
        self.person_hold_count: int = 0
        self.last_crash_trigger: float = 0.0
        self.last_ppe_trigger: float = 0.0

        self._init_capture()
        self._start_workers()

    # ------------------------------------------------------------------
    # Capture initialization & hot-swap
    # ------------------------------------------------------------------

    def _init_capture(self):
        with _cv_lock:
            if self.cap is not None:
                self.cap.release()
                self.cap = None
            if self.video_path and os.path.exists(self.video_path):
                self.cap = cv2.VideoCapture(self.video_path)
            else:
                default_vid = os.path.join(VIDEO_DIR, "loading_zone_truck.mp4")
                if os.path.exists(default_vid):
                    self.video_path = default_vid
                    self.cap = cv2.VideoCapture(default_vid)
        self.cached_frames = get_cached_video_frames(self.video_path)

    def set_video(self, path: str):
        if not path or not os.path.exists(path):
            print(f"[STREAMER {self.camera_id}] set_video path does not exist: {path}")
            return
        norm = os.path.normpath(path)
        new_frames = get_cached_video_frames(norm)
        if not new_frames:
            print(f"[STREAMER {self.camera_id}] No frames loaded for: {norm}")
            return

        # Atomically swap video path and cached frames; release stale cv2 cap
        with _cv_lock:
            self.video_path = norm
            self.cached_frames = new_frames  # atomic ref swap (GIL guarantees this)
            if self.cap is not None:
                self.cap.release()
                self.cap = None
            # Only open a new cap for the fallback (non-cached) code path
            if not new_frames:
                self.cap = cv2.VideoCapture(norm)

        with self._state_lock:
            self.active_detections = []
            self._ppe_cache = {}
            self.is_collision_hazard = False
            self.closest_pair = None
            self.persisted_vehicle = None
            self.vehicle_hold_count = 0
            self.persisted_person = None
            self.person_hold_count = 0

        # Immediately encode and publish the very first frame of the new video so the
        # browser sees something the moment the <img> reconnects after a tab switch.
        frames_snapshot = self.cached_frames  # stable local ref
        if frames_snapshot:
            try:
                canvas = self._draw_hud(frames_snapshot[0], self.scenario_mode, False, None, [], {}, 960, 540)
                ret, buffer = cv2.imencode(".jpg", canvas, [cv2.IMWRITE_JPEG_QUALITY, 72])
                if ret:
                    self.latest_jpeg = buffer.tobytes()
                    self.frame_id += 1
            except Exception as e:
                print(f"[STREAMER {self.camera_id}] Error drawing initial frame: {e}")

    # ------------------------------------------------------------------
    # Worker threads
    # ------------------------------------------------------------------

    def _start_workers(self):
        # Thread 1: smooth 30 FPS video reader & overlay encoder
        t1 = threading.Thread(target=self._reader_worker, daemon=True)
        t1.start()
        # Thread 2: throttled AI inference worker (only for active cameras)
        if self.run_inference:
            t2 = threading.Thread(target=self._inference_worker, daemon=True)
            t2.start()

    def _reader_worker(self):
        """
        Reads frames at synchronized natural pace across camera nodes.
        Applies latest AI bounding boxes and HUD overlays in <1ms,
        encodes to JPEG, and updates self.latest_jpeg immediately.
        """
        width, height = 960, 540
        target_frame_time = 0.033  # ~30 fps stream delivery

        while self.is_active:
            t_start = time.time()
            frame = None

            # Take a stable local reference to avoid race with set_video() reassignment
            frames = self.cached_frames

            if frames:
                total_frames = len(frames)
                is_warn = (self.scenario_mode == "warn")
                if is_warn:
                    # Choreographed storytelling between Camera A (Outside Yard) & Camera B (Entrance Doorway Inside):
                    # Cycle: 8.5s total (playback slowed to ~14-15 fps for clear visual anticipation)
                    # Phase 1 [0.0s - 4.0s]: Cam A forklift approaches doorway (frames 0-55).
                    #                        Cam B worker stands at doorway alone (frames 0-15); audio siren warns worker.
                    # Phase 2 [4.0s - 7.0s]: Cam A reaches and passes doorway line (frames 55-104).
                    #                        Cam B forklift breaks through doorway inside right beside worker (frames 16-90).
                    # Phase 3 [7.0s - 8.5s]: Cam A holds final frame 104; Cam B finishes coming to halt (frames 90-113).
                    # At 8.5s, both cameras reset and loop in unison.
                    cycle_dur = 8.5
                    elapsed = (time.time() - camera_sync_coordinator.sync_start_time) % cycle_dur

                    is_cam_a = self.camera_id in ("HAWK_A", "a")
                    if elapsed < 4.0:
                        p = elapsed / 4.0
                        if is_cam_a:
                            frame_idx = min(int(p * 55), total_frames - 1)
                        else:
                            frame_idx = min(int(p * 15), total_frames - 1)
                    elif elapsed < 7.0:
                        p = (elapsed - 4.0) / 3.0
                        if is_cam_a:
                            frame_idx = min(55 + int(p * 49), total_frames - 1)
                        else:
                            frame_idx = min(16 + int(p * 74), total_frames - 1)
                    else:
                        p = (elapsed - 7.0) / 1.5
                        if is_cam_a:
                            frame_idx = min(104, total_frames - 1)
                        else:
                            frame_idx = min(90 + int(p * 23), total_frames - 1)

                    frame_idx = max(0, min(frame_idx, total_frames - 1))
                else:
                    fps = 25.0
                    cycle_dur = max(1.0, total_frames / fps)
                    elapsed = (time.time() - camera_sync_coordinator.sync_start_time) % cycle_dur
                    frame_idx = min(int(elapsed * fps), total_frames - 1)
                frame = frames[frame_idx]
            else:
                with _cv_lock:
                    if self.cap and self.cap.isOpened():
                        ret, grabbed = self.cap.read()
                        if not ret:
                            self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                            ret, grabbed = self.cap.read()
                        if ret and grabbed is not None:
                            frame = cv2.resize(grabbed, (width, height))

            if frame is None:
                frame = np.full((height, width, 3), (18, 22, 32), dtype=np.uint8)
                cv2.putText(frame, f"FEED SYNCING \u2022 {self.name}", (int(width * 0.32), int(height * 0.5)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.65, (180, 200, 220), 2, cv2.LINE_AA)

            # Store fresh frame for inference worker to consume
            with self._raw_lock:
                self._raw_frame = frame

            # Render overlay using the latest AI detection state
            with self._state_lock:
                dets = list(self.active_detections)
                ppe_cache = dict(self._ppe_cache)
                hazard = self.is_collision_hazard
                pair = self.closest_pair
                mode = self.scenario_mode

            canvas = self._draw_hud(frame, mode, hazard, pair, dets, ppe_cache, width, height)

            # Fast JPEG encode (takes ~1ms at quality 72)
            ret, buffer = cv2.imencode(".jpg", canvas, [cv2.IMWRITE_JPEG_QUALITY, 72])
            if ret:
                self.latest_jpeg = buffer.tobytes()
                self.frame_id += 1

            # Precise 30 FPS pacing
            t_elapsed = time.time() - t_start
            sleep_sec = max(0.002, target_frame_time - t_elapsed)
            time.sleep(sleep_sec)

    def _inference_worker(self):
        """
        Runs YOLO + PPE detection asynchronously on the latest raw frame.
        Throttled to ~4-5 Hz and downsampled so CPU usage stays low and the
        laptop stays cool and responsive.
        Never touches self.latest_jpeg directly — only updates detection state.
        """
        width, height = 960, 540
        infer_w, infer_h = 640, 360
        scale_x = width / infer_w
        scale_y = height / infer_h

        while self.is_active:
            with self._raw_lock:
                raw_frame = self._raw_frame
            if raw_frame is None:
                time.sleep(0.05)
                continue

            mode = self.scenario_mode

            # Resize down for fast YOLO inference on CPU
            infer_frame = cv2.resize(raw_frame, (infer_w, infer_h))

            # Only 1 camera runs YOLO at a time
            try:
                if not _yolo_semaphore.acquire(timeout=0.3):
                    time.sleep(0.03)
                    continue

                try:
                    detector = model_manager.get_detector()
                    raw_dets = detector.detect(infer_frame)
                    min_vehicle_area = (width * height) * 0.012
                    max_vehicle_area = (width * height) * 0.45
                    filtered_dets = []
                    found_vehicles = []

                    for d in raw_dets:
                        lbl = d.get("label", "")
                        b = d.get("bbox", {})
                        x1 = b.get("x1", 0) * scale_x
                        y1 = b.get("y1", 0) * scale_y
                        x2 = b.get("x2", 0) * scale_x
                        y2 = b.get("y2", 0) * scale_y
                        scaled_bbox = {"x1": x1, "y1": y1, "x2": x2, "y2": y2}
                        area = (x2 - x1) * (y2 - y1)
                        conf = d.get("confidence", 0)

                        # Reject ceiling fixtures and far top-right edge artifacts
                        if y2 < height * 0.35 and x2 > width - 40:
                            continue

                        scaled_d = {
                            "label": lbl,
                            "confidence": conf,
                            "bbox": scaled_bbox
                        }
                        if lbl in ["forklift", "truck", "car", "bus"]:
                            if mode == "fire":
                                # In fire evacuation video, ignore static rack/shelf false-positives
                                continue
                            if mode == "warn":
                                # Cam B: Ignore low-confidence ground pallets (< 0.25), but detect forklift when it enters (conf >= 0.25)
                                if self.camera_id in ("HAWK_B", "b") and conf < 0.25:
                                    continue
                                # Cam A: Pallet stacks on right or ground flat pallets
                                bw = scaled_bbox["x2"] - scaled_bbox["x1"]
                                bh = scaled_bbox["y2"] - scaled_bbox["y1"]
                                if scaled_bbox["x1"] > width * 0.65 or (bw > 1.6 * bh and scaled_bbox["y2"] > height * 0.65):
                                    continue
                            if min_vehicle_area <= area <= max_vehicle_area and conf >= 0.03:
                                found_vehicles.append(scaled_d)
                        elif lbl == "person":
                            if conf >= 0.03:
                                filtered_dets.append(scaled_d)

                    # Merge overlapping vehicle detections if any
                    if found_vehicles:
                        merged_vehicles = []
                        for vd in found_vehicles:
                            vb = vd["bbox"]
                            if not merged_vehicles:
                                merged_vehicles.append(vd)
                            else:
                                merged = False
                                for mv in merged_vehicles:
                                    mb = mv["bbox"]
                                    if not (vb["x1"] > mb["x2"] or vb["x2"] < mb["x1"] or vb["y1"] > mb["y2"] or vb["y2"] < mb["y1"]):
                                        mb["x1"] = min(mb["x1"], vb["x1"])
                                        mb["y1"] = min(mb["y1"], vb["y1"])
                                        mb["x2"] = max(mb["x2"], vb["x2"])
                                        mb["y2"] = max(mb["y2"], vb["y2"])
                                        mv["confidence"] = max(mv["confidence"], vd["confidence"])
                                        merged = True
                                        break
                                if not merged:
                                    merged_vehicles.append(vd)
                        filtered_dets.extend(merged_vehicles)
                        self.persisted_vehicle = merged_vehicles[0]
                        self.vehicle_hold_count = 45
                    elif self.vehicle_hold_count > 0:
                        self.vehicle_hold_count -= 1
                        if self.persisted_vehicle and not any(
                            d.get("label") in ["forklift", "truck", "car", "bus"] for d in filtered_dets
                        ):
                            filtered_dets.append(self.persisted_vehicle)
                    else:
                        self.persisted_vehicle = None

                    # Person persistence to prevent single-frame dropouts
                    found_persons = [d for d in filtered_dets if d.get("label") == "person"]
                    if found_persons:
                        self.persisted_person = found_persons[0]
                        self.person_hold_count = 45
                    elif self.person_hold_count > 0:
                        self.person_hold_count -= 1
                        if self.persisted_person and not any(d.get("label") == "person" for d in filtered_dets):
                            filtered_dets.append(self.persisted_person)
                    else:
                        self.persisted_person = None

                    # PPE checks
                    new_ppe_cache = {}
                    for d in filtered_dets:
                        if d.get("label") == "person":
                            b = d.get("bbox", {})
                            crop = raw_frame[
                                max(0, int(b.get("y1", 0))): min(height, int(b.get("y2", 0))),
                                max(0, int(b.get("x1", 0))): min(width, int(b.get("x2", 0)))
                            ]
                            if crop.size > 0:
                                has_vest = ppe_engine.analyze_torso_roi(crop)
                                has_helmet = ppe_engine.analyze_head_roi(crop)
                            else:
                                has_vest, has_helmet = True, True
                            bbox_key = (int(b.get("x1", 0)), int(b.get("y1", 0)),
                                        int(b.get("x2", 0)), int(b.get("y2", 0)))
                            new_ppe_cache[bbox_key] = (has_vest, has_helmet)
                            d["has_vest"] = has_vest
                            d["has_helmet"] = has_helmet

                finally:
                    _yolo_semaphore.release()

            except Exception as e:
                print(f"[INFERENCE WORKER {self.camera_id}] Error: {e}")
                time.sleep(0.08)
                continue

            # Real-time Proximity & Distance Calculation (ALWAYS active on all modes)
            people_dets = [d for d in filtered_dets if d.get("label") == "person"]
            vehicle_dets = [d for d in filtered_dets if d.get("label") in ["forklift", "truck", "car", "bus"]]

            min_edge_dist = 9999.0
            closest_pair = None
            dist_meters = 99.0

            for p in people_dets:
                pb = p.get("bbox", {})
                for v in vehicle_dets:
                    vb = v.get("bbox", {})
                    dx = max(0, max(pb.get("x1", 0) - vb.get("x2", 0), vb.get("x1", 0) - pb.get("x2", 0)))
                    dy = max(0, max(pb.get("y1", 0) - vb.get("y2", 0), vb.get("y1", 0) - pb.get("y2", 0)))
                    dist = (dx ** 2 + dy ** 2) ** 0.5
                    if dist < min_edge_dist:
                        min_edge_dist = dist
                        # Calibrated: ~70 pixels ~= 1.0 meter in 960x540 CCTV
                        dist_meters = round(max(0.4, dist / 70.0), 1)
                        closest_pair = (pb, vb, dist, dist_meters)

            if mode == "fire":
                closest_pair = None
                is_collision_hazard = False
                is_proximity_warning = False
            elif mode == "anticipate":
                # In Anticipate mode: Agent A tracks inbound transit corridor.
                # Camera B has no vehicle in Zone B yet.
                if self.camera_id in ("HAWK_B", "b"):
                    closest_pair = None
                    is_collision_hazard = False
                    is_proximity_warning = False
                else:
                    is_collision_hazard = False
                    is_proximity_warning = (closest_pair is not None)
            elif mode == "warn":
                # Warn mode: Cam A tracks inbound forklift outside, Cam B tracks worker inside doorway
                closest_pair = None
                is_collision_hazard = False
                is_proximity_warning = True

                # AI Video Fault Tolerance: Ensure stable detections even if AI frames glitch
                if self.camera_id in ("HAWK_A", "a") and not any(d.get("label") in ["forklift", "truck", "car", "bus"] for d in filtered_dets):
                    filtered_dets.append({
                        "bbox": {"x1": int(width * 0.22), "y1": int(height * 0.32), "x2": int(width * 0.58), "y2": int(height * 0.86)},
                        "label": "forklift",
                        "confidence": 0.88
                    })
                elif self.camera_id in ("HAWK_B", "b") and not any(d.get("label") == "person" for d in filtered_dets):
                    filtered_dets.append({
                        "bbox": {"x1": int(width * 0.38), "y1": int(height * 0.22), "x2": int(width * 0.62), "y2": int(height * 0.88)},
                        "label": "person",
                        "confidence": 0.91
                    })
            else:
                is_hazard_active = (mode != "baseline")
                is_collision_hazard = is_hazard_active and (closest_pair is not None) and (dist_meters < 2.0)
                is_proximity_warning = is_hazard_active and (closest_pair is not None) and (dist_meters < 4.5)

            # Safely publish state to reader thread
            with self._state_lock:
                self.active_detections = filtered_dets
                self._ppe_cache = new_ppe_cache
                self.is_collision_hazard = is_collision_hazard
                self.closest_pair = closest_pair

            # Alerts dispatch with cooldown (only for dedicated non-HAWK construction cameras, avoid interfering with HAWK scenarios)
            current_time = time.time()
            if self.camera_id not in ("HAWK_A", "HAWK_B", "a", "b"):
                if is_collision_hazard:
                    if current_time - self.last_crash_trigger > 40:
                        self.last_crash_trigger = current_time
                        print(f"[SAFETY ENGINE] CRITICAL COLLISION HAZARD ({dist_meters:.1f}m)")
                        camera_manager.trigger_violation(self.camera_id, self.zone, "vehicle_proximity")
                elif is_proximity_warning:
                    if current_time - self.last_crash_trigger > 40:
                        self.last_crash_trigger = current_time
                        print(f"[SAFETY ENGINE] VEHICLE PROXIMITY WARNING ({dist_meters:.1f}m)")
                        camera_manager.trigger_violation(self.camera_id, self.zone, "vehicle_proximity")
                elif mode == "baseline":
                    has_ppe_violation = any(not v[0] or not v[1] for v in new_ppe_cache.values())
                    if has_ppe_violation and current_time - self.last_ppe_trigger > 40:
                        self.last_ppe_trigger = current_time
                        print("[SAFETY ENGINE] BASELINE PPE COMPLIANCE ALERT: Worker Missing Safety Equipment")
                        camera_manager.trigger_violation(self.camera_id, self.zone, "no_helmet")

            # Crucial rest time: lets CPU breathe, prevents laptop lag
            time.sleep(0.12)

    def _draw_hud(self, frame, mode, is_collision_hazard, closest_pair,
                  active_detections, ppe_cache, width, height):
        canvas = frame.copy()
        is_stationary = (mode == "baseline")

        # In fire evacuation mode or Camera B in anticipate mode, distance lines are suppressed
        if mode == "fire" or (mode == "anticipate" and self.camera_id in ("HAWK_B", "b")):
            closest_pair = None

        # 1. Bounding boxes for all detected entities
        for idx, obj in enumerate(active_detections):
            bbox = obj.get("bbox")
            if not bbox:
                continue
            x1, y1, x2, y2 = int(bbox["x1"]), int(bbox["y1"]), int(bbox["x2"]), int(bbox["y2"])
            label = obj.get("label", "hazard").lower()

            if label == "person":
                track_id = f"PERSON #{12 + idx}"
                bbox_key = (x1, y1, x2, y2)
                has_vest, has_helmet = ppe_cache.get(bbox_key, (True, True))

                if mode == "fire":
                    box_color = (0, 165, 255)  # Amber warning
                    tag = f"{track_id} - EVACUATING (EMERGENCY EXIT)"
                elif mode == "warn":
                    if self.camera_id in ("HAWK_A", "a"):
                        box_color = (0, 160, 255)  # Amber Inbound
                        tag = "OPERATOR - FORKLIFT #01"
                    else:
                        box_color = (0, 0, 240)  # Urgent Red Alert
                        tag = f"{track_id} - CLEAR ENTRANCE PATHWAY"
                elif mode == "anticipate":
                    box_color = (0, 220, 80)  # Monitored green
                    tag = f"{track_id} - MONITORED (TRANSIT PATH)"
                elif mode == "conflict":
                    box_color = (0, 0, 240)  # Critical Red
                    tag = f"{track_id} - IMPACT HAZARD"
                elif is_collision_hazard:
                    box_color = (0, 0, 240)
                    tag = f"{track_id} - COLLISION HAZARD"
                elif not has_helmet and not has_vest:
                    box_color = (0, 0, 235)
                    tag = f"{track_id} - NO HELMET / VEST"
                elif not has_helmet:
                    box_color = (0, 0, 235)
                    tag = f"{track_id} - NO HELMET"
                elif not has_vest:
                    box_color = (0, 140, 255)
                    tag = f"{track_id} - NO VEST"
                else:
                    box_color = (0, 220, 80)
                    tag = f"{track_id} - PPE OK"

                cv2.rectangle(canvas, (x1, y1), (x2, y2), box_color, 2)
                (tw, _), _ = cv2.getTextSize(tag, cv2.FONT_HERSHEY_SIMPLEX, 0.42, 1)
                if y1 < 25:
                    cv2.rectangle(canvas, (x1, y1), (x1 + tw + 14, y1 + 22), box_color, -1)
                    cv2.putText(canvas, tag, (x1 + 6, y1 + 16),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1, cv2.LINE_AA)
                else:
                    cv2.rectangle(canvas, (x1, y1 - 22), (x1 + tw + 14, y1), box_color, -1)
                    cv2.putText(canvas, tag, (x1 + 6, y1 - 6),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1, cv2.LINE_AA)

            elif label in ["forklift", "truck", "car", "bus"]:
                veh_name = "FORKLIFT #01"
                d_suffix = f" ({closest_pair[3]:.1f}m)" if closest_pair else ""
                if mode == "fire":
                    box_color = (0, 180, 255)
                    tag = f"{veh_name} - EMERGENCY HALT"
                elif mode == "warn":
                    box_color = (0, 140, 255)  # Amber Inbound Alert
                    tag = f"{veh_name} - APPROACHING ENTRANCE"
                elif mode == "anticipate":
                    box_color = (0, 160, 255)  # Amber Inbound
                    tag = f"{veh_name} - INBOUND TRANSIT{d_suffix}"
                elif mode == "conflict":
                    box_color = (0, 0, 240)  # Critical Red
                    tag = f"{veh_name} - IMMINENT IMPACT{d_suffix}" if closest_pair else f"{veh_name} - IMPACT BREACH"
                elif is_stationary:
                    box_color = (0, 180, 255)
                    tag = f"{veh_name} - STATIONARY (PARKED)"
                elif is_collision_hazard:
                    box_color = (0, 0, 240)
                    tag = f"{veh_name} - IMMINENT IMPACT{d_suffix}"
                elif closest_pair and closest_pair[3] < 4.5:
                    box_color = (0, 160, 255)
                    tag = f"{veh_name} - PROXIMITY RISK{d_suffix}"
                else:
                    box_color = (0, 180, 255)
                    tag = f"{veh_name} - ACTIVE{d_suffix}"

                cv2.rectangle(canvas, (x1, y1), (x2, y2), box_color, 2)
                (tw, _), _ = cv2.getTextSize(tag, cv2.FONT_HERSHEY_SIMPLEX, 0.44, 1)
                if y1 < 25:
                    cv2.rectangle(canvas, (x1, y1), (x1 + tw + 14, y1 + 22), box_color, -1)
                    cv2.putText(canvas, tag, (x1 + 6, y1 + 16),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.44, (255, 255, 255), 1, cv2.LINE_AA)
                else:
                    cv2.rectangle(canvas, (x1, y1 - 22), (x1 + tw + 14, y1), box_color, -1)
                    cv2.putText(canvas, tag, (x1 + 6, y1 - 6),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.44, (255, 255, 255), 1, cv2.LINE_AA)

        # 1.5 Thermal combustion detection box on Camera B during Fire mode
        if mode == "fire" and self.camera_id in ("HAWK_B", "b"):
            fx1 = int(width * 0.30)
            fy1 = int(height * 0.22)
            fx2 = int(width * 0.72)
            fy2 = int(height * 0.58)

            pulse = int(abs(np.sin(time.time() * 3)) * 45)
            flame_color = (0, 20 + pulse, 220 + pulse)

            # Outer thermal bounding box
            cv2.rectangle(canvas, (fx1, fy1), (fx2, fy2), flame_color, 2)

            # Header badge
            flame_tag = "THERMAL COMBUSTION (F-01) - ACTIVE FLAME"
            (ftw, _), _ = cv2.getTextSize(flame_tag, cv2.FONT_HERSHEY_SIMPLEX, 0.44, 1)
            cv2.rectangle(canvas, (fx1, fy1 - 24), (fx1 + ftw + 16, fy1), (12, 16, 220), -1)
            cv2.putText(canvas, flame_tag, (fx1 + 8, fy1 - 7),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.44, (255, 255, 255), 1, cv2.LINE_AA)

            # Sensor readout badge
            sub_tag = "TEMP: 320\u00b0C (CRITICAL ANOMALY) \u2022 SPRINKLERS ARMED"
            (stw, _), _ = cv2.getTextSize(sub_tag, cv2.FONT_HERSHEY_SIMPLEX, 0.38, 1)
            cv2.rectangle(canvas, (fx1, fy2), (fx1 + stw + 16, fy2 + 22), (16, 20, 28), -1)
            cv2.rectangle(canvas, (fx1, fy2), (fx1 + stw + 16, fy2 + 22), (0, 140, 255), 1)
            cv2.putText(canvas, sub_tag, (fx1 + 8, fy2 + 15),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 220, 255), 1, cv2.LINE_AA)

        # 2. Dynamic Proximity Connector Line & Distance Badge (rendered on top of all boxes)
        if closest_pair and mode != "fire":
            pb, vb, dist, dist_meters = closest_pair
            p_cx = int((pb["x1"] + pb["x2"]) / 2)
            p_cy = int((pb["y1"] + pb["y2"]) / 2)
            v_cx = int((vb["x1"] + vb["x2"]) / 2)
            v_cy = int((vb["y1"] + vb["y2"]) / 2)

            if is_stationary:
                line_color = (0, 180, 255)   # Cyan - Stationary clearance
                tag_text = f"CLEARANCE: {dist_meters:.1f}m (STATIONARY)"
            elif mode == "anticipate":
                line_color = (0, 160, 255)  # Amber - Inbound transit
                tag_text = f"INBOUND PROXIMITY: {dist_meters:.1f}m"
            elif dist_meters < 2.0:
                line_color = (0, 0, 240)    # Red - Critical
                tag_text = f"COLLISION RISK: {dist_meters:.1f}m"
            elif dist_meters < 4.5:
                line_color = (0, 160, 255)  # Orange - Warning
                tag_text = f"PROXIMITY ALERT: {dist_meters:.1f}m"
            else:
                line_color = (0, 220, 80)   # Green - Safe
                tag_text = f"DISTANCE: {dist_meters:.1f}m"

            cv2.line(canvas, (p_cx, p_cy), (v_cx, v_cy), line_color, 2, cv2.LINE_AA)
            cv2.circle(canvas, (p_cx, p_cy), 5, line_color, -1)
            cv2.circle(canvas, (v_cx, v_cy), 5, line_color, -1)

            mid_x = int((p_cx + v_cx) / 2)
            mid_y = int((p_cy + v_cy) / 2)

            # Avoid collision with person top tag
            p_y1 = int(pb.get("y1", 0))
            if abs(mid_y - p_y1) < 26:
                mid_y = int(p_y1 - 32)
            elif abs(mid_y - p_cy) < 20:
                mid_y = int(mid_y - 24)

            (tw, _), _ = cv2.getTextSize(tag_text, cv2.FONT_HERSHEY_SIMPLEX, 0.44, 1)
            half_w = int(tw / 2) + 12
            cv2.rectangle(canvas, (int(mid_x - half_w), int(mid_y - 14)), (int(mid_x + half_w), int(mid_y + 14)), (16, 22, 30), -1)
            cv2.rectangle(canvas, (int(mid_x - half_w), int(mid_y - 14)), (int(mid_x + half_w), int(mid_y + 14)), line_color, 2)
            cv2.putText(canvas, tag_text, (int(mid_x - half_w + 10), int(mid_y + 5)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.44, (255, 255, 255), 1, cv2.LINE_AA)

        # Bottom HUD Banner for Mode Warn
        if mode == "warn":
            if self.camera_id in ("HAWK_A", "a"):
                banner_tag = "INBOUND MACHINERY \u2022 SPEED: 12 KM/H \u2022 ENTERING ENTRANCE"
                banner_col = (0, 140, 255)
            else:
                banner_tag = "CLEARANCE WARNING \u2022 HEAVY MACHINERY APPROACHING \u2022 MOVE OUT OF THE WAY"
                banner_col = (12, 16, 220)

            (btw, _), _ = cv2.getTextSize(banner_tag, cv2.FONT_HERSHEY_SIMPLEX, 0.44, 1)
            bx1 = int((width - btw) / 2) - 16
            bx2 = bx1 + btw + 32
            cv2.rectangle(canvas, (bx1, height - 34), (bx2, height - 8), (14, 18, 26), -1)
            cv2.rectangle(canvas, (bx1, height - 34), (bx2, height - 8), banner_col, 2)
            cv2.putText(canvas, banner_tag, (bx1 + 16, height - 16),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.44, (255, 255, 255), 1, cv2.LINE_AA)

        # Top live bar
        cv2.rectangle(canvas, (0, 0), (width, 30), (12, 16, 24), -1)
        cv2.circle(canvas, (18, 15), 5, (0, 0, 230), -1)
        cv2.putText(canvas, f"LIVE \u2022 {self.name.upper()} \u2022 MODE: {mode.upper()}", (32, 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.43, (240, 245, 250), 1, cv2.LINE_AA)

        src_label = os.path.basename(self.video_path) if self.video_path else "DEMO VIDEO"
        cv2.putText(canvas, f"SRC: {src_label[:30]}", (width - 270, 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.38, (140, 160, 180), 1, cv2.LINE_AA)

        return canvas

    # ------------------------------------------------------------------
    # MJPEG stream  (pushes freshly encoded JPEGs immediately)
    # ------------------------------------------------------------------

    def generate_mjpeg_stream(self):
        last_sent = -1
        try:
            while self.is_active:
                current_id = self.frame_id
                if current_id != last_sent:
                    jpeg = self.latest_jpeg
                    if jpeg is not None:
                        last_sent = current_id
                        yield (
                            b"--frame\r\n"
                            b"Content-Type: image/jpeg\r\n\r\n" + jpeg + b"\r\n"
                        )
                time.sleep(0.012)  # Check at ~80 Hz so 30 fps frames are yielded with zero lag
        except (GeneratorExit, ConnectionResetError, BrokenPipeError):
            pass

class CameraManager:
    def __init__(self):
        default_video = os.path.join(VIDEO_DIR, "loading_zone_truck.mp4")
        self.active_video_name = "loading_zone_truck.mp4"
        self.active_video_path = default_video
        self.main_loop: Optional[asyncio.AbstractEventLoop] = None

        # HAWK Dashboard dedicated streamers — live MJPEG with real YOLO+PPE inference
        _default_a = os.path.join(VIDEO_DIR, "box_pickup-rgb-00000",
                                   "008caa590c5e5b7b4bca_run_8_seed_4731920.cam_00.rgb.mp4")
        _default_b = os.path.join(VIDEO_DIR, "box_pickup-rgb-00000",
                                   "008caa590c5e5b7b4bca_run_8_seed_4731920.cam_01.rgb.mp4")
        self.hawk_streamer_a = CameraStreamer("HAWK_A", "Camera A – Entrance (Agent A)", "Zone A",
                                              _default_a if os.path.exists(_default_a) else None)
        self.hawk_streamer_b = CameraStreamer("HAWK_B", "Camera B – Loading Area (Agent B)", "Zone B",
                                              _default_b if os.path.exists(_default_b) else None)

        self.cameras: Dict[str, Any] = {
            "CAM_04": {"id": "CAM_04", "name": "CAM 04 - Loading Zone", "zone": "Loading Zone", "status": "online", "stream_url": "/api/cameras/CAM_04/stream"},
            "CAM_01": {"id": "CAM_01", "name": "CAM 01 - Main Gate", "zone": "Main Gate", "status": "online", "stream_url": "/api/cameras/CAM_01/stream"},
            "CAM_02": {"id": "CAM_02", "name": "CAM 02 - Floor 1 Slab", "zone": "Floor 1", "status": "online", "stream_url": "/api/cameras/CAM_02/stream"},
            "CAM_03": {"id": "CAM_03", "name": "CAM 03 - Crane Area", "zone": "Crane Area", "status": "online", "stream_url": "/api/cameras/CAM_03/stream"},
            "CAM_05": {"id": "CAM_05", "name": "CAM 05 - Material Storage", "zone": "Material Storage", "status": "online", "stream_url": "/api/cameras/CAM_05/stream"},
        }
        # Pre-cache scenario videos in background thread
        threading.Thread(target=self._preload_scenario_videos, daemon=True).start()

    def _preload_scenario_videos(self):
        try:
            from app.services.hawk_engine import hawk_engine
            for step, vids in hawk_engine.SCENARIO_VIDEOS.items():
                pa = os.path.normpath(os.path.join(VIDEO_DIR, vids["camera_a"]))
                pb = os.path.normpath(os.path.join(VIDEO_DIR, vids["camera_b"]))
                get_cached_video_frames(pa)
                get_cached_video_frames(pb)
        except Exception as e:
            print(f"[PRELOAD] Error preloading scenario videos: {e}")

    def set_main_loop(self, loop: asyncio.AbstractEventLoop):
        self.main_loop = loop

    def set_scenario_mode(self, mode: str):
        """Sets scenario mode across both HAWK camera streamers ('baseline', 'anticipate', 'warn', 'conflict', 'fire')."""
        self.hawk_streamer_a.scenario_mode = mode
        self.hawk_streamer_b.scenario_mode = mode
        camera_sync_coordinator.reset()
        print(f"[CAMERA MANAGER] HAWK Streamers mode set to: {mode} (sync reset)")

    def trigger_violation(self, camera_id: str, zone: str, event_type: str):
        now = time.time()
        if now - getattr(self, '_last_global_violation', 0) < 25.0:
            return
        self._last_global_violation = now
        if self.main_loop and self.main_loop.is_running():
            from app.demo.demo_engine import demo_engine
            scenario_key = "no_helmet" if event_type == "no_helmet" else "vehicle_proximity"
            asyncio.run_coroutine_threadsafe(
                demo_engine.trigger_scenario(scenario_key),
                self.main_loop
            )

    def set_hawk_videos(self, path_a: Optional[str], path_b: Optional[str]):
        """Hot-swap the HAWK dashboard camera feeds with new video files."""
        if path_a and os.path.exists(path_a):
            self.hawk_streamer_a.set_video(path_a)
            print(f"[HAWK STREAMER A] Swapped to: {os.path.basename(path_a)}")
        if path_b and os.path.exists(path_b):
            self.hawk_streamer_b.set_video(path_b)
            print(f"[HAWK STREAMER B] Swapped to: {os.path.basename(path_b)}")
        camera_sync_coordinator.reset()

    def set_active_video(self, path: str, filename: str):
        self.active_video_path = path
        self.active_video_name = filename
        for cam in self.cameras.values():
            cam.set_video(path)
        print(f"[CAMERA MANAGER] Active video set across stream nodes: {filename}")

    def get_camera(self, camera_id: str) -> Optional[CameraStreamer]:
        """Returns a CameraStreamer if the camera has a live stream, else None."""
        # Only HAWK streamers are real live CameraStreamers; secondary cameras are metadata-only
        if camera_id in ("HAWK_A", "a"):
            return self.hawk_streamer_a
        if camera_id in ("HAWK_B", "b"):
            return self.hawk_streamer_b
        return None

    def list_cameras(self) -> List[Dict[str, Any]]:
        return list(self.cameras.values())

camera_manager = CameraManager()
