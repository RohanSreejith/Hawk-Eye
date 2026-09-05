import time
import pytest
from app.events.deduplicator import AlertDeduplicator

def test_deduplication_persistence_and_cooldown():
    dedup = AlertDeduplicator(cooldown_seconds=10)
    track_id = "PERSON_TEST_01"
    cam_id = "CAM_TEST"
    evt = "no_helmet"

    # Frame 1: Should not trigger yet (needs min 3 frames)
    assert not dedup.should_trigger(track_id, cam_id, evt, min_consecutive_frames=3)
    # Frame 2:
    assert not dedup.should_trigger(track_id, cam_id, evt, min_consecutive_frames=3)
    # Frame 3: Condition persisted, first trigger passes!
    assert dedup.should_trigger(track_id, cam_id, evt, min_consecutive_frames=3)

    # Frame 4 (immediate next frame): Cooldown must suppress duplicate
    assert not dedup.should_trigger(track_id, cam_id, evt, min_consecutive_frames=3)
    assert dedup.alerts_suppressed >= 1
