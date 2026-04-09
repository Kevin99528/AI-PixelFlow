"""
SAM2 Service - SAM2模型分割服务
"""

from pathlib import Path
import uuid


class SAM2Service:
    _model = None

    @staticmethod
    def _get_model():
        if SAM2Service._model is not None:
            return SAM2Service._model
        
        try:
            from segment_anything import sam_model_registry, SamAutomaticMaskGenerator
            
            checkpoint = Path("models/sam2_hiera_large.pt")
            if not checkpoint.exists():
                checkpoint = Path("models/sam2_hiera_base_plus.pt")
            if not checkpoint.exists():
                raise FileNotFoundError("SAM2 model not found")
            
            model_type = "sam2_hiera_large" if "large" in checkpoint.name else "sam2_hiera_base_plus"
            
            SAM2Service._model = sam_model_registry[model_type](checkpoint=checkpoint)
            
            mask_generator = SamAutomaticMaskGenerator(
                SAM2Service._model,
                points_per_side=32,
                pred_iou_thresh=0.88,
                stability_score_thresh=0.95,
                min_mask_region_area=100
            )
            
            print(f"SAM2 model loaded: {model_type}")
            return mask_generator
            
        except ImportError:
            raise ImportError("segment_anything not installed")
        except Exception as e:
            raise RuntimeError(f"SAM2 load error: {e}")

    @staticmethod
    def segment(image_path: str, x: float, y: float) -> list:
        import cv2
        import numpy as np
        
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Cannot read image: {image_path}")
        
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        generator = SAM2Service._get_model()
        
        masks_data = generator.generate(image_rgb)
        
        h, w = image.shape[:2]
        cx = int(x * w)
        cy = int(y * h)
        
        results = []
        
        for i, mask_info in enumerate(masks_data[:10]):
            mask_arr = mask_info["segmentation"]
            score = mask_info.get("stability_score", 0)
            area = mask_info.get("area", 0)
            
            if score < 0.85 or area < 100:
                continue
            
            if not mask_arr[cy, cx]:
                continue
            
            mask_img = (mask_arr * 255).astype(np.uint8)
            
            mask_id = f"mask_{uuid.uuid4().hex[:8]}"
            temp_dir = Path("temp")
            temp_dir.mkdir(exist_ok=True)
            mask_path = temp_dir / f"{mask_id}.png"
            
            cv2.imwrite(str(mask_path), mask_img)
            
            ys, xs = np.where(mask_arr)
            if len(xs) > 0 and len(ys) > 0:
                bbox = [
                    round(int(xs.min()) / w, 4),
                    round(int(ys.min()) / h, 4),
                    round(int(xs.max()) / w, 4),
                    round(int(ys.max()) / h, 4)
                ]
            else:
                bbox = [0, 0, 1.0, 1.0]
            
            results.append({
                "mask_id": mask_id,
                "mask_url": f"/temp/{mask_id}.png",
                "bbox": bbox,
                "score": round(float(score), 4),
                "label": f"object_{i+1}"
            })
        
        return results
