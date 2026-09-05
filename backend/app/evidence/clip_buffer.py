import collections
import time
from typing import Deque, Tuple, Optional
import numpy as np

class RollingFrameBuffer:
    """
    Circular in-memory frame buffer keeping the last N seconds of camera frames.
    Allows capturing exact pre-incident context (5s before).
    """
    def __init__(self, fps: int = 15, max_seconds: int = 10):
        self.fps = fps
        self.max_frames = fps * max_seconds
        # Deque of (timestamp, frame, detections)
        self.buffer: Deque[Tuple[float, np.ndarray, list]] = collections.deque(maxlen=self.max_frames)

    def add_frame(self, frame: np.ndarray, detections: list):
        self.buffer.append((time.time(), frame.copy(), detections))

    def get_recent_frames(self, duration_seconds: float = 5.0):
        cutoff = time.time() - duration_seconds
        return [(ts, f, d) for (ts, f, d) in self.buffer if ts >= cutoff]

    def clear(self):
        self.buffer.clear()
