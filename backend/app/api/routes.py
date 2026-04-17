"""
AI PixelFlow API Routes
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from pathlib import Path
import uuid
import shutil

router = APIRouter()

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


@router.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    file_id = str(uuid.uuid4())
    ext = file.filename.split('.')[-1].lower() if '.' in file.filename else 'png'
    if ext not in ['png', 'jpg', 'jpeg', 'webp']:
        ext = 'png'
    
    save_path = UPLOAD_DIR / f"{file_id}.{ext}"
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return {
        "success": True,
        "data": {
            "url": f"/uploads/{file_id}.{ext}",
            "id": file_id
        }
    }


@router.post("/segment")
async def segment(request: dict):
    from ..services.segmentation_service import SegmentationService
    
    image_id = request.get("image_id")
    x = request.get("x", 0.5)
    y = request.get("y", 0.5)
    
    if not image_id:
        raise HTTPException(status_code=400, detail="Missing image_id")
    
    files = list(UPLOAD_DIR.glob(f"{image_id}.*"))
    if not files:
        raise HTTPException(status_code=404, detail="Image not found")
    
    try:
        results = SegmentationService.segment_image(
            image_path=str(files[0]),
            x=float(x),
            y=float(y)
        )
        return {"success": True, "data": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Segmentation failed: {str(e)}")


@router.post("/edit/text")
async def edit_text(request: dict):
    from ..services.text_redraw_service import TextRedrawService
    
    image_id = request.get("image_id")
    bbox = request.get("bbox")
    new_text = request.get("text", "")
    
    # 接收前端传递的样式参数（OCR识别到的原始样式）
    font_size = request.get("font_size")
    font_color = request.get("font_color")
    font_family = request.get("font_family")  # 自定义字体
    is_bold = request.get("is_bold", False)  # 文字加粗
    has_gradient = request.get("has_gradient", False)
    gradient_colors = request.get("gradient_colors", [])
    has_shadow = request.get("has_shadow", False)
    
    if not image_id or not bbox:
        raise HTTPException(status_code=400, detail="Missing image_id or bbox")
    
    files = list(UPLOAD_DIR.glob(f"{image_id}.*"))
    if not files:
        raise HTTPException(status_code=404, detail="Image not found")
    
    try:
        result = TextRedrawService.redraw_text(
            image_path=str(files[0]),
            bbox=bbox,
            new_text=new_text,
            font_size=font_size,
            font_color=font_color,
            font_family=font_family,
            is_bold=is_bold,
            has_gradient=has_gradient,
            gradient_colors=gradient_colors,
            has_shadow=has_shadow
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Text redraw failed: {str(e)}")


@router.post("/ocr/scan")
async def ocr_scan(request: dict):
    from ..services.ocr_service import OCRService
    
    image_id = request.get("image_id")
    mask_url = request.get("mask_url")
    
    if not image_id:
        raise HTTPException(status_code=400, detail="Missing image_id")
    
    files = list(UPLOAD_DIR.glob(f"{image_id}.*"))
    if not files:
        raise HTTPException(status_code=404, detail="Image not found")
    
    mask_path = None
    if mask_url and mask_url.startswith("/uploads/"):
        mask_path = f".{mask_url}"
        if not Path(mask_path).exists():
            mask_path = None
    
    try:
        result = OCRService.extract_text(
            image_path=str(files[0]),
            mask_path=mask_path
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR scan failed: {str(e)}")


@router.post("/edit/remove")
async def remove_object(request: dict):
    from ..services.remove_service import RemoveService

    image_id = request.get("image_id")
    mask_data = request.get("mask_data")
    mask_url = request.get("mask_url")
    bbox = request.get("bbox")
    brush_size = request.get("brush_size")

    if not image_id:
        raise HTTPException(status_code=400, detail="Missing image_id")

    if not mask_data and not mask_url and not bbox:
        raise HTTPException(status_code=400, detail="Missing mask_data, mask_url or bbox")

    files = list(UPLOAD_DIR.glob(f"{image_id}.*"))
    if not files:
        raise HTTPException(status_code=404, detail="Image not found")

    try:
        result = RemoveService.remove_object(
            image_path=str(files[0]),
            mask_data=mask_data,
            mask_url=mask_url,
            bbox=bbox,
            brush_size=brush_size
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Object removal failed: {str(e)}")
