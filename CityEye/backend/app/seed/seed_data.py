import os
from datetime import datetime, timezone, timedelta
from PIL import Image, ImageDraw, ImageFont
from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.core.config import settings
from app.models.models import (
    User,
    UserRole,
    Camera,
    Detection,
    DetectionStatus,
    Report,
    ReportStatus,
    GenerationSource,
)

def create_sample_evidence_image(filename: str, title: str, defect: str):
    filepath = settings.EVIDENCE_DIR / filename
    if filepath.exists():
        return
    img = Image.new("RGB", (640, 480), color=(50, 52, 58))
    draw = ImageDraw.Draw(img)
    # Draw asphalt road and divider line
    draw.line([(320, 0), (320, 480)], fill=(200, 200, 200), width=4)
    # Draw defect bounding box
    if defect == "pothole":
        draw.ellipse([(200, 260), (340, 340)], fill=(25, 25, 28), outline=(90, 85, 80), width=3)
        draw.rectangle([(180, 240), (360, 360)], outline=(255, 60, 60), width=3)
        draw.text((185, 220), f"CONFIRMED POTHOLE (94%)", fill=(255, 60, 60))
    elif defect == "garbage":
        draw.rectangle([(220, 280), (380, 390)], fill=(80, 75, 60), outline=(220, 180, 40), width=3)
        draw.text((225, 260), f"GARBAGE DUMP ACCUMULATION (91%)", fill=(255, 200, 0))
    elif defect == "waterlogging":
        draw.rectangle([(150, 270), (450, 400)], fill=(40, 70, 95), outline=(0, 190, 255), width=3)
        draw.text((155, 250), f"WATERLOGGING / FLOODING (96%)", fill=(0, 220, 255))
    draw.text((20, 20), f"CITYEYE AI CCTV - {title}", fill=(255, 255, 255))
    img.save(filepath, "JPEG")

def create_sample_resolution_image(filename: str, title: str):
    filepath = settings.RESOLUTIONS_DIR / filename
    if filepath.exists():
        return
    img = Image.new("RGB", (640, 480), color=(40, 75, 45))
    draw = ImageDraw.Draw(img)
    draw.line([(320, 0), (320, 480)], fill=(220, 220, 220), width=4)
    draw.rectangle([(180, 240), (360, 360)], fill=(55, 55, 60), outline=(0, 255, 120), width=4)
    draw.text((185, 215), f"REPAIRED & COMPACTED (100%)", fill=(0, 255, 120))
    draw.text((20, 20), f"WORK TEAM RESOLUTION PROOF - {title}", fill=(255, 255, 255))
    img.save(filepath, "JPEG")

def seed_database_if_empty():
    from app.core.database import Base, engine
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        user_count = db.query(User).count()
        if user_count > 0:
            return

        print("[*] Seeding CityEye initial database with municipal users, cameras, and sample reports...")

        # 1. Seed Users
        officer = User(
            id="usr-officer-01",
            name="Vikram Deshmukh",
            email="officer@cityeye.gov",
            password_hash=get_password_hash("Officer@123"),
            role=UserRole.officer,
            team_name="Municipal Infrastructure Oversight",
            is_active=True,
        )
        crew1 = User(
            id="usr-crew-01",
            name="Ramesh Patil",
            email="crew1@cityeye.gov",
            password_hash=get_password_hash("Crew@123"),
            role=UserRole.work_team,
            team_name="Road Maintenance Crew 2",
            is_active=True,
        )
        crew2 = User(
            id="usr-crew-02",
            name="Sunil Shinde",
            email="crew2@cityeye.gov",
            password_hash=get_password_hash("Crew@123"),
            role=UserRole.work_team,
            team_name="Sanitation Squad 4",
            is_active=True,
        )
        senior = User(
            id="usr-senior-01",
            name="Dr. Ananya Mehta",
            email="senior@cityeye.gov",
            password_hash=get_password_hash("Senior@123"),
            role=UserRole.senior_officer,
            team_name="Municipal Commissionerate",
            is_active=True,
        )
        db.add_all([officer, crew1, crew2, senior])
        db.commit()

        # 2. Seed Cameras
        cameras = [
            Camera(
                id="cam-001",
                name="SV Road Junction Camera",
                latitude=19.0596,
                longitude=72.8295,
                address="SV Road, Bandra West, Mumbai",
                is_active=True,
            ),
            Camera(
                id="cam-002",
                name="Linking Road Shoppers Stop",
                latitude=19.0645,
                longitude=72.8354,
                address="Linking Road, Khar West, Mumbai",
                is_active=True,
            ),
            Camera(
                id="cam-003",
                name="Western Express Highway Kalanagar",
                latitude=19.0558,
                longitude=72.8512,
                address="WEH Flyover Northbound, Bandra East, Mumbai",
                is_active=True,
            ),
            Camera(
                id="cam-004",
                name="Dadar TT Circle Junction",
                latitude=19.0178,
                longitude=72.8478,
                address="Dadar TT Circle, Dadar East, Mumbai",
                is_active=True,
            ),
            Camera(
                id="cam-005",
                name="Andheri Subway Underpass",
                latitude=19.1197,
                longitude=72.8464,
                address="Andheri East Subway, Mumbai",
                is_active=True,
            ),
        ]
        db.add_all(cameras)
        db.commit()

        # 3. Create Sample Evidence Images
        create_sample_evidence_image("rpt-ai-001.jpg", "SV Road Junction", "pothole")
        create_sample_evidence_image("rpt-ai-002.jpg", "Linking Road Khar", "garbage")
        create_sample_evidence_image("rpt-ai-003.jpg", "Andheri Subway", "waterlogging")
        create_sample_evidence_image("rpt-ai-004.jpg", "Dadar TT Circle", "pothole")
        create_sample_resolution_image("res-004.jpg", "Dadar TT Circle Fixed")

        # 4. Seed Reports in Various Workflow States
        now = datetime.now(timezone.utc)
        
        # Report 1: Pending Officer Review (Needs officer action)
        rep1 = Report(
            id="rpt-ai-001",
            camera_id="cam-001",
            title="Pothole Reported at SV Road Junction Camera",
            description="A severe pothole defect was confirmed over 7 consecutive frames. Surface area ratio: 0.12. Severity: HIGH. Detected at SV Road, Bandra West.",
            citizen_summary="Automated AI detection of pothole with HIGH severity (CLAHE enhanced).",
            recommended_department="Road Maintenance Department",
            generation_source=GenerationSource.template_fallback,
            status=ReportStatus.pending_officer_review,
            problem_type="pothole",
            severity_label="high",
            severity_score=0.78,
            confidence=0.94,
            confirmed_frame_count=7,
            evidence_image_path="/uploads/evidence/rpt-ai-001.jpg",
            created_at=now - timedelta(hours=2),
        )

        # Report 2: Approved and Assigned to Work Team (Crew 2)
        rep2 = Report(
            id="rpt-ai-002",
            camera_id="cam-002",
            title="Garbage Dump Reported at Linking Road Shoppers Stop",
            description="Illegal waste accumulation detected near commercial sidewalk. Severity: MEDIUM. Detected at Linking Road, Khar West.",
            citizen_summary="Automated AI detection of illegal garbage dump with MEDIUM severity.",
            recommended_department="Sanitation Department",
            generation_source=GenerationSource.template_fallback,
            status=ReportStatus.assigned,
            problem_type="garbage",
            severity_label="medium",
            severity_score=0.54,
            confidence=0.91,
            confirmed_frame_count=6,
            evidence_image_path="/uploads/evidence/rpt-ai-002.jpg",
            reviewed_by=officer.id,
            reviewed_at=now - timedelta(hours=3),
            assigned_team=crew2.id,
            assigned_at=now - timedelta(hours=2, minutes=30),
            created_at=now - timedelta(hours=5),
        )

        # Report 3: In Progress (Assigned to Crew 1 - Ramesh Patil)
        rep3 = Report(
            id="rpt-ai-003",
            camera_id="cam-005",
            title="Waterlogging Reported at Andheri Subway Underpass",
            description="Subway underpass drain obstruction causing water ponding across 2 traffic lanes. Severity: HIGH.",
            citizen_summary="Automated AI detection of waterlogging with HIGH severity.",
            recommended_department="Drainage & Public Works Department",
            generation_source=GenerationSource.template_fallback,
            status=ReportStatus.in_progress,
            problem_type="waterlogging",
            severity_label="high",
            severity_score=0.88,
            confidence=0.96,
            confirmed_frame_count=12,
            evidence_image_path="/uploads/evidence/rpt-ai-003.jpg",
            reviewed_by=officer.id,
            reviewed_at=now - timedelta(hours=6),
            assigned_team=crew1.id,
            assigned_at=now - timedelta(hours=5),
            in_progress_at=now - timedelta(hours=1),
            created_at=now - timedelta(hours=8),
        )

        # Report 4: Resolved (Completed by Crew 1 with Resolution Photo & Notes)
        rep4 = Report(
            id="rpt-ai-004",
            camera_id="cam-004",
            title="Pothole Reported at Dadar TT Circle Junction",
            description="Crater in middle lane of Dadar TT Circle confirmed by temporal verifier.",
            citizen_summary="Automated AI detection of pothole with MEDIUM severity.",
            recommended_department="Road Maintenance Department",
            generation_source=GenerationSource.template_fallback,
            status=ReportStatus.resolved,
            problem_type="pothole",
            severity_label="medium",
            severity_score=0.49,
            confidence=0.89,
            confirmed_frame_count=6,
            evidence_image_path="/uploads/evidence/rpt-ai-004.jpg",
            reviewed_by=officer.id,
            reviewed_at=now - timedelta(days=1, hours=4),
            assigned_team=crew1.id,
            assigned_at=now - timedelta(days=1, hours=3),
            in_progress_at=now - timedelta(days=1, hours=1),
            resolution_photo_path="/uploads/resolutions/res-004.jpg",
            resolution_notes="Cold-mix asphalt patch applied and roller compacted. Traffic flow fully restored.",
            resolved_by=crew1.id,
            resolved_at=now - timedelta(hours=14),
            created_at=now - timedelta(days=1, hours=6),
        )

        db.add_all([rep1, rep2, rep3, rep4])
        db.commit()

        print("[OK] CityEye seed data successfully populated!")
    except Exception as e:
        db.rollback()
        print(f"[!] Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database_if_empty()
