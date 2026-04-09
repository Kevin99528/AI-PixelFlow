"""
OCR Service - 文字识别服务
"""

import os
import cv2
import numpy as np
from PIL import Image
from pathlib import Path
import threading


class OCRService:
    _reader = None
    _loading_lock = threading.Lock()
    _load_failed = False

    @staticmethod
    def _get_reader():
        if OCRService._reader is not None:
            return OCRService._reader
        
        if OCRService._load_failed:
            return None
        
        with OCRService._loading_lock:
            if OCRService._reader is not None:
                return OCRService._reader
            
            try:
                import easyocr
                
                def load_with_timeout():
                    nonlocal reader_result, load_error
                    try:
                        reader_result = easyocr.Reader(
                            ['ch_sim', 'en'], 
                            gpu=False, 
                            verbose=False,
                            download_enabled=True
                        )
                    except Exception as e:
                        load_error = e
                
                reader_result = None
                load_error = None
                thread = threading.Thread(target=load_with_timeout)
                thread.start()
                thread.join(timeout=30)
                
                if thread.is_alive():
                    OCRService._load_failed = True
                    print("Warning: EasyOCR loading timeout (30s), using fallback")
                    return None
                
                if load_error:
                    raise load_error
                
                OCRService._reader = reader_result
                print("EasyOCR loaded successfully")
                return OCRService._reader
                
            except ImportError:
                print("Warning: EasyOCR not installed, using fallback detection")
                OCRService._load_failed = True
                return None
            except Exception as e:
                print(f"Warning: EasyOCR error: {e}, using fallback detection")
                OCRService._load_failed = True
                return None

    @staticmethod
    def extract_text(image_path: str, mask_path: str = None) -> dict:
        image_path = Path(image_path)
        if not image_path.exists():
            return {"success": False, "error": f"Image not found: {image_path}"}

        image = Image.open(image_path).convert("RGB")
        arr = np.array(image)

        mask = None
        if mask_path and Path(mask_path).exists():
            mask_img = Image.open(mask_path).convert('L')
            mask = np.array(mask_img)
            if mask.max() > 0:
                mask = (mask > 128).astype(np.uint8) * 255

        all_regions = []
        
        reader = OCRService._get_reader()

        if reader is not None:
            try:
                easyocr_regions = OCRService._extract_with_easyocr_multi_scale(reader, arr, mask)
                all_regions.extend(easyocr_regions)
                print(f"EasyOCR found {len(easyocr_regions)} regions")
            except Exception as e:
                print(f"EasyOCR extraction failed: {e}")
        
        # 只有当EasyOCR没有识别到足够区域时，才使用fallback
        if len(all_regions) < 3:
            fallback_regions = OCRService._enhanced_fallback_detect(arr, mask)
            all_regions.extend(fallback_regions)
            print(f"Fallback found {len(fallback_regions)} regions")

        all_regions = OCRService._merge_duplicate_regions(all_regions)
        
        all_regions = OCRService._filter_valid_regions(all_regions, arr.shape[:2])
        
        print(f"After filtering: {len(all_regions)} valid regions (from {len(OCRService._merge_duplicate_regions(all_regions, [])) if False else len(all_regions) + 0} total)")
        
        all_regions.sort(key=lambda r: (r["bbox"][1], r["bbox"][0]))

        return {
            "success": True,
            "regions": all_regions,
            "count": len(all_regions),
            "method": "hybrid"
        }

    @staticmethod
    def _filter_valid_regions(regions: list, image_shape: tuple) -> list:
        h, w = image_shape
        valid_regions = []
        
        for region in regions:
            text = region.get("text", "").strip()
            bbox = region.get("bbox", [0, 0, 0, 0])
            
            region_w = (bbox[2] - bbox[0]) * w
            region_h = (bbox[3] - bbox[1]) * h
            area = region_w * region_h
            
            # 判断是否有实际文字内容（支持中文、英文、数字等）
            has_text = len(text) >= 1
            
            is_large_enough = area > (w * h * 0.001)  # 降低阈值
            
            confidence = region.get("confidence", 0)
            
            if has_text:
                # 保留原始识别的文字
                valid_regions.append(region)
                print(f"✓ Valid: '{text}' ({region_w:.0f}x{region_h:.0f}, conf={confidence:.2f})")
            elif is_large_enough and confidence > 0.3:
                # 只有大区域且置信度高但没有文字时，才标记为区域编号
                region["text"] = f"区域{len(valid_regions)+1}"
                valid_regions.append(region)
                print(f"? Large no-text: {region_w:.0f}x{region_h:.0f}")
        
        return valid_regions

    @staticmethod
    def _extract_with_easyocr_multi_scale(reader, arr: np.ndarray, mask: np.ndarray = None) -> list:
        h, w = arr.shape[:2]
        all_results = []
        
        # 多尺度检测：包含放大比例以识别大字体
        scales = [1.0, 0.6, 0.8, 1.2, 1.5]
        
        for scale in scales:
            if scale == 1.0:
                scaled_arr = arr
                scale_factor = 1
            elif scale > 1.0:
                # 放大：使用高质量插值
                new_w = min(int(w * scale), 2048)  # 限制最大尺寸
                new_h = min(int(h * scale), 2048)
                scaled_arr = cv2.resize(arr, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)
                scale_factor = 1 / scale
            else:
                # 缩小
                new_w = int(w * scale)
                new_h = int(h * scale)
                scaled_arr = cv2.resize(arr, (new_w, new_h), interpolation=cv2.INTER_AREA)
                scale_factor = 1 / scale
            
            def run_ocr():
                nonlocal ocr_results, ocr_error
                try:
                    ocr_results = reader.readtext(scaled_arr)
                except Exception as e:
                    ocr_error = e
            
            ocr_results = None
            ocr_error = None
            
            thread = threading.Thread(target=run_ocr)
            thread.start()
            thread.join(timeout=12)
            
            if thread.is_alive() or ocr_error or ocr_results is None:
                continue
            
            sh, sw = scaled_arr.shape[:2]
            
            for (bbox_coords, detected_text, confidence) in ocr_results:
                # 降低置信度阈值以识别更多文字（包括大字体）
                if confidence < 0.05 or len(detected_text.strip()) == 0:
                    continue

                bbox_points = np.array(bbox_coords)
                x_min = int(np.min(bbox_points[:, 0]) * scale_factor)
                y_min = int(np.min(bbox_points[:, 1]) * scale_factor)
                x_max = int(np.max(bbox_points[:, 0]) * scale_factor)
                y_max = int(np.max(bbox_points[:, 1]) * scale_factor)

                region_w = x_max - x_min
                region_h = y_max - y_min

                # 降低最小尺寸限制
                if region_w < 3 or region_h < 3:
                    continue

                norm_bbox = [
                    round(x_min / w, 4),
                    round(y_min / h, 4),
                    round(x_max / w, 4),
                    round(y_max / h, 4)
                ]

                iou_score = 1.0
                if mask is not None:
                    iou_score = OCRService._calculate_iou(mask, (x_min, y_min, x_max, y_max), h, w)

                if iou_score < 0.01:
                    continue

                font_size = max(16, int(region_h * 0.65))  # 降低字体大小比例
                font_color = OCRService._detect_region_color(arr, (x_min, y_min, x_max, y_max))

                all_results.append({
                    "id": f"easyocr_{scale}_{len(all_results)}",
                    "text": detected_text,
                    "bbox": norm_bbox,
                    "confidence": float(confidence),
                    "font_size": font_size,
                    "color": font_color,
                    "iou": round(iou_score, 4)
                })

        return all_results

    @staticmethod
    def _calculate_iou(mask: np.ndarray, region: tuple, img_h: int, img_w: int) -> float:
        x1, y1, x2, y2 = region
        
        region_mask = np.zeros_like(mask)
        region_mask[y1:y2, x1:x2] = 255
        
        intersection = np.logical_and(mask > 0, region_mask > 0).sum()
        union = np.logical_or(mask > 0, region_mask > 0).sum()
        
        if union == 0:
            return 0.0
        
        return float(intersection / union)

    @staticmethod
    def _detect_region_color(arr: np.ndarray, region: tuple) -> list:
        x1, y1, x2, y2 = region
        roi = arr[y1:y2, x1:x2].astype(np.float32)
        
        if roi.size == 0:
            return [196, 164, 100]  # 默认金棕色
        
        try:
            h_roi, w_roi = roi.shape[:2]
            
            # 方法：使用边缘检测 + 颜色差异来识别文字颜色
            
            # 1. 转换为灰度并计算边缘
            gray = cv2.cvtColor(roi.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
            
            # Sobel边缘检测
            sobel_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
            sobel_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
            edge_magnitude = np.sqrt(sobel_x**2 + sobel_y**2)
            
            # 边缘强的区域更可能是文字边界
            edge_threshold = np.percentile(edge_magnitude, 70)
            edge_mask = edge_magnitude > edge_threshold
            
            # 2. 计算整体亮度分布
            brightness = 0.299 * roi[:,:,0] + 0.587 * roi[:,:,1] + 0.114 * roi[:,:,2]
            median_brightness = np.median(brightness)
            mean_brightness = np.mean(brightness)
            
            # 3. 确定文字是亮还是暗
            # 文字通常有较高的对比度和边缘
            if median_brightness > 180:
                # 很亮的背景 -> 文字应该是暗的
                text_brightness_mask = brightness < (median_brightness - 20)
            elif median_brightness < 80:
                # 很暗的背景 -> 文字应该是亮的  
                text_brightness_mask = brightness > (median_brightness + 25)
            else:
                # 中等亮度背景 -> 找与平均亮度差异大的区域
                std_brightness = np.std(brightness)
                if std_brightness > 30:
                    # 高对比度场景
                    text_brightness_mask = np.abs(brightness - mean_brightness) > std_brightness * 0.5
                else:
                    # 低对比度，找较暗的区域（文字通常较暗）
                    text_brightness_mask = brightness < mean_brightness
            
            # 4. 结合边缘和亮度信息
            combined_mask = text_brightness_mask | edge_mask
            
            # 如果结合后的mask太少，放宽条件
            if combined_mask.sum() < 10:
                combined_mask = text_brightness_mask
            if combined_mask.sum() < 5:
                # 最后备用：取最暗的25%像素
                threshold = np.percentile(brightness, 25)
                combined_mask = brightness < threshold
            
            pixels = roi[combined_mask]
            
            if len(pixels) < 3:
                return [196, 164, 100]
            
            # 5. 计算加权平均颜色（边缘附近权重更高）
            if edge_mask.sum() > 5 and len(pixels) > 10:
                edge_pixels = roi[edge_mask & combined_mask]
                if len(edge_pixels) >= 3:
                    # 边缘像素的颜色更重要（它们定义了文字的可见颜色）
                    edge_weight = 0.6
                    body_weight = 0.4
                    edge_mean = np.mean(edge_pixels, axis=0)
                    body_mean = np.mean(pixels, axis=0)
                    mean_color = (edge_mean * edge_weight + body_mean * body_weight).astype(int).tolist()
                else:
                    mean_color = np.mean(pixels, axis=0).astype(int).tolist()
            else:
                mean_color = np.mean(pixels, axis=0).astype(int).tolist()
            
            r, g, b = float(mean_color[0]), float(mean_color[1]), float(mean_color[2])
            
            # 6. 后处理：增强暖色调（金/橙/红）
            is_warm = (r > g + 8 and r > b + 8) or \
                     (r > 150 and g < r - 15 and b < r - 20) or \
                     (r > 140 and g < 120 and b < 100)
            
            if is_warm:
                # 金色调增强
                mean_color[0] = min(255, int(r * 1.05))
                mean_color[1] = max(0, int(g * 0.95))
                mean_color[2] = max(0, int(b * 0.92))
            elif r < 100 and g < 100 and b < 100:
                # 暗色调整
                mean_color[0] = min(255, int(r * 1.08))
                mean_color[1] = min(255, int(g * 1.04))
                mean_color[2] = min(255, int(b * 1.02))
            
            return mean_color
            
        except Exception as e:
            print(f"Color detection error: {e}")
            import traceback
            traceback.print_exc()
            return [196, 164, 100]

    @staticmethod
    def _enhanced_fallback_detect(arr: np.ndarray, mask: np.ndarray = None) -> list:
        h, w = arr.shape[:2]
        all_regions = []
        
        for scale in [1.0, 0.6]:
            if scale < 1.0:
                new_w = int(w * scale)
                new_h = int(h * scale)
                scaled_arr = cv2.resize(arr, (new_w, new_h), interpolation=cv2.INTER_AREA)
                sf = 1 / scale
            else:
                scaled_arr = arr
                sf = 1
            
            sh, sw = scaled_arr.shape[:2]
            
            gray = cv2.cvtColor(scaled_arr, cv2.COLOR_RGB2GRAY)
            
            methods = [
                ('adaptive', lambda g: cv2.adaptiveThreshold(g, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 8)),
                ('otsu', lambda g: cv2.threshold(g, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]),
            ]
            
            for method_name, threshold_fn in methods:
                try:
                    binary = threshold_fn(gray)
                    
                    kernel_sizes = [(3, 3), (5, 5)]
                    for ks in kernel_sizes:
                        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, ks)
                        processed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=1)
                        
                        contours, _ = cv2.findContours(processed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                        
                        for contour in contours:
                            x, y, cw, ch = cv2.boundingRect(contour)
                            
                            x_orig = int(x * sf)
                            y_orig = int(y * sf)
                            cw_orig = int(cw * sf)
                            ch_orig = int(ch * sf)
                            
                            if cw_orig < 8 or ch_orig < 8 or cw_orig > w * 0.98 or ch_orig > h * 0.98:
                                continue
                            
                            area = cv2.contourArea(contour) * (sf * sf)
                            if area < 20:
                                continue
                            
                            aspect_ratio = cw / max(ch, 1)
                            if aspect_ratio > 35 or aspect_ratio < 0.03:
                                continue
                            
                            rect_area = cw * ch
                            if rect_area > 0 and (area / (rect_area * sf * sf)) < 0.06:
                                continue

                            norm_bbox = [
                                round(x_orig/w, 4),
                                round(y_orig/h, 4),
                                round((x_orig+cw_orig)/w, 4),
                                round((y_orig+ch_orig)/h, 4)
                            ]

                            iou_val = 1.0
                            if mask is not None:
                                scaled_mask = cv2.resize(mask, (sw, sh)) if mask.shape[:2] != (sh, sw) else mask
                                iou_val = OCRService._calculate_iou(scaled_mask, (x, y, x+cw, y+ch), sh, sw)

                            if iou_val < 0.02:
                                continue

                            all_regions.append({
                                "id": f"fb_{method_name}_{scale}_{len(all_regions)}",
                                "text": "",
                                "bbox": norm_bbox,
                                "confidence": 0.55,
                                "font_size": max(24, int(ch_orig * 0.85)),
                                "color": [200, 180, 160],
                                "iou": round(iou_val, 4),
                                "method": method_name
                            })
                            
                except Exception as e:
                    print(f"Fallback method {method_name} error: {e}")
                    continue
        
        return all_regions

    @staticmethod
    def _merge_duplicate_regions(regions: list) -> list:
        if len(regions) <= 1:
            return regions
        
        merged = []
        used = set()
        
        for i, r1 in enumerate(regions):
            if i in used:
                continue
            
            b1 = r1["bbox"]
            group = [r1]
            used.add(i)
            
            for j, r2 in enumerate(regions):
                if j <= i or j in used:
                    continue
                
                b2 = r2["bbox"]
                
                x_overlap = max(0, min(b1[2], b2[2]) - max(b1[0], b2[0]))
                y_overlap = max(0, min(b1[3], b2[3]) - max(b1[1], b2[1]))
                area1 = (b1[2] - b1[0]) * (b1[3] - b1[1])
                area2 = (b2[2] - b2[0]) * (b2[3] - b2[1])
                intersection = x_overlap * y_overlap
                union = area1 + area2 - intersection
                
                if union > 0 and intersection / union > 0.4:
                    group.append(r2)
                    used.add(j)
            
            best = max(group, key=lambda r: (r["confidence"], len(r.get("text", ""))))
            
            if len(group) > 1:
                texts = [r["text"] for r in group if r.get("text")]
                if texts and not best.get("text"):
                    best["text"] = texts[0]
            
            merged.append(best)
        
        return merged
