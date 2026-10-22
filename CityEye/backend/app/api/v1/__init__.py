from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.cameras import router as cameras_router
from app.api.v1.detections import router as detections_router
from app.api.v1.reports import router as reports_router
from app.api.v1.stats import router as stats_router
from app.api.v1.files import router as files_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
api_router.include_router(cameras_router, prefix="/cameras", tags=["Cameras"])
api_router.include_router(detections_router, prefix="/detections", tags=["Detections"])
api_router.include_router(reports_router, prefix="/reports", tags=["Reports"])
api_router.include_router(stats_router, prefix="/stats", tags=["Stats"])
api_router.include_router(files_router, prefix="/files", tags=["Files"])
