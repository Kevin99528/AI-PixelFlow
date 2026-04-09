# AI PixelFlow 项目总结

## 项目概述

AI PixelFlow 是一个本地智能图像编辑系统，基于 React + FastAPI + SAM2 构建，支持图片上传、AI 智能分割、文本重绘、智能消除等功能。

## 技术栈

### 前端
- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **样式**: Tailwind CSS
- **动画**: Framer Motion
- **图标**: Lucide React

### 后端
- **框架**: FastAPI (Python)
- **AI 模型**: SAM2 (Segment Anything Model 2)
- **图像处理**: PIL, OpenCV, scikit-image
- **深度学习**: PyTorch

## 功能模块

### 1. 图片上传管理
- 支持拖拽上传和点击上传
- 支持 JPG、PNG、WebP、BMP 格式
- 文件大小限制 100MB
- 后端存储，生成唯一文件 ID

**核心文件**:
- `frontend/src/components/UploadZone.tsx` - 上传组件
- `backend/app/api/routes.py` - 上传接口

### 2. AI 智能分割 (SAM2)
- 基于 Meta AI 的 SAM2 Large 模型
- 点击式交互分割
- 自动生成精确轮廓
- 支持多区域选择和切换
- 选中后自动隐藏点击标记

**核心文件**:
- `backend/app/services/sam2_service.py` - SAM2 模型服务
- `backend/app/services/segmentation_service.py` - 分割业务逻辑
- `frontend/src/components/ImageEditor.tsx` - 分割交互界面

**模型文件**:
- `backend/models/sam2_hiera_large.pt` (898MB)
- 配置文件: `sam2_hiera_l.yaml` (内置在 sam2 库中)

### 3. 文本重绘 (预留)
- 框选文字区域
- AI 重绘文字内容

### 4. 智能消除 (预留)
- 涂抹选择消除区域
- AI 智能填充

## 项目结构

```
本地P图工具/
├── frontend/                 # 前端项目
│   ├── src/
│   │   ├── components/      # 组件
│   │   │   ├── UploadZone.tsx      # 上传组件
│   │   │   ├── ImageEditor.tsx     # 图片编辑器（含分割）
│   │   │   ├── ProcessingPanel.tsx # 处理面板
│   │   │   └── ResultViewer.tsx    # 结果展示
│   │   ├── App.tsx          # 主应用
│   │   └── main.tsx         # 入口
│   ├── index.html
│   └── package.json
│
├── backend/                  # 后端项目
│   ├── app/
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   └── routes.py    # API 路由
│   │   ├── core/            # 核心配置
│   │   │   ├── __init__.py
│   │   │   ├── config.py
│   │   │   └── exceptions.py
│   │   ├── models/          # 数据模型
│   │   │   ├── __init__.py
│   │   │   └── schemas.py
│   │   ├── services/        # 业务逻辑
│   │   │   ├── __init__.py
│   │   │   ├── image_service.py
│   │   │   ├── sam2_service.py      # SAM2 模型服务
│   │   │   └── segmentation_service.py  # 分割服务
│   │   └── utils/           # 工具函数
│   │       └── __init__.py
│   ├── models/              # AI 模型文件
│   │   └── sam2_hiera_large.pt  # SAM2 Large 模型
│   ├── uploads/             # 上传图片存储
│   ├── temp/                # 临时文件（分割掩码）
│   ├── main.py              # 主入口
│   └── requirements.txt     # Python 依赖
│
└── PROJECT_SUMMARY.md       # 本文档
```

## 关键实现细节

### SAM2 分割流程

1. **用户点击** -> 前端发送坐标到后端
2. **后端处理**:
   - 加载图片
   - 初始化 SAM2 模型（首次）
   - 执行分割预测
   - 提取轮廓
   - 生成 SVG 路径
   - 保存掩码图片
3. **返回结果** -> 前端显示轮廓和分割列表

### 轮廓提取算法

```python
from skimage import measure

# 从掩码提取轮廓
contours = measure.find_contours(mask, 0.5)
if contours:
    main_contour = max(contours, key=len)
    # 简化为 50 个点
    step = max(1, len(main_contour) // 50)
    simplified = main_contour[::step]
    # 生成 SVG 路径
```

### 前端分割交互

- 点击模式：记录点击坐标（归一化 0-1）
- 加载状态：显示十字准星动画
- 结果展示：
  - 左侧分割列表（面积、选择框）
  - 图片上 SVG 轮廓线
  - 选中后隐藏点击标记

## 启动方式

### 前端
```bash
cd frontend
npm install
npm run dev
```
访问: http://localhost:5174

### 后端
```bash
cd backend
# 使用 PowerShell 脚本
.\start-backend.ps1

# 或直接启动
C:\Users\Longlit\AppData\Local\Programs\Python\Python311\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
API 文档: http://localhost:8000/docs

## 依赖安装

### Python 依赖
```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install fastapi uvicorn python-multipart pillow numpy scikit-image
pip install sam2
```

### Node 依赖
```bash
cd frontend
npm install
```

## Git 分支管理

- `master` - 主分支，稳定版本
- `develop` - 开发分支，功能集成
- 功能分支 - 已合并到 develop

## 后续优化建议

1. **性能优化**
   - SAM2 模型使用 GPU 加速（如有显卡）
   - 图片压缩和缓存

2. **功能扩展**
   - 实现文本重绘功能
   - 实现智能消除功能
   - 支持批量处理

3. **用户体验**
   - 添加撤销/重做功能
   - 支持快捷键操作
   - 添加更多编辑工具

4. **部署优化**
   - Docker 容器化
   - 静态资源 CDN

## 开发记录

### 已完成里程碑

1. ✅ 项目初始化和架构设计
2. ✅ 后端 API 框架搭建
3. ✅ 前端界面开发
4. ✅ 图片上传功能
5. ✅ SAM2 模型集成
6. ✅ 智能分割功能（点击交互 + 轮廓显示）

### 关键提交

```
c9f1b3f feat: implement SAM2 segmentation with real model
- Add SAM2 Large model support (898MB)
- Implement image segmentation service with click interaction
- Add frontend segmentation UI with mask selection
- Fix image upload to use backend storage
- Add contour extraction and SVG generation
- Hide click markers after mask selection
```

## 联系方式

项目维护者开发团队
