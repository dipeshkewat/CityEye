from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Any
from datetime import datetime
from app.models.models import UserRole, ReportStatus, ProblemType, SeverityLabel, GenerationSource

# Auth Schemas
class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: UserRole
    team_name: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[str] = None
    exp: Optional[int] = None

# Camera Schemas
class CameraCreate(BaseModel):
    name: str = Field(..., max_length=150)
    latitude: float
    longitude: float
    address: str = Field(..., max_length=255)
    is_active: bool = True

class CameraOut(BaseModel):
    id: str
    name: str
    latitude: float
    longitude: float
    address: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# Detection Schemas
class DetectionOut(BaseModel):
    id: str
    camera_id: str
    problem_type: str
    status: str
    confidence: float
    bbox_x1: float
    bbox_y1: float
    bbox_x2: float
    bbox_y2: float
    frame_area_ratio: Optional[float] = None
    confirmed_frame_count: int
    first_seen_at: datetime
    confirmed_at: Optional[datetime] = None
    evidence_image_path: Optional[str] = None
    severity_score: Optional[float] = None
    severity_label: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Report Schemas
class ReportReviewRequest(BaseModel):
    decision: str  # "approved" or "rejected"
    rejection_reason: Optional[str] = None

class ReportAssignRequest(BaseModel):
    assigned_team: str  # User ID of work_team

class ReportProgressRequest(BaseModel):
    status: str = "in_progress"

class ReportResolveRequest(BaseModel):
    resolution_notes: str
    resolution_photo_path: Optional[str] = None

class ReportOut(BaseModel):
    id: str
    detection_id: Optional[str] = None
    camera_id: Optional[str] = None
    title: str
    description: str
    citizen_summary: Optional[str] = None
    recommended_department: str
    generation_source: GenerationSource
    status: ReportStatus
    
    problem_type: Optional[str] = None
    severity_label: Optional[str] = None
    severity_score: Optional[float] = None
    confidence: Optional[float] = None
    confirmed_frame_count: int
    evidence_image_path: Optional[str] = None
    
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    
    assigned_team: Optional[str] = None
    assigned_at: Optional[datetime] = None
    
    in_progress_at: Optional[datetime] = None
    resolution_photo_path: Optional[str] = None
    resolution_notes: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime
    
    # Associated camera details if available
    camera: Optional[CameraOut] = None
    assignee: Optional[UserOut] = None

    class Config:
        from_attributes = True

# Dashboard Stats Schemas
class StatsDashboardOut(BaseModel):
    role: str
    summary: dict[str, Any]
    breakdown_by_status: dict[str, int]
    breakdown_by_severity: dict[str, int]
    breakdown_by_department: dict[str, int]
    recent_activity: List[ReportOut]
