"""
Generates a realistic test video for CityEye AI verification.
Renders road surface with an emerging and persistent road defect.
"""
import os
import cv2
import numpy as np

def create_synthetic_road_clip(output_path: str, duration_sec: int = 4, fps: int = 20):
    width, height = 640, 480
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    total_frames = duration_sec * fps

    for i in range(total_frames):
        # Base asphalt background (dark grey with texture)
        frame = np.full((height, width, 3), (60, 60, 65), dtype=np.uint8)

        # Road lane markings
        cv2.line(frame, (width // 2, 0), (width // 2, height), (200, 200, 200), 4)

        # After frame 15, simulate persistent pothole/road damage
        if i >= 15:
            center_x = 220 + int(np.sin(i * 0.1) * 2)
            center_y = 300
            # Draw pothole ellipse (dark crater with textured rim)
            cv2.ellipse(frame, (center_x, center_y), (45, 25), 0, 0, 360, (25, 25, 28), -1)
            cv2.ellipse(frame, (center_x, center_y), (48, 27), 0, 0, 360, (90, 85, 80), 2)

        out.write(frame)

    out.release()
    print(f"[+] Successfully generated test road footage at: {output_path} ({total_frames} frames)")

if __name__ == "__main__":
    out_dir = os.path.dirname(os.path.abspath(__file__))
    sample_path = os.path.join(out_dir, "test_road_footage.mp4")
    create_synthetic_road_clip(sample_path)
