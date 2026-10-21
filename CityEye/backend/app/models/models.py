import uuid
from datetime import datetime, timezone
import enum
from sqlalchemy import (
    Column,
    String,
    Boolean,
    Float,
    Integer,
    DateTime,
    ForeignKey,
    Enum,
    Text,
)
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class UserRole(str, enum.Enum):
    officer = "officer"
    work_team = "work_team"
    senior_officer = "senior_officer"

class ProblemType(str, enum.Enum):
    pothole = "pothole"
    garbage = "garbage"
    garbage_dump = "garbage_dump"
    waterlogging = "waterlogging"

class DetectionStatus(str, enum.Enum):
    candidate = "candidate"
    confirmed = "confirmed"
    rejected_false_positive = "rejected_false_positive"

class SeverityLabel(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"

class ReportStatus(str, enum.Enum):
    pending_officer_review = "pending_officer_review"
    approved = "approved"
    rejected = "rejected"
    assigned = "assigned"
    in_progress = "in_progress"
    resolved = "resolved"

class GenerationSource(str, enum.Enum):
    llm = "llm"
    template_fallback = "template_fallback"

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    team_name = Column(String(150), nullable=True)  # E.g. "Road Maintenance Crew 2"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    reviewed_reports = relationship("Report", foreign_keys="[Report.reviewed_by]", back_populates="reviewer")
    assigned_reports = relationship("Report", foreign_keys="[Report.assigned_team]", back_populates="assignee")
    resolved_reports = relationship("Report", foreign_keys="[Report.resolved_by]", back_populates="resolver")

class Camera(Base):
    __tablename__ = "cameras"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    name = Column(String(150), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    detections = relationship("Detection", back_populates="camera")
    reports = relationship("Report", back_populates="camera")

class Detection(Base):
    __tablename__ = "detections"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    camera_id = Column(String(64), ForeignKey("cameras.id"), index=True, nullable=False)
    problem_type = Column(String(50), nullable=False)
    status = Column(Enum(DetectionStatus), default=DetectionStatus.candidate, index=True)
    confidence = Column(Float, nullable=False)
    bbox_x1 = Column(Float, nullable=False)
    bbox_y1 = Column(Float, nullable=False)
    bbox_x2 = Column(Float, nullable=False)
    bbox_y2 = Column(Float, nullable=False)
    frame_area_ratio = Column(Float, nullable=True)
    confirmed_frame_count = Column(Integer, default=1)
    first_seen_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    evidence_image_path = Column(String(255), nullable=True)
    severity_score = Column(Float, nullable=True)
    severity_label = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    camera = relationship("Camera", back_populates="detections")
    report = relationship("Report", back_populates="detection", uselist=False)

class Report(Base):
    __tablename__ = "reports"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    detection_id = Column(String(36), ForeignKey("detections.id"), unique=True, nullable=True)
    camera_id = Column(String(64), ForeignKey("cameras.id"), nullable=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    citizen_summary = Column(Text, nullable=True)
    recommended_department = Column(String(100), nullable=False)
    generation_source = Column(Enum(GenerationSource), default=GenerationSource.template_fallback)
    status = Column(Enum(ReportStatus), default=ReportStatus.pending_officer_review, index=True)
    
    # Defect metadata replicated for high-throughput query performance
    problem_type = Column(String(50), nullable=True)
    severity_label = Column(String(20), nullable=True)
    severity_score = Column(Float, nullable=True)
    confidence = Column(Float, nullable=True)
    confirmed_frame_count = Column(Integer, default=1)
    evidence_image_path = Column(String(255), nullable=True)

    # Workflow tracking
    reviewed_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    assigned_team = Column(String(36), ForeignKey("users.id"), index=True, nullable=True)
    assigned_at = Column(DateTime(timezone=True), nullable=True)
    
    in_progress_at = Column(DateTime(timezone=True), nullable=True)
    resolution_photo_path = Column(String(255), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    resolved_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    detection = relationship("Detection", back_populates="report")
    camera = relationship("Camera", back_populates="reports")
    reviewer = relationship("User", foreign_keys=[reviewed_by], back_populates="reviewed_reports")
    assignee = relationship("User", foreign_keys=[assigned_team], back_populates="assigned_reports")
    resolver = relationship("User", foreign_keys=[resolved_by], back_populates="resolved_reports")
