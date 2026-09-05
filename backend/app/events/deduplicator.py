import time
from typing import Dict, Tuple
from app.config import settings

class AlertDeduplicator:
    """
    Prevents alert fatigue on construction sites.
    Debounces continuous video detections and enforces a cooldown window per
    (track_id, camera_id, event_type) combination.
    """
    def __init__(self, cooldown_seconds: int = settings.ALERT_COOLDOWN_SECONDS):
        self.cooldown_seconds = cooldown_seconds
        # key: (track_id, camera_id, event_type) -> timestamp of last fired alert
        self._last_alert_times: Dict[Tuple[str, str, str], float] = {}
        # persistence tracker: key -> count of consecutive frames observed
        self._persistence_counter: Dict[Tuple[str, str, str], int] = {}
        
        self.alerts_suppressed: int = 0
        self.alerts_passed: int = 0

    def should_trigger(
        self,
        track_id: str,
        camera_id: str,
        event_type: str,
        min_consecutive_frames: int = 3
    ) -> bool:
        """
        Determines whether an observed condition should generate a new incident.
        Requires persistence across consecutive frames, then checks cooldown.
        """
        key = (track_id, camera_id, event_type)
        now = time.time()
        
        # 1. Update persistence counter
        count = self._persistence_counter.get(key, 0) + 1
        self._persistence_counter[key] = count
        
        if count < min_consecutive_frames:
            # Condition has not persisted long enough to rule out transient false positives
            return False

        # 2. Check cooldown window
        last_time = self._last_alert_times.get(key, 0.0)
        elapsed = now - last_time
        
        if elapsed < self.cooldown_seconds:
            self.alerts_suppressed += 1
            return False

        # 3. Passed cooldown: record trigger time and return True
        self._last_alert_times[key] = now
        self.alerts_passed += 1
        return True

    def reset_cooldown(self, track_id: str, camera_id: str, event_type: str):
        key = (track_id, camera_id, event_type)
        self._last_alert_times.pop(key, None)
        self._persistence_counter.pop(key, None)

    def get_stats(self) -> Dict[str, int]:
        return {
            "alerts_passed": self.alerts_passed,
            "alerts_suppressed": self.alerts_suppressed,
            "active_tracks_monitored": len(self._last_alert_times)
        }

deduplicator = AlertDeduplicator()
