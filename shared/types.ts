/**
 * AI PixelFlow - Shared Type Definitions
 * 前后端共享的类型定义
 */

// 图片上传响应
export interface UploadResponse {
  success: boolean;
  message: string;
  data: {
    file_id: string;
    filename: string;
    original_name: string;
    content_type: string;
    url: string;
    uploaded_at: string;
  };
}

// 图片信息
export interface ImageInfo {
  file_id: string;
  filename: string;
  url: string;
  width?: number;
  height?: number;
  exists: boolean;
}

// 分割请求
export interface SegmentRequest {
  file_id: string;
  points?: Array<{ x: number; y: number }>;
  box?: { x1: number; y1: number; x2: number; y2: number };
}

// 分割响应
export interface SegmentResponse {
  success: boolean;
  message: string;
  data: {
    mask_url: string;
    polygons: Array<Array<{ x: number; y: number }>>;
  };
}

// 文本编辑请求
export interface TextEditRequest {
  file_id: string;
  regions: Array<{
    id: string;
    bbox: { x: number; y: number; width: number; height: number };
    original_text: string;
    new_text: string;
  }>;
}

// 文本编辑响应
export interface TextEditResponse {
  success: boolean;
  message: string;
  data: {
    result_url: string;
    processing_time: number;
  };
}

// 物体消除请求
export interface RemoveRequest {
  file_id: string;
  mask_url: string;
  method?: 'lama' | 'deepfill' | 'opencv';
}

// 物体消除响应
export interface RemoveResponse {
  success: boolean;
  message: string;
  data: {
    result_url: string;
    processing_time: number;
  };
}

// 任务状态
export interface TaskStatus {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  result_url?: string;
  error?: string;
  created_at: string;
  updated_at: string;
}

// API 错误响应
export interface ApiError {
  success: false;
  message: string;
  error?: string;
}
