"""
Multi-frame verification tracker according to CityEye Technical Specification Section 6.
Enforces multi-frame persistence (IoU >= 0.5 across >= 5 frames) to eliminate false positives.
"""
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

def calculate_iou(boxA: list[float], boxB: list[float]) -> float:
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])
    interArea = max(0.0, xB - xA) * max(0.0, yB - yA)
    boxAArea = max(0.0, boxA[2] - boxA[0]) * max(0.0, boxA[3] - boxA[1])
    boxBArea = max(0.0, boxB[2] - boxB[0]) * max(0.0, boxB[3] - boxB[1])
    denom = boxAArea + boxBArea - interArea
    return interArea / denom if denom > 0 else 0.0

@dataclass
class Candidate:
    problem_type: str
    camera_id: str
    bbox: list[float]  # [x1, y1, x2, y2] normalized
    confidence: float
    confirmed_frame_count: int = 1
    missing_frame_count: int = 0
    first_seen_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = "candidate"  # "candidate" -> "confirmed"
    id: str = field(default_factory=lambda: uuid.uuid4().hex)

class MultiFrameVerifier:
    def __init__(self, iou_threshold: float = 0.5, confirm_threshold: int = 5, max_missing: int = 10):
        self.iou_threshold = iou_threshold
        self.confirm_threshold = confirm_threshold
        self.max_missing = max_missing
        self.candidates: list[Candidate] = []

    def process_frame_detections(self, camera_id: str, detections: list[dict]) -> list[Candidate]:
        """
        detections: list of dicts with keys: 'class', 'confidence', 'bbox' ([x1, y1, x2, y2])
        Returns list of newly CONFIRMED candidates on this frame.
        """
        matched_candidate_ids = set()
        newly_confirmed = []

        for det in detections:
            prob_type = det["class"]
            bbox = det["bbox"]
            conf = det["confidence"]

            best_cand = None
            best_iou = 0.0

            for cand in self.candidates:
                if cand.camera_id == camera_id and cand.problem_type == prob_type and cand.id not in matched_candidate_ids:
                    iou = calculate_iou(cand.bbox, bbox)
                    if iou >= self.iou_threshold and iou > best_iou:
                        best_iou = iou
                        best_cand = cand

            if best_cand:
                matched_candidate_ids.add(best_cand.id)
                best_cand.bbox = bbox
                best_cand.confidence = conf
                best_cand.missing_frame_count = 0
                best_cand.confirmed_frame_count += 1

                if best_cand.status == "candidate" and best_cand.confirmed_frame_count >= self.confirm_threshold:
                    best_cand.status = "confirmed"
                    newly_confirmed.append(best_cand)
            else:
                new_cand = Candidate(
                    problem_type=prob_type,
                    camera_id=camera_id,
                    bbox=bbox,
                    confidence=conf,
                    confirmed_frame_count=1,
                )
                self.candidates.append(new_cand)
                matched_candidate_ids.add(new_cand.id)

        active_candidates = []
        for cand in self.candidates:
            if cand.id not in matched_candidate_ids and cand.camera_id == camera_id:
                cand.missing_frame_count += 1
                if cand.missing_frame_count <= self.max_missing:
                    active_candidates.append(cand)
            else:
                active_candidates.append(cand)

        self.candidates = active_candidates
        return newly_confirmed
