from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.models.models import Report, Camera, User, UserRole, ReportStatus
from app.schemas.schemas import StatsDashboardOut, ReportOut
from app.api.deps import get_current_user

router = APIRouter()

@router.get("/dashboard", response_model=StatsDashboardOut)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns tailored dashboard metrics based on caller's role:
    - Officer: Review queue stats & assignment workload
    - Work Team: Personal assigned task counts & completions
    - Senior Officer: City-wide macro KPIs, departmental breakdown, and resolution metrics
    """
    user_role = current_user.role
    
    # Query base
    base_query = db.query(Report)
    if user_role == UserRole.work_team:
        base_query = base_query.filter(Report.assigned_team == current_user.id)

    # Status counts
    all_reports = base_query.all()
    status_counts = {}
    for st in ReportStatus:
        status_counts[st.value] = 0
    for r in all_reports:
        val = r.status.value if hasattr(r.status, "value") else str(r.status)
        status_counts[val] = status_counts.get(val, 0) + 1

    # Severity counts
    severity_counts = {"low": 0, "medium": 0, "high": 0}
    for r in all_reports:
        if r.severity_label:
            sev = r.severity_label.lower()
            severity_counts[sev] = severity_counts.get(sev, 0) + 1

    # Department counts
    dept_counts = {}
    for r in all_reports:
        dept = r.recommended_department or "Unassigned Dept"
        dept_counts[dept] = dept_counts.get(dept, 0) + 1

    # Recent activity
    recent = base_query.order_by(Report.created_at.desc()).limit(10).all()

    # Active cameras count
    active_cameras_count = db.query(Camera).filter(Camera.is_active == True).count()

    summary = {
        "total_reports": len(all_reports),
        "active_cameras": active_cameras_count,
        "pending_review": status_counts.get("pending_officer_review", 0),
        "assigned": status_counts.get("assigned", 0),
        "in_progress": status_counts.get("in_progress", 0),
        "resolved": status_counts.get("resolved", 0),
        "rejected": status_counts.get("rejected", 0),
    }

    if user_role == UserRole.work_team:
        summary["my_pending_tasks"] = status_counts.get("assigned", 0) + status_counts.get("in_progress", 0)
        summary["my_completed_tasks"] = status_counts.get("resolved", 0)

    return StatsDashboardOut(
        role=user_role.value if hasattr(user_role, "value") else str(user_role),
        summary=summary,
        breakdown_by_status=status_counts,
        breakdown_by_severity=severity_counts,
        breakdown_by_department=dept_counts,
        recent_activity=[ReportOut.model_validate(r) for r in recent]
    )
