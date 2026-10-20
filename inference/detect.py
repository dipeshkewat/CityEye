"""
CityEye YOLOv8 AI Detection and Ingestion Pipeline.
Implements Video Ingestion, CLAHE Low-Light/Contrast Pre-Processing,
YOLOv8 Object Detection, Multi-Frame Confirmation, Severity Calculation,
and Automated Report Insertion into PostgreSQL.
"""
import os
import sys
import uuid
import time
import argparse
from datetime import datetime, timezone
import cv2
import numpy as np
from ultralytics import YOLO

# Add paths for project imports
current_dir = os.path.dirname(os.path.abspath(__file__))
ml_dir = os.path.abspath(os.path.join(current_dir, ".."))
backend_dir = os.path.abspath(os.path.join(current_dir, "..", "..", "backend"))
sys.path.append(ml_dir)
sys.path.append(backend_dir)

from pipeline.verifier import MultiFrameVerifier
from pipeline.severity import calculate_severity
from pipeline.complaint_generator import generate_complaint
from pipeline.preprocessor import apply_clahe_enhancement
try:
    from app.core.database import SessionLocal
    from app.models.models import Report, Camera, ReportStatus
    DB_AVAILABLE = True
except ImportError:
    SessionLocal = None
    Report = None
    Camera = None
    ReportStatus = None
    DB_AVAILABLE = False

TARGET_CLASSES = {"pothole", "garbage", "garbage_dump", "waterlogging"}

def ensure_evidence_dir():
    evidence_dir = os.path.join(ml_dir, "uploads", "evidence")
    os.makedirs(evidence_dir, exist_ok=True)
    return evidence_dir

def run_simulation(camera_id: str = "cam-001", problem_type: str = "pothole", enable_clahe: bool = True):
    print(f"\n=======================================================")
    print(f"[*] RUNNING CITYEYE AI MULTI-FRAME SIMULATION")
    print(f"[*] Target Camera: {camera_id} | Defect: {problem_type.upper()}")
    print(f"[*] CLAHE Contrast Pre-Processing: {'ENABLED' if enable_clahe else 'DISABLED'}")
    print(f"=======================================================\n")

    if DB_AVAILABLE and SessionLocal:
        db = SessionLocal()
        camera = db.query(Camera).filter(Camera.id == camera_id).first()
        camera_name = camera.name if camera else "SV Road Junction Camera"
        camera_addr = camera.address if camera else "SV Road, Bandra West"
        db.close()
    else:
        camera_name = "SV Road Junction Camera"
        camera_addr = "SV Road, Bandra West" 

    verifier = MultiFrameVerifier(iou_threshold=0.5, confirm_threshold=5)
    evidence_dir = ensure_evidence_dir()

    base_frame = np.full((480, 640, 3), (60, 60, 65), dtype=np.uint8)
    cv2.line(base_frame, (320, 0), (320, 480), (220, 220, 220), 4)
    cv2.putText(base_frame, f"CAM: {camera_name}", (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

    confirmed_reports = []

    for frame_idx in range(1, 9):
        # Slightly jitter the bounding box to test IoU matching
        jitter_x = (frame_idx % 3) * 0.005
        jitter_y = (frame_idx % 2) * 0.005
        norm_bbox = [0.35 + jitter_x, 0.55 + jitter_y, 0.58 + jitter_x, 0.78 + jitter_y]
        conf = 0.88 + (frame_idx * 0.01)

        frame = base_frame.copy()
        if enable_clahe:
            frame = apply_clahe_enhancement(frame)

        print(f"  -> [Frame #{frame_idx:02d}] Candidate: '{problem_type}' (IoU ~0.94, Conf: {conf*100:.1f}%) [CLAHE Active]")

        detections = [{
            "class": problem_type,
            "confidence": conf,
            "bbox": norm_bbox,
        }]

        confirmed_candidates = verifier.process_frame_detections(camera_id, detections)

        if confirmed_candidates:
            cand = confirmed_candidates[0]
            bw = cand.bbox[2] - cand.bbox[0]
            bh = cand.bbox[3] - cand.bbox[1]
            area_ratio = min(1.0, bw * bh)

            sev_score, sev_label = calculate_severity(
                bbox_area_ratio=area_ratio,
                confirmed_frame_count=cand.confirmed_frame_count,
                confidence=cand.confidence
            )

            complaint = generate_complaint(
                problem_type=cand.problem_type,
                address=camera_addr,
                camera_name=camera_name,
                severity_label=sev_label,
                severity_score=sev_score,
                confidence=cand.confidence,
                confirmed_frame_count=cand.confirmed_frame_count
            )

            report_id = f"rpt-ai-{uuid.uuid4().hex[:6]}"
            evidence_filename = f"{report_id}.jpg"
            evidence_filepath = os.path.join(evidence_dir, evidence_filename)

            annotated = frame.copy()
            px1, py1 = int(cand.bbox[0] * 640), int(cand.bbox[1] * 480)
            px2, py2 = int(cand.bbox[2] * 640), int(cand.bbox[3] * 480)
            cv2.ellipse(annotated, ((px1+px2)//2, (py1+py2)//2), ((px2-px1)//2, (py2-py1)//2), 0, 0, 360, (20, 20, 20), -1)
            cv2.rectangle(annotated, (px1, py1), (px2, py2), (0, 0, 255), 2)
            cv2.putText(annotated, f"CONFIRMED {problem_type.upper()} ({cand.confidence*100:.0f}%)", (px1, py1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
            cv2.imwrite(evidence_filepath, annotated)

            db = SessionLocal()
            new_report = Report(
                id=report_id,
                camera_id=camera_id,
                title=complaint["title"],
                description=complaint["description"],
                citizen_summary=f"Automated AI detection of {cand.problem_type} with {sev_label} severity (CLAHE enhanced).",
                recommended_department=complaint["recommended_department"],
                problem_type=cand.problem_type,
                severity_label=sev_label,
                severity_score=sev_score,
                confidence=cand.confidence,
                confirmed_frame_count=cand.confirmed_frame_count,
                evidence_image_path=f"/uploads/evidence/{evidence_filename}",
                status=ReportStatus.pending_officer_review
            )
            db.add(new_report)
            db.commit()
            db.refresh(new_report)
            db.close()

            print(f"\n  [✔] INCIDENT CONFIRMED AT FRAME #{frame_idx}!")
            print(f"      Report ID:     {report_id}")
            print(f"      Type:          {cand.problem_type}")
            print(f"      Severity:      {sev_label.upper()} (Score: {sev_score})")
            print(f"      Pre-process:   CLAHE Luminance Equalization (LAB)")
            print(f"      Database:      COMMITTED TO POSTGRESQL\n")
            confirmed_reports.append(report_id)

    print(f"[*] Simulation completed. Generated {len(confirmed_reports)} verified incident(s).")
    return confirmed_reports

def process_stream(
    video_source: str,
    camera_id: str,
    model_path: str = "yolov8n.pt",
    conf_threshold: float = 0.25,
    confirm_frames: int = 3,
    max_frames: int | None = None,
    enable_clahe: bool = True
):
    print(f"[*] Initializing CityEye AI Pipeline on Camera: {camera_id}")
    print(f"[*] Loading YOLOv8 Model: {model_path} (Confidence threshold: {conf_threshold})")
    print(f"[*] CLAHE Contrast Pre-Processing: {'ENABLED' if enable_clahe else 'DISABLED'}")
    model = YOLO(model_path)

    db = SessionLocal()
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    camera_name = camera.name if camera else "City Monitoring Camera"
    camera_addr = camera.address if camera else "Main City Junction"
    db.close()

    verifier = MultiFrameVerifier(iou_threshold=0.5, confirm_threshold=confirm_frames)
    evidence_dir = ensure_evidence_dir()

    cap = cv2.VideoCapture(video_source if not video_source.isdigit() else int(video_source))
    if not cap.isOpened():
        print(f"[!] Error: Could not open video source: {video_source}")
        return

    frame_count = 0
    confirmed_reports = []

    try:
        while cap.isOpened():
            ret, raw_frame = cap.read()
            if not ret:
                break

            frame_count += 1
            h, w = raw_frame.shape[:2]

            # Apply CLAHE to boost contrast for poor-quality/washed-out CCTV video
            infer_frame = apply_clahe_enhancement(raw_frame) if enable_clahe else raw_frame

            results = model(infer_frame, conf=conf_threshold, verbose=False)
            frame_detections = []

            for r in results:
                for box in r.boxes:
                    cls_id = int(box.cls[0])
                    class_name = model.names[cls_id].lower()

                    if class_name in ["bottle", "cup", "handbag", "backpack", "suitcase"]:
                        class_name = "garbage"

                    conf = float(box.conf[0])
                    x1, y1, x2, y2 = box.xyxy[0].tolist()

                    norm_bbox = [x1 / w, y1 / h, x2 / w, y2 / h]
                    frame_detections.append({
                        "class": class_name,
                        "confidence": conf,
                        "bbox": norm_bbox,
                    })

            confirmed_candidates = verifier.process_frame_detections(camera_id, frame_detections)

            for cand in confirmed_candidates:
                bw = max(0.0, cand.bbox[2] - cand.bbox[0])
                bh = max(0.0, cand.bbox[3] - cand.bbox[1])
                area_ratio = min(1.0, bw * bh)

                sev_score, sev_label = calculate_severity(
                    bbox_area_ratio=area_ratio,
                    confirmed_frame_count=cand.confirmed_frame_count,
                    confidence=cand.confidence
                )

                complaint = generate_complaint(
                    problem_type=cand.problem_type,
                    address=camera_addr,
                    camera_name=camera_name,
                    severity_label=sev_label,
                    severity_score=sev_score,
                    confidence=cand.confidence,
                    confirmed_frame_count=cand.confirmed_frame_count
                )

                report_id = f"rpt-ai-{uuid.uuid4().hex[:6]}"
                evidence_filename = f"{report_id}.jpg"
                evidence_filepath = os.path.join(evidence_dir, evidence_filename)

                annotated_frame = raw_frame.copy()
                px1 = int(cand.bbox[0] * w)
                py1 = int(cand.bbox[1] * h)
                px2 = int(cand.bbox[2] * w)
                py2 = int(cand.bbox[3] * h)

                cv2.rectangle(annotated_frame, (px1, py1), (px2, py2), (0, 0, 255), 2)
                cv2.putText(annotated_frame, f"{cand.problem_type.upper()} ({cand.confidence*100:.0f}%) [CLAHE]", (px1, max(20, py1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
                cv2.imwrite(evidence_filepath, annotated_frame)

                db = SessionLocal()
                new_report = Report(
                    id=report_id,
                    camera_id=camera_id,
                    title=complaint["title"],
                    description=complaint["description"],
                    citizen_summary=f"Automated AI detection of {cand.problem_type} with {sev_label} severity (CLAHE enhanced).",
                    recommended_department=complaint["recommended_department"],
                    problem_type=cand.problem_type,
                    severity_label=sev_label,
                    severity_score=sev_score,
                    confidence=cand.confidence,
                    confirmed_frame_count=cand.confirmed_frame_count,
                    evidence_image_path=f"/uploads/evidence/{evidence_filename}",
                    status=ReportStatus.pending_officer_review
                )
                db.add(new_report)
                db.commit()
                db.refresh(new_report)
                db.close()

                print(f"[+] [CONFIRMED REPORT] ID: {report_id} | Type: {cand.problem_type} | Severity: {sev_label.upper()} ({sev_score}) | Saved into PostgreSQL!")
                confirmed_reports.append(report_id)

            if max_frames and frame_count >= max_frames:
                break

    finally:
        cap.release()
        print(f"[*] Ingestion complete. Processed {frame_count} frames. Confirmed {len(confirmed_reports)} incidents.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CityEye AI YOLOv8 Detection Pipeline with CLAHE")
    parser.add_argument("--source", type=str, default="0", help="Video file path or webcam index (0)")
    parser.add_argument("--camera-id", type=str, default="cam-001", help="Camera ID associated with the footage")
    parser.add_argument("--model", type=str, default="yolov8n.pt", help="Path to YOLOv8 weights")
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold")
    parser.add_argument("--confirm-frames", type=int, default=3, help="Consecutive frames required for confirmation")
    parser.add_argument("--max-frames", type=int, default=None, help="Max frames to process")
    parser.add_argument("--simulate", action="store_true", help="Run multi-frame confirmation simulation")
    parser.add_argument("--type", type=str, default="pothole", help="Defect type for simulation")
    parser.add_argument("--no-clahe", action="store_true", help="Disable CLAHE contrast pre-processing")

    args = parser.parse_args()

    if args.simulate:
        run_simulation(camera_id=args.camera_id, problem_type=args.type, enable_clahe=not args.no_clahe)
    else:
        process_stream(
            video_source=args.source,
            camera_id=args.camera_id,
            model_path=args.model,
            conf_threshold=args.conf,
            confirm_frames=args.confirm_frames,
            max_frames=args.max_frames,
            enable_clahe=not args.no_clahe
        )
