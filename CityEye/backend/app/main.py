from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base
from app.api.v1 import api_router
from app.seed.seed_data import seed_database_if_empty

# Create DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="2.0.0",
    description="CityEye Municipal AI Computer Vision & Defect Detection API"
)

# CORS configuration for Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API v1 Router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.on_event("startup")
def on_startup():
    # Auto-seed sample users and cameras if clean database
    seed_database_if_empty()

@app.get("/")
def root():
    return {
        "system": "CityEye Municipal AI Infrastructure Monitoring",
        "version": "2.0.0",
        "status": "operational",
        "docs_url": "/docs",
        "api_v1": settings.API_V1_STR
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}
