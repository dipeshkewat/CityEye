import os
from pathlib import Path
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "CityEye Municipal AI Infrastructure Monitoring"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "cityeye_dev_jwt_secret_key_secure_2026_mumbai_civic")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8 hours matching work shift per Security Spec
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    
    # Uploads Storage
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    UPLOADS_DIR: Path = BASE_DIR.parent / "uploads"
    EVIDENCE_DIR: Path = BASE_DIR.parent / "uploads" / "evidence"
    RESOLUTIONS_DIR: Path = BASE_DIR.parent / "uploads" / "resolutions"
    
    class Config:
        case_sensitive = True

settings = Settings()
if not settings.DATABASE_URL:
    db_file = (settings.BASE_DIR / "cityeye.db").as_posix()
    settings.DATABASE_URL = f"sqlite:///{db_file}"

# Ensure directories exist
settings.EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
settings.RESOLUTIONS_DIR.mkdir(parents=True, exist_ok=True)
