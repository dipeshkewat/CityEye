"""
Severity calculation module according to CityEye Technical Specification Section 7.
"""

def calculate_severity(bbox_area_ratio: float, confirmed_frame_count: int, confidence: float) -> tuple[float, str]:
    """
    severity_score = (frame_area_ratio * 0.5) + (normalized_persistence * 0.3) + (confidence * 0.2)
    where:
      frame_area_ratio = bbox area / total frame area (0-1)
      normalized_persistence = min(confirmed_frame_count / 15, 1.0)
      confidence = model confidence score (0-1)

    severity_label:
      score < 0.35  -> "low"
      0.35 - 0.65   -> "medium"
      score > 0.65  -> "high"
    """
    normalized_persistence = min(confirmed_frame_count / 15.0, 1.0)
    score = (bbox_area_ratio * 0.5) + (normalized_persistence * 0.3) + (confidence * 0.2)
    score = round(float(score), 3)

    if score < 0.35:
        label = "low"
    elif score <= 0.65:
        label = "medium"
    else:
        label = "high"

    return score, label
