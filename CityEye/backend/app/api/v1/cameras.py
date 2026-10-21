from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import Camera, User, UserRole
from app.schemas.schemas import CameraCreate, CameraOut
from app.api.deps import get_current_user, require_role

router = APIRouter()

@router.get("", response_model=list[CameraOut])
def get_cameras(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.officer, UserRole.senior_officer))
):
    """
    List registered CCTV cameras.
    Allowed for: officer, senior_officer.
    """
    cameras = db.query(Camera).order_by(Camera.created_at.desc()).all()
    return [CameraOut.model_validate(c) for c in cameras]

@router.post("", response_model=CameraOut, status_code=status.HTTP_201_CREATED)
def register_camera(
    camera_in: CameraCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.officer))
):
    """
    Register a new CCTV camera.
    Allowed for: officer only.
    """
    camera = Camera(
        name=camera_in.name,
        latitude=camera_in.latitude,
        longitude=camera_in.longitude,
        address=camera_in.address,
        is_active=camera_in.is_active,
    )
    db.add(camera)
    db.commit()
    db.refresh(camera)
    return CameraOut.model_validate(camera)

@router.get("/{camera_id}", response_model=CameraOut)
def get_camera(
    camera_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.officer, UserRole.senior_officer))
):
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    return CameraOut.model_validate(camera)
