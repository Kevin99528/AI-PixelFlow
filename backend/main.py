"""
AI PixelFlow - Backend API
FastAPI based backend for local image editing system
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import os
import uvicorn
from pathlib import Path

from app.api.routes import router as api_router

# Create FastAPI app
app = FastAPI(
    title="AI PixelFlow API",
    description="本地智能图像编辑系统后端API",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure upload directory exists
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Ensure temp directory exists
TEMP_DIR = Path("temp")
TEMP_DIR.mkdir(exist_ok=True)

# Ensure outputs directory exists
OUTPUTS_DIR = Path("outputs")
OUTPUTS_DIR.mkdir(exist_ok=True)

# Mount static files for uploads and temp
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/temp", StaticFiles(directory="temp"), name="temp")
app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")

# Include API routes
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "AI PixelFlow API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "ai-pixelflow-backend"
    }


if __name__ == "__main__":
    try:
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=8000,
            reload=True,
            log_level="info"
        )
    except Exception as e:
        print(f"\n{'='*50}")
        print(f"启动失败: {e}")
        print(f"{'='*50}")
        import traceback
        traceback.print_exc()
        print("\n按回车键退出...")
        try:
            input()
        except:
            pass
