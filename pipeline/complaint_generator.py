"""
Complaint generation module according to CityEye Technical Specification Section 8.
Supports fallback templates and extensible LLM summary generation.
"""
from datetime import datetime, timezone

TEMPLATES = {
    "pothole": "A pothole has been detected on {address}, near {camera_name}. Severity: {severity_label}. Detected at {timestamp} with {confidence:.1f}% confidence.",
    "garbage": "Illegal garbage dumping has been detected on {address}, near {camera_name}. Severity: {severity_label}. Detected at {timestamp} with {confidence:.1f}% confidence.",
    "garbage_dump": "Illegal garbage dumping has been detected on {address}, near {camera_name}. Severity: {severity_label}. Detected at {timestamp} with {confidence:.1f}% confidence.",
    "waterlogging": "Waterlogging has been detected on {address}, near {camera_name}. Severity: {severity_label}. Detected at {timestamp} with {confidence:.1f}% confidence.",
}

DEPARTMENT_ROUTING = {
    "pothole": "Road Maintenance Department",
    "garbage": "Sanitation Department",
    "garbage_dump": "Sanitation Department",
    "waterlogging": "Drainage & Public Works Department",
}

def generate_complaint(
    problem_type: str,
    address: str,
    camera_name: str,
    severity_label: str,
    severity_score: float,
    confidence: float,
    confirmed_frame_count: int,
) -> dict:
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    template = TEMPLATES.get(problem_type, "Civic issue detected on {address}, near {camera_name}.")
    description = template.format(
        address=address or "Unknown Location",
        camera_name=camera_name or "Camera",
        severity_label=severity_label.upper(),
        timestamp=timestamp,
        confidence=confidence * 100.0,
    )
    department = DEPARTMENT_ROUTING.get(problem_type, "Public Works Department")
    title = f"{problem_type.replace('_', ' ').title()} Reported at {camera_name}"

    return {
        "title": title[:80],
        "description": description,
        "recommended_department": department,
        "generation_source": "template_fallback",
    }
