import os
import uuid
import shutil
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.security import decode_access_token
from app.core.database import get_db
from app.models.models import User
from app.api.deps import get_current_user

router = APIRouter()

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

def get_user_from_header_or_query(
    token_query: Optional[str] = Query(None, alias="token"),
    auth_header_user: Optional[User] = Depends(lambda: None),
    db: Session = Depends(get_db)
) -> User:
    # First check query param token (convenient for browser <img src="..."/>)
    if token_query:
        payload = decode_access_token(token_query)
        if payload and "sub" in payload:
            user = db.query(User).filter(User.id == payload["sub"]).first()
            if user and user.is_active:
                return user
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required to view evidence photos"
    )

@router.post("/upload-resolution")
async def upload_resolution_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Secure upload endpoint for work teams submitting resolution photos.
    Validates file extension and size.
    """
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file format: '{ext}'. Allowed: {list(ALLOWED_EXTENSIONS)}"
        )

    unique_filename = f"res-{uuid.uuid4().hex[:12]}{ext}"
    dest_path = settings.RESOLUTIONS_DIR / unique_filename

    # Save and validate size
    size = 0
    with open(dest_path, "wb") as buffer:
        while chunk := await file.read(1024 * 64):
            size += len(chunk)
            if size > MAX_FILE_SIZE_BYTES:
                buffer.close()
                if dest_path.exists():
                    dest_path.unlink()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File exceeds maximum size of 10MB."
                )
            buffer.write(chunk)

    return {
        "filename": unique_filename,
        "filepath": f"/uploads/resolutions/{unique_filename}",
        "size_bytes": size
    }

@router.get("/view/{category}/{filename}")
def serve_protected_file(
    category: str,
    filename: str,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Authenticated file serving endpoint protecting sensitive civic evidence.
    Supports either Authorization header or ?token= query parameter for <img> tags.
    """
    # Verify token
    if not token:
        raise HTTPException(status_code=401, detail="Authentication token required.")
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    safe_filename = os.path.basename(filename)
    if category == "evidence":
        file_path = settings.EVIDENCE_DIR / safe_filename
    elif category == "resolutions":
        file_path = settings.RESOLUTIONS_DIR / safe_filename
    else:
        raise HTTPException(status_code=400, detail="Invalid category.")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Requested image does not exist.")

    return FileResponse(file_path)
