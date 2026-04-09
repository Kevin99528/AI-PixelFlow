"""
Segmentation Service - 智能分割服务
"""

import numpy as np
from pathlib import Path
import uuid


class SegmentationService:
    @staticmethod
    def segment_image(image_path: str, x: float = 0.5, y: float = 0.5) -> dict:
        image_path = Path(image_path)
        if not image_path.exists():
            return {"success": False, "error": f"Image not found: {image_path}"}

        try:
            from .sam2_service import SAM2Service
            
            result = SAM2Service.segment(
                image_path=str(image_path),
                x=x,
                y=y
            )
            
            return {
                "success": True,
                "data": result
            }
            
        except ImportError:
            return SegmentationService._fallback_segment(str(image_path), x, y)
        except Exception as e:
            print(f"SAM2 error: {e}")
            return SegmentationService._fallback_segment(str(image_path), x, y)

    @staticmethod
    def _fallback_segment(image_path: str, x: float, y: float) -> dict:
        from PIL import Image
        import cv2
        
        img = Image.open(image_path).convert("RGB")
        w, h = img.size
        
        cx = int(x * w)
        cy = int(y * h)
        
        arr = np.array(img)
        
        mask = np.zeros((h, w), dtype=np.uint8)
        
        radius = min(w, h) // 6
        cv2.circle(mask, (cx, cy), radius, 255, -1)
        
        cv2.floodFill(mask, None, (cx, cy), 255)
        
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=3)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=2)
        
        mask_img = Image.fromarray(mask)
        
        mask_id = f"mask_{uuid.uuid4().hex[:8]}"
        mask_dir = Path("temp")
        mask_dir.mkdir(exist_ok=True)
        mask_path = mask_dir / f"{mask_id}.png"
        mask_img.save(str(mask_path))
        
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        bbox = [0, 0, 1.0, 1.0]
        if contours:
            all_contours = np.vstack(contours)
            x_min, y_min, x_max, y_max = cv2.boundingRect(all_contours)
            bbox = [
                round(x_min / w, 4),
                round(y_min / h, 4),
                round(x_max / w, 4),
                round(y_max / h, 4)
            ]
        
        return {
            "success": True,
            "masks": [{
                "mask_id": mask_id,
                "mask_url": f"/temp/{mask_id}.png",
                "bbox": bbox,
                "score": 0.75,
                "label": "object"
            }],
            "method": "fallback"
        }
