"""
Text Redraw Service - 文本重绘核心服务
"""

import os
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path


class TextRedrawService:
    OUTPUT_DIR = Path("outputs")
    OUTPUT_DIR.mkdir(exist_ok=True)

    @staticmethod
    def redraw_text(image_path: str, bbox: list, new_text: str,
                    font_size: int = None, font_color: list = None,
                    font_family: str = None,  # 自定义字体
                    is_bold: bool = False,  # 文字加粗
                    has_gradient: bool = None, gradient_colors: list = None,
                    has_shadow: bool = None) -> dict:
        try:
            image_path = Path(image_path)
            if not image_path.exists():
                return {"success": False, "error": f"Image not found: {image_path}"}

            orig = Image.open(image_path).convert("RGB")
            w, h = orig.size

            x1 = int(bbox[0] * w)
            y1 = int(bbox[1] * h)
            x2 = int(bbox[2] * w)
            y2 = int(bbox[3] * h)
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)

            region_width = x2 - x1
            region_height = y2 - y1
            if region_width < 10 or region_height < 10:
                return {"success": False, "error": f"Region too small: {region_width}x{region_height}"}

            # 优先使用传入的样式参数（OCR识别到的），否则自动检测
            if font_color is None:
                font_color, detected_gradient, detected_gradient_colors = TextRedrawService._detect_font_color(orig, (x1, y1, x2, y2))
                if has_gradient is None:
                    has_gradient = detected_gradient
                if gradient_colors is None or len(gradient_colors) == 0:
                    gradient_colors = detected_gradient_colors
            else:
                # 转换list为tuple
                font_color = tuple(font_color) if isinstance(font_color, list) else font_color
            
            if font_size is None:
                font_size = TextRedrawService._estimate_font_size(region_height)
            
            if has_shadow is None:
                has_shadow = TextRedrawService._detect_shadow(orig, (x1, y1, x2, y2))

            result = TextRedrawService._render_text_on_region(
                orig, (x1, y1, x2, y2), new_text,
                font_color=font_color, font_size=font_size,
                font_family=font_family,
                is_bold=is_bold,
                has_gradient=has_gradient, gradient_colors=gradient_colors,
                has_shadow=has_shadow
            )

            output_id = f"redraw_{uuid_string()[:8]}"
            output_path = TextRedrawService.OUTPUT_DIR / f"{output_id}.png"
            result.save(output_path, quality=95)

            return {
                "success": True,
                "output_path": str(output_path),
                "output_url": f"/outputs/{output_id}.png",
                "detected_font_size": font_size,
                "detected_color": font_color[:3] if isinstance(font_color, tuple) else font_color,
                "has_gradient": bool(has_gradient),
                "gradient_colors": gradient_colors if has_gradient else []
            }
            
        except Exception as e:
            import traceback
            print(f"Text redraw error: {e}")
            traceback.print_exc()
            return {"success": False, "error": str(e)}

    @staticmethod
    def _detect_font_color(img: Image.Image, bbox: tuple):
        arr = np.array(img.crop(bbox))
        
        if arr.size == 0:
            return (200, 180, 160), False, []

        try:
            hsv = cv2.cvtColor(arr, cv2.COLOR_RGB2HSV)

            s_channel = hsv[:, :, 1]
            v_channel = hsv[:, :, 2]
            
            # 改进的颜色检测：更准确地识别文字像素
            # 文字通常具有：较高的饱和度、适中的亮度（不是太亮也不是太暗）
            text_mask = (s_channel > 25) & (v_channel > 40) & (v_channel < 245)
            
            # 如果检测到的文字像素太少，使用备用策略
            if text_mask.sum() < 10:
                v_median = np.median(v_channel)
                s_median = np.median(s_channel)
                
                if v_median > 160:
                    # 亮背景上的暗色文字
                    text_mask = (v_channel < v_median - 20) | ((s_channel > s_median * 1.2) & (v_channel < v_median))
                elif v_median < 80:
                    # 暗背景上的亮色文字
                    text_mask = v_channel > v_median + 25
                else:
                    # 中等亮度，找饱和度高的区域
                    text_mask = s_channel > np.percentile(s_channel, 60)

            pixels = arr[text_mask]
            
            if len(pixels) < 5:
                # 备用方案：使用所有像素的加权平均
                all_pixels = arr.reshape(-1, 3).astype(np.float32)
                brightness = np.mean(all_pixels[:, 0] * 0.299 + all_pixels[:, 1] * 0.587 + all_pixels[:, 2] * 0.114)
                
                if brightness > 140:
                    dark_idx = np.where(all_pixels[:, 0] * 0.299 + all_pixels[:, 1] * 0.587 + all_pixels[:, 2] * 0.114 < brightness - 15)[0]
                    if len(dark_idx) > 5:
                        pixels = all_pixels[dark_idx]
                elif brightness < 110:
                    bright_idx = np.where(all_pixels[:, 0] * 0.299 + all_pixels[:, 1] * 0.587 + all_pixels[:, 2] * 0.114 > brightness + 15)[0]
                    if len(bright_idx) > 5:
                        pixels = all_pixels[bright_idx]
                
                if len(pixels) < 5:
                    pixels = all_pixels

            if len(pixels) < 3:
                return (80, 70, 60), False, []

            mean_color = tuple(map(int, np.mean(pixels.astype(np.float64), axis=0)))
            std_color = np.std(pixels.astype(np.float64), axis=0)
            
            has_gradient = bool(np.mean(std_color) > 15)
            
            gradient_colors = []
            if has_gradient and len(pixels) > 30:
                try:
                    h, _w = arr.shape[:2]
                    
                    top_third = h // 3
                    bottom_third = 2 * h // 3
                    
                    if top_third > 0 and text_mask[:top_third].sum() > 5:
                        top_pixels = arr[:top_third].reshape(-1, 3)[:text_mask[:top_third].reshape(-1).sum()]
                        if len(top_pixels) > 3:
                            gradient_colors.append(list(map(int, np.mean(top_pixels.astype(np.float64), axis=0))))
                    
                    if bottom_third < h and text_mask[bottom_third:].sum() > 5:
                        bottom_pixels = arr[bottom_third:].reshape(-1, 3)[:text_mask[bottom_third:].reshape(-1).sum()]
                        if len(bottom_pixels) > 3:
                            gradient_colors.append(list(map(int, np.mean(bottom_pixels.astype(np.float64), axis=0))))
                        
                    if len(gradient_colors) >= 2:
                        pass
                    else:
                        gradient_colors = []
                        has_gradient = False
                except Exception as e:
                    print(f"Gradient detection error: {e}")
                    gradient_colors = []
                    has_gradient = False

            r_val = float(mean_color[0])
            g_val = float(mean_color[1])
            b_val = float(mean_color[2])
            
            # 增强暖色调（金色/橙色/红色）- 适用于"聚力同行"这类标题
            is_warm_tone = (r_val > g_val + 5 and r_val > b_val + 5) or \
                          (r_val > 150 and g_val < r_val - 20 and b_val < r_val - 25)
            
            if is_warm_tone:
                enhanced_r = min(255, int(r_val * 1.04))
                enhanced_g = max(0, int(g_val * 0.96))
                enhanced_b = max(0, int(b_val * 0.94))
                mean_color = (enhanced_r, enhanced_g, enhanced_b)
            elif abs(r_val - g_val) < 12 and abs(g_val - b_val) < 12 and r_val < 100:
                mean_color = (int(r_val * 0.93), int(g_val * 0.95), int(b_val * 0.97))
            
            return mean_color, has_gradient, gradient_colors
            
        except Exception as e:
            print(f"Color detection error: {e}")
            import traceback
            traceback.print_exc()
            return (200, 180, 160), False, []

    @staticmethod
    def _estimate_font_size(region_height: int) -> int:
        # 降低字体大小比例，从0.96降到0.72，避免文字过大
        base_size = max(14, int(region_height * 0.72))
        
        if region_height <= 20:
            return max(10, base_size - 2)
        elif region_height <= 35:
            return max(12, base_size)
        elif region_height <= 55:
            return max(16, base_size + 1)
        elif region_height <= 80:
            return max(20, base_size + 2)
        else:
            return min(base_size + 4, 90)  # 大字体限制最大90px

    @staticmethod
    def _detect_shadow(img: Image.Image, bbox: tuple) -> bool:
        try:
            arr = np.array(img.crop(bbox)).astype(np.float32)
            gray = 0.299 * arr[:,:,0] + 0.587 * arr[:,:,1] + 0.114 * arr[:,:,2]
            edges_x = np.abs(gray[:, 1:] - gray[:, :-1])
            edges_y = np.abs(gray[1:, :] - gray[:-1, :])
            edge_density = (edges_x > 20).mean() + (edges_y > 20).mean()
            return edge_density > 0.12
        except:
            return False

    @staticmethod
    def _render_text_on_region(img: Image.Image, bbox: tuple, new_text: str,
                                font_color=None, font_size=None,
                                font_family=None,  # 自定义字体
                                is_bold=False,  # 文字加粗
                                has_gradient=False, gradient_colors=None,
                                has_shadow=False) -> Image.Image:
        result = img.copy()
        w, h = result.size
        
        x1, y1, x2, y2 = bbox
        pad = 4
        
        inpaint_y1 = max(0, y1 - pad)
        inpaint_y2 = min(h, y2 + pad)
        inpaint_x1 = max(0, x1 - pad)
        inpaint_x2 = min(w, x2 + pad)
        
        mask = np.zeros((inpaint_y2 - inpaint_y1, inpaint_x2 - inpaint_x1), dtype=np.uint8)
        mask[y1-inpaint_y1:y2-inpaint_y1, x1-inpaint_x1:x2-inpaint_x1] = 255
        
        roi = np.array(result.crop((inpaint_x1, inpaint_y1, inpaint_x2, inpaint_y2)))
        inpainted = cv2.inpaint(roi, mask, inpaintRadius=5, flags=cv2.INPAINT_TELEA)
        
        temp_img = Image.fromarray(inpainted)
        result.paste(temp_img, (inpaint_x1, inpaint_y1))
        
        draw = ImageDraw.Draw(result)
        font = TextRedrawService._get_font(font_size, font_family)
        
        if new_text.strip():
            scale = 2
            scaled_size = font_size * scale
            scaled_font = TextRedrawService._get_font(scaled_size, font_family)
            
            region_w = x2 - x1
            region_h = y2 - y1
            
            canvas_w = region_w * scale
            canvas_h = region_h * scale
            
            # 使用透明背景而不是白色背景，避免覆盖原始背景
            canvas = Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))
            canvas_draw = ImageDraw.Draw(canvas)
            
            text_bbox = canvas_draw.textbbox((0, 0), new_text, font=scaled_font)
            tw = text_bbox[2] - text_bbox[0]
            th = text_bbox[3] - text_bbox[1]
            
            tx = (canvas_w - tw) // 2
            ty = (canvas_h - th) // 2 - text_bbox[1]
            
            # 计算描边宽度：加粗时增加stroke_width
            base_stroke = max(1, scaled_size // 28)
            stroke_width = base_stroke * (2 if is_bold else 1)  # 加粗时翻倍
            
            if has_gradient and gradient_colors and len(gradient_colors) >= 2:
                for i in range(len(new_text)):
                    char = new_text[i]
                    if i == 0:
                        color = tuple(gradient_colors[0])
                    elif i == len(new_text) - 1:
                        color = tuple(gradient_colors[-1])
                    else:
                        t = (i + 1) / len(new_text)
                        c1 = np.array(gradient_colors[0], dtype=np.float64)
                        c2 = np.array(gradient_colors[-1], dtype=np.float64)
                        blended = c1 * (1 - t) + c2 * t
                        color = tuple(blended.astype(int))
                    
                    char_bbox = canvas_draw.textbbox((0, 0), char, font=scaled_font)
                    cw = char_bbox[2] - char_bbox[0]
                    
                    cx = tx + sum([canvas_draw.textbbox((0,0), new_text[j], font=scaled_font)[2] - 
                                  canvas_draw.textbbox((0,0), new_text[j], font=scaled_font)[0] 
                                  for j in range(i)])
                    
                    canvas_draw.text((cx, ty), char, fill=color, font=scaled_font, stroke_width=stroke_width, stroke_fill=tuple(max(0, c-45) for c in color))
            else:
                color = tuple(font_color) if font_color else (80, 70, 60)
                stroke_fill = tuple(max(0, c-45) for c in color)
                canvas_draw.text((tx, ty), new_text, fill=color, font=scaled_font, stroke_width=stroke_width, stroke_fill=stroke_fill)
            
            canvas = canvas.resize((region_w, region_h), Image.LANCZOS)
            
            # 确保canvas是RGBA模式并正确粘贴（保留透明背景）
            if canvas.mode != 'RGBA':
                canvas = canvas.convert('RGBA')
            
            # 将结果转为RGBA以支持透明粘贴
            result_rgba = result.convert('RGBA')
            
            # 使用alpha通道作为mask进行粘贴
            alpha = canvas.split()[3]  # 获取alpha通道
            result_rgba.paste(canvas, (x1, y1), alpha)
            
            # 转回RGB保存
            result = result_rgba.convert('RGB')
        
        return result

    @staticmethod
    def _get_font(size: int, font_family: str = None):
        font_mapping = {
            'simhei': 'C:/Windows/Fonts/simhei.ttf',
            'simsun': 'C:/Windows/Fonts/simsun.ttc',
            'simkai': 'C:/Windows/Fonts/simkai.ttf',
            'simfang': 'C:/Windows/Fonts/simfang.ttf',
            'lishu': 'C:/Windows/Fonts/simsun.ttf',
            'stxingkai': 'C:/Windows/Fonts/stxingkai.ttf',
            'stcaiyun': 'C:/Windows/Fonts/stcaiyun.ttf',
            'sthuapo': 'C:/Windows/Fonts/sthuapo.ttf'
        }
        
        if font_family and font_family in font_mapping:
            font_path = font_mapping[font_family]
            if os.path.exists(font_path):
                try:
                    return ImageFont.truetype(font_path, size)
                except:
                    pass
        
        default_fonts = [
            ("C:/Windows/Fonts/msyh.ttc", size),
            ("C:/Windows/Fonts/simhei.ttf", size),
            ("C:/Windows/Fonts/simkai.ttf", size),
        ]
        
        for path, sz in default_fonts:
            if os.path.exists(path):
                try:
                    return ImageFont.truetype(path, sz)
                except:
                    continue
        
        return ImageFont.load_default()


def uuid_string():
    import uuid
    return str(uuid.uuid4()).replace('-', '')
