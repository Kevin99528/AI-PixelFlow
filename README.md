# AI PixelFlow - 本地智能图像编辑系统

在本地私有化环境下，利用 GPU 加速实现"工业级"文字改写与无痕消除。

## 核心功能

- **智能上传** - 支持主流图片格式，自动处理 EXIF 旋转信息，支持 4K 及以上高清图片
- **文本重绘** - 自动识别图中文字区域，自动匹配原图字体、光影、透视与背景纹理
- **智能消除** - 支持画笔涂抹或点选（SAM）选中目标物体，一键移除并智能修补背景
- **视觉一致性** - 采用局部重绘技术，确保未修改区域像素级不变

## 项目结构

```
ai-pixelflow/
├── frontend/          # React + TypeScript + Vite 前端
├── backend/           # FastAPI + Python 后端
├── shared/            # 共享类型定义和工具
├── docs/              # 项目文档
├── deployments/       # Docker 部署配置
├── PRD.md            # 产品需求文档
├── 技术栈设计方案.md  # 技术栈设计
└── 开发计划与版本控制策略.md  # 开发计划
```

## 快速开始

### 前端

```bash
cd frontend
npm install
npm run dev
```

### 后端

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
python main.py
```

## 技术栈

### 前端
- React 18 + TypeScript 5
- Vite 5
- Tailwind CSS 3
- Canvas API

### 后端
- FastAPI 0.115
- Python 3.11+
- OpenCV + Pillow
- Uvicorn

### AI 模型
- SAM2 - 图像分割
- EasyOCR/PP-OCR - 文字识别
- Stable Diffusion/ControlNet - 文本重绘
- LaMa/DeepFill - 背景修补

## 开发计划

| 阶段 | 时间 | 任务 |
|------|------|------|
| 阶段一 | 第1-2周 | 项目初始化与基础架构 |
| 阶段二 | 第3-4周 | 前端界面开发 |
| 阶段三 | 第5-6周 | 后端服务开发 |
| 阶段四 | 第7-8周 | AI模型集成 |
| 阶段五 | 第9-10周 | 核心功能开发 |
| 阶段六 | 第11-12周 | 测试与优化 |
| 阶段七 | 第13周 | 部署与交付 |

## 文档

- [PRD.md](./PRD.md) - 产品需求文档
- [技术栈设计方案.md](./技术栈设计方案.md) - 技术栈设计
- [开发计划与版本控制策略.md](./开发计划与版本控制策略.md) - 开发计划

## License

MIT
