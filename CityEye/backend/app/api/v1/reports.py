from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import Report, User, UserRole, ReportStatus
from app.schemas.schemas import (
    ReportOut,
    ReportReviewRequest,
    ReportAssignRequest,
    ReportProgressRequest,
    ReportResolveRequest,
)
from app.api.deps import get_current_user, require_role

router = APIRouter()

@router.get("", response_model=list[ReportOut])
def list_reports(
    status: Optional[str] = Query(None),
    problem_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List reports. Enforces server-side role filtering:
    - work_team: strictly restricted to reports assigned specifically to them
    - officer & senior_officer: can view all reports across the system
    """
    query = db.query(Report)

    # Server-side row-level constraint based on role
    if current_user.role == UserRole.work_team:
        query = query.filter(Report.assigned_team == current_user.id)
    
    if status:
        query = query.filter(Report.status == status)
    if problem_type:
        query = query.filter(Report.problem_type == problem_type)

    reports = query.order_by(Report.created_at.desc()).all()
    return [ReportOut.model_validate(r) for r in reports]

@router.get("/{report_id}", response_model=ReportOut)
def get_report_detail(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get full report detail with row-level ownership check for work_team users.
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Ownership verification for work_team
    if current_user.role == UserRole.work_team and report.assigned_team != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You can only view reports assigned directly to your team."
        )

    return ReportOut.model_validate(report)

@router.patch("/{report_id}/review", response_model=ReportOut)
def review_report(
    report_id: str,
    payload: ReportReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.officer))
):
    """
    Review a pending report (Approve or Reject).
    Allowed for: officer only.
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    decision = payload.decision.lower().strip()
    if decision not in ["approved", "rejected"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Decision must be either 'approved' or 'rejected'."
        )

    if decision == "rejected":
        if not payload.rejection_reason or not payload.rejection_reason.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A rejection reason is mandatory when rejecting a report."
            )
        report.status = ReportStatus.rejected
        report.rejection_reason = payload.rejection_reason.strip()
    else:
        report.status = ReportStatus.approved
        report.rejection_reason = None

    report.reviewed_by = current_user.id
    report.reviewed_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(report)
    return ReportOut.model_validate(report)

@router.patch("/{report_id}/assign", response_model=ReportOut)
def assign_report(
    report_id: str,
    payload: ReportAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.officer))
):
    """
    Assign an approved report to an active work team.
    Allowed for: officer only.
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    target_user = db.query(User).filter(User.id == payload.assigned_team).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target work team user not found.")
    
    if target_user.role != UserRole.work_team:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User '{target_user.name}' does not have the 'work_team' role."
        )

    report.assigned_team = target_user.id
    report.assigned_at = datetime.now(timezone.utc)
    report.status = ReportStatus.assigned
    
    # If the report wasn't reviewed yet, mark reviewed by current officer
    if not report.reviewed_by:
        report.reviewed_by = current_user.id
        report.reviewed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(report)
    return ReportOut.model_validate(report)

@router.patch("/{report_id}/progress", response_model=ReportOut)
def start_report_progress(
    report_id: str,
    payload: ReportProgressRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.work_team))
):
    """
    Mark an assigned report as in_progress.
    Allowed for: assigned work_team member only.
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Strict row-level ownership check
    if report.assigned_team != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You can only update progress on reports assigned to you."
        )

    if report.status != ReportStatus.assigned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Report must be in 'assigned' status to mark 'in_progress'. Current status: {report.status.value}"
        )

    report.status = ReportStatus.in_progress
    report.in_progress_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(report)
    return ReportOut.model_validate(report)

@router.patch("/{report_id}/resolve", response_model=ReportOut)
def resolve_report(
    report_id: str,
    payload: ReportResolveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.work_team))
):
    """
    Mark a report as resolved. Requires notes and resolution photo.
    Allowed for: assigned work_team member only.
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Strict row-level ownership check
    if report.assigned_team != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You can only resolve reports assigned to you."
        )

    if not payload.resolution_notes or len(payload.resolution_notes.strip()) < 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Meaningful resolution notes (minimum 5 characters) are required."
        )

    report.status = ReportStatus.resolved
    report.resolution_notes = payload.resolution_notes.strip()
    if payload.resolution_photo_path:
        report.resolution_photo_path = payload.resolution_photo_path
    report.resolved_by = current_user.id
    report.resolved_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(report)
    return ReportOut.model_validate(report)
