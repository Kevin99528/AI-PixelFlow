import os
import cv2
import numpy as np
from PIL import Image
from pathlib import Path
import base64
import io


class RemoveService:
    OUTPUT_DIR = Path("outputs")
    OUTPUT_DIR.mkdir(exist_ok=True)

    @staticmethod
    def remove_object(image_path: str, mask_data: str = None, mask_url: str = None,
                      bbox: list = None, brush_size: int = None) -> dict:
        try:
            image_path = Path(image_path)
            if not image_path.exists():
                return {"success": False, "error": f"Image not found: {image_path}"}

            image = cv2.imread(str(image_path))
            if image is None:
                return {"success": False, "error": f"Cannot read image: {image_path}"}

            h, w = image.shape[:2]

            mask = RemoveService._build_mask(mask_data, mask_url, bbox, w, h)

            if mask is None or mask.sum() == 0:
                return {"success": False, "error": "Invalid or empty mask provided"}

            mask = RemoveService._refine_mask(mask)

            result = RemoveService._inpaint_image(image, mask)

            output_id = f"remove_{_uuid_hex()}"
            output_path = RemoveService.OUTPUT_DIR / f"{output_id}.png"
            cv2.imwrite(str(output_path), result, [cv2.IMWRITE_PNG_COMPRESSION, 3])

            return {
                "success": True,
                "output_path": str(output_path),
                "output_url": f"/outputs/{output_id}.png",
                "mask_coverage": round(float(mask.sum() / (h * w)) * 100, 2)
            }

        except Exception as e:
            import traceback
            print(f"Remove error: {e}")
            traceback.print_exc()
            return {"success": False, "error": str(e)}

    @staticmethod
    def _build_mask(mask_data: str, mask_url: str, bbox: list, w: int, h: int):
        if mask_data:
            return RemoveService._decode_base64_mask(mask_data, w, h)

        if mask_url:
            return RemoveService._load_mask_from_url(mask_url, w, h)

        if bbox and len(bbox) >= 4:
            return RemoveService._build_bbox_mask(bbox, w, h)

        return None

    @staticmethod
    def _decode_base64_mask(mask_data: str, w: int, h: int) -> np.ndarray:
        try:
            if ',' in mask_data:
                mask_data = mask_data.split(',')[1]

            mask_bytes = base64.b64decode(mask_data)
            mask_img = Image.open(io.BytesIO(mask_bytes)).convert('L')

            mask_arr = np.array(mask_img)

            if mask_arr.shape[:2] != (h, w):
                mask_img_resized = mask_img.resize((w, h), Image.LANCZOS)
                mask_arr = np.array(mask_img_resized.convert('L'))

            binary_mask = (mask_arr > 128).astype(np.uint8) * 255

            return binary_mask

        except Exception as e:
            print(f"Base64 mask decode error: {e}")
            return None

    @staticmethod
    def _load_mask_from_url(mask_url: str, w: int, h: int) -> np.ndarray:
        try:
            if mask_url.startswith("/"):
                local_path = f".{mask_url}"
            else:
                local_path = mask_url

            if not Path(local_path).exists():
                print(f"Mask file not found: {local_path}")
                return None

            mask_img = Image.open(local_path).convert('L')
            mask_arr = np.array(mask_img)

            if mask_arr.shape[:2] != (h, w):
                mask_img_resized = mask_img.resize((w, h), Image.LANCZOS)
                mask_arr = np.array(mask_img_resized.convert('L'))

            binary_mask = (mask_arr > 128).astype(np.uint8) * 255

            return binary_mask

        except Exception as e:
            print(f"Mask URL load error: {e}")
            return None

    @staticmethod
    def _build_bbox_mask(bbox: list, w: int, h: int) -> np.ndarray:
        x1 = int(bbox[0] * w)
        y1 = int(bbox[1] * h)
        x2 = int(bbox[2] * w)
        y2 = int(bbox[3] * h)

        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)

        mask = np.zeros((h, w), dtype=np.uint8)
        mask[y1:y2, x1:x2] = 255

        return mask

    @staticmethod
    def _refine_mask(mask: np.ndarray) -> np.ndarray:
        kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel_close, iterations=2)

        kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel_open, iterations=1)

        if mask.max() > 0:
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if contours:
                all_points = np.vstack(contours)
                x, y, cw, ch = cv2.boundingRect(all_points)
                pad = max(3, min(cw, ch) // 20)
                x1_pad = max(0, x - pad)
                y1_pad = max(0, y - pad)
                x2_pad = min(mask.shape[1], x + cw + pad)
                y2_pad = min(mask.shape[0], y + ch + pad)

                edge_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
                edge_region = mask[y1_pad:y2_pad, x1_pad:x2_pad].copy()
                edge_dilated = cv2.dilate(edge_region, edge_kernel, iterations=1)
                mask[y1_pad:y2_pad, x1_pad:x2_pad] = cv2.bitwise_or(
                    mask[y1_pad:y2_pad, x1_pad:x2_pad],
                    cv2.bitwise_and(edge_dilated, cv2.bitwise_not(edge_region))
                )

        return mask

    @staticmethod
    def _inpaint_image(image: np.ndarray, mask: np.ndarray) -> np.ndarray:
        dilate_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        expanded_mask = cv2.dilate(mask, dilate_kernel, iterations=2)

        inpaint_radius = max(5, min(image.shape[0], image.shape[1]) // 100)

        result = cv2.inpaint(
            image,
            expanded_mask,
            inpaintRadius=inpaint_radius,
            flags=cv2.INPAINT_NS
        )

        result = RemoveService._apply_tone_matching(image, result, mask, expanded_mask)

        feather_radius = max(3, inpaint_radius // 2)
        blurred = cv2.GaussianBlur(result, (feather_radius * 2 + 1, feather_radius * 2 + 1), 0)

        alpha_mask = cv2.GaussianBlur(
            expanded_mask.astype(np.float32),
            (feather_radius * 6 + 1, feather_radius * 6 + 1),
            0
        )
        alpha_mask = alpha_mask / 255.0
        alpha_mask = np.clip(alpha_mask, 0, 1)

        blended = (
            result.astype(np.float32) * (1 - alpha_mask[..., np.newaxis]) +
            blurred.astype(np.float32) * alpha_mask[..., np.newaxis]
        ).astype(np.uint8)

        original_mask_area = (mask > 0)
        result[original_mask_area] = blended[original_mask_area]

        return result

    @staticmethod
    def _apply_tone_matching(original_image: np.ndarray, inpainted_image: np.ndarray,
                              mask: np.ndarray, expanded_mask: np.ndarray) -> np.ndarray:
        h, w = mask.shape

        border_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
        border_dilated = cv2.dilate(mask, border_kernel, iterations=3)
        border_ring = cv2.bitwise_and(border_dilated, cv2.bitwise_not(expanded_mask))

        if border_ring.sum() == 0:
            return inpainted_image

        border_coords = np.where(border_ring > 0)
        border_pixels = original_image[border_coords[0], border_coords[1]]

        mask_coords = np.where(expanded_mask > 0)
        fill_pixels = inpainted_image[mask_coords[0], mask_coords[1]]

        if len(fill_pixels) < 10 or len(border_pixels) < 10:
            return inpainted_image

        if border_pixels.ndim == 1:
            border_pixels = border_pixels.reshape(-1, 1)
        if border_pixels.shape[-1] != 3:
            border_pixels = np.repeat(border_pixels, 3, axis=-1) if border_pixels.ndim >= 2 else np.tile(border_pixels.reshape(-1, 1), (1, 3))
        if fill_pixels.ndim == 1:
            fill_pixels = fill_pixels.reshape(-1, 1)
        if fill_pixels.shape[-1] != 3:
            fill_pixels = np.repeat(fill_pixels, 3, axis=-1) if fill_pixels.ndim >= 2 else np.tile(fill_pixels.reshape(-1, 1), (1, 3))

        max_samples = 50000
        if len(border_pixels) > max_samples:
            indices = np.random.choice(len(border_pixels), max_samples, replace=False)
            border_pixels = border_pixels[indices]

        try:
            border_lab = cv2.cvtColor(border_pixels.astype(np.uint8).reshape(-1, 1, 3), cv2.COLOR_BGR2LAB).reshape(-1, 3)
            fill_lab = cv2.cvtColor(fill_pixels.astype(np.uint8).reshape(-1, 1, 3), cv2.COLOR_BGR2LAB).reshape(-1, 3)

            for ch in range(3):
                border_ch = border_lab[:, ch].astype(np.float64)
                fill_ch = fill_lab[:, ch].astype(np.float64)

                border_mean, border_std = border_ch.mean(), border_ch.std()
                fill_mean, fill_std = fill_ch.mean(), fill_ch.std()

                if border_std > 1e-6 and fill_std > 1e-6:
                    scale = border_std / fill_std
                    adjusted = (fill_ch - fill_mean) * scale + border_mean
                    fill_lab[:, ch] = np.clip(adjusted, 0, 255).astype(np.uint8)
                else:
                    fill_lab[:, ch] = np.clip(border_mean, 0, 255).astype(np.uint8)

            matched_bgr = cv2.cvtColor(fill_lab.reshape(-1, 1, 3), cv2.COLOR_LAB2BGR).reshape(-1, 3)
            result = inpainted_image.copy()
            result[mask_coords[0], mask_coords[1]] = matched_bgr

            hsv_border = cv2.cvtColor(border_pixels.astype(np.uint8).reshape(-1, 1, 3), cv2.COLOR_BGR2HSV).reshape(-1, 3)
            hsv_fill = cv2.cvtColor(matched_bgr.reshape(-1, 1, 3), cv2.COLOR_BGR2HSV).reshape(-1, 3)

            mean_hue_shift = np.median(hsv_border[:, 0].astype(float)) - np.median(hsv_fill[:, 0].astype(float))
            if mean_hue_shift > 90:
                mean_hue_shift -= 180
            elif mean_hue_shift < -90:
                mean_hue_shift += 180

            sat_ratio = np.clip(
                np.median(hsv_border[:, 1].astype(float)) / max(np.median(hsv_fill[:, 1].astype(float)), 1.0),
                0.7, 1.4
            )
            val_offset = np.clip(
                np.median(hsv_border[:, 2].astype(float)) - np.median(hsv_fill[:, 2].astype(float)),
                -30, 30
            )

            hsv_result = cv2.cvtColor(result[mask_coords[0], mask_coords[1]], cv2.COLOR_BGR2HSV).astype(np.float64)
            hsv_result[:, 0] = (hsv_result[:, 0] + mean_hue_shift) % 180
            hsv_result[:, 1] = hsv_result[:, 1] * sat_ratio
            hsv_result[:, 2] = hsv_result[:, 2] + val_offset
            hsv_result = np.clip(hsv_result, 0, 255).astype(np.uint8)

            refined_region = cv2.cvtColor(hsv_result, cv2.COLOR_HSV2BGR)
            result[mask_coords[0], mask_coords[1]] = refined_region

            edge_blend_width = max(8, min(h, w) // 60)
            edge_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (edge_blend_width, edge_blend_width))
            inner_edge = cv2.dilate(mask, edge_kernel, iterations=1)
            edge_zone = cv2.bitwise_and(inner_edge, cv2.bitwise_not(mask))

            if edge_zone.sum() > 0:
                edge_coords = np.where(edge_zone > 0)
                dist_to_center = np.sqrt(
                    ((np.array(edge_coords[1]).astype(float) - w / 2) / w) ** 2 +
                    ((np.array(edge_coords[0]).astype(float) - h / 2) / h) ** 2
                )
                dist_norm = dist_to_center / (dist_to_center.max() + 1e-6)

                edge_orig = original_image[edge_coords[0], edge_coords[1]].astype(np.float32)
                edge_new = result[edge_coords[0], edge_coords[1]].astype(np.float32)
                blend_alpha = dist_norm[..., np.newaxis]

                blended_edge = (edge_orig * blend_alpha + edge_new * (1 - blend_alpha)).astype(np.uint8)
                result[edge_coords[0], edge_coords[1]] = blended_edge

            return result
        except Exception as e:
            print(f"Tone matching skipped due to error: {e}")
            return inpainted_image


def _uuid_hex():
    import uuid
    return str(uuid.uuid4()).replace('-', '')
