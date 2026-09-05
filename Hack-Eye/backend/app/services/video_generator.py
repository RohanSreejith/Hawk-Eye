import os
import cv2
import numpy as np

def create_sample_videos():
    video_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "videos")
    os.makedirs(video_dir, exist_ok=True)

    width, height = 960, 540
    fps = 20
    duration_sec = 12
    total_frames = fps * duration_sec

    # 1. Loading Zone Truck & Worker Video
    truck_video_path = os.path.join(video_dir, "loading_zone_truck.mp4")
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(truck_video_path, fourcc, fps, (width, height))

    print("[GEN] Generating loading_zone_truck.mp4...")
    for i in range(total_frames):
        # Realistic construction site backdrop
        frame = np.full((height, width, 3), (35, 42, 50), dtype=np.uint8)
        
        # Ground and perspective
        cv2.rectangle(frame, (0, int(height * 0.45)), (width, height), (75, 85, 95), -1)
        # Background building frame
        for col in range(80, width, 120):
            cv2.line(frame, (col, 80), (col, int(height * 0.45)), (55, 65, 75), 4)
        for row in range(120, int(height * 0.45), 50):
            cv2.line(frame, (0, row), (width, row), (50, 60, 70), 2)
            
        t = i / float(total_frames)
        
        # Moving truck (dump truck)
        truck_x = int(180 + 120 * np.sin(t * 3.14))
        truck_y = int(height * 0.48)
        # Truck body
        cv2.rectangle(frame, (truck_x - 140, truck_y - 80), (truck_x + 140, truck_y + 80), (45, 95, 160), -1)
        cv2.rectangle(frame, (truck_x - 140, truck_y - 80), (truck_x + 140, truck_y + 80), (70, 140, 230), 2)
        # Truck cab
        cv2.rectangle(frame, (truck_x - 140, truck_y - 40), (truck_x - 60, truck_y + 80), (35, 75, 130), -1)
        # Wheels
        cv2.circle(frame, (truck_x - 90, truck_y + 85), 24, (20, 20, 20), -1)
        cv2.circle(frame, (truck_x + 80, truck_y + 85), 24, (20, 20, 20), -1)
        cv2.putText(frame, "DUMP TRUCK #04", (truck_x - 40, truck_y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

        # Worker moving near truck without helmet
        worker_x = int(width * 0.65 - 40 * t)
        worker_y = int(height * 0.60)
        # Head (bare head, dark hair, NO HELMET)
        cv2.circle(frame, (worker_x, worker_y - 50), 18, (30, 40, 50), -1)
        # Torso with green safety vest
        cv2.rectangle(frame, (worker_x - 16, worker_y - 30), (worker_x + 16, worker_y + 35), (40, 210, 80), -1)
        # Legs
        cv2.line(frame, (worker_x - 10, worker_y + 35), (worker_x - 10, worker_y + 80), (40, 40, 60), 6)
        cv2.line(frame, (worker_x + 10, worker_y + 35), (worker_x + 10, worker_y + 80), (40, 40, 60), 6)
        
        out.write(frame)
    out.release()

    # 2. Worker No Helmet Video
    no_helmet_path = os.path.join(video_dir, "worker_no_helmet.mp4")
    out2 = cv2.VideoWriter(no_helmet_path, fourcc, fps, (width, height))
    print("[GEN] Generating worker_no_helmet.mp4...")
    for i in range(total_frames):
        frame = np.full((height, width, 3), (38, 44, 52), dtype=np.uint8)
        # Entrance gate
        cv2.rectangle(frame, (0, int(height * 0.5)), (width, height), (70, 75, 82), -1)
        cv2.line(frame, (200, 100), (200, int(height * 0.5)), (80, 90, 100), 8)
        cv2.line(frame, (width - 200, 100), (width - 200, int(height * 0.5)), (80, 90, 100), 8)

        t = i / float(total_frames)
        wx = int(220 + t * 450)
        wy = int(height * 0.62)
        # Bare head (no helmet)
        cv2.circle(frame, (wx, wy - 55), 20, (30, 40, 55), -1)
        # Vest
        cv2.rectangle(frame, (wx - 18, wy - 32), (wx + 18, wy + 40), (20, 190, 100), -1)
        # Legs
        cv2.line(frame, (wx - 10, wy + 40), (wx - 10, wy + 90), (35, 40, 50), 6)
        cv2.line(frame, (wx + 10, wy + 40), (wx + 10, wy + 90), (35, 40, 50), 6)

        out2.write(frame)
    out2.release()

    print(f"[GEN] Sample videos ready in: {video_dir}")

if __name__ == "__main__":
    create_sample_videos()
