from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import Detection, User, UserRole, DetectionStatus
from app.schemas.schemas import DetectionOut
from app.api.deps import require_role

router = APIRouter()

@router.get("", response_model=list[DetectionOut])
def get_detections(
    camera_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    problem_type: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.officer, UserRole.senior_officer))
):
    """
    List raw AI detections with multi-frame confirmation status.
    Allowed for: officer, senior_officer.
    """
    query = db.query(Detection)
    if camera_id:
        query = query.filter(Detection.camera_id == camera_id)
    if status:
        query = query.filter(Detection.status == status)
    if problem_type:
        query = query.filter(Detection.problem_type == problem_type)
        
    detections = query.order_by(Detection.created_at.desc()).limit(limit).all()
    return [DetectionOut.model_validate(d) for d in detections]
