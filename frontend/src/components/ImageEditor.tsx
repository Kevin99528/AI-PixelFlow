import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeft, 
  Wand2, 
  Eraser, 
  Type, 
  Hand,
  Play,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Scissors,
  X,
  Check,
  Loader2,
  Download,
  Eye,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Edit3,
  Palette
} from 'lucide-react'

interface ImageEditorProps {
  imageUrl: string
  onProcess: () => void
  onBack: () => void
}

type EditMode = 'text' | 'remove' | 'hand' | 'segment'

interface MaskInfo {
  mask_id: string
  area: number
  bbox: number[]
  mask_url: string
  contour_svg: string
}

interface OCRRegion {
  id: string
  text: string
  bbox: number[]
  confidence: number
  font_size: number
  color: number[]
  iou: number
}

export default function ImageEditor({ imageUrl, onProcess, onBack }: ImageEditorProps) {
  const [editMode, setEditMode] = useState<EditMode>('hand')
  const [zoom, setZoom] = useState(100)

  const [isSegmenting, setIsSegmenting] = useState(false)
  const [segmentMasks, setSegmentMasks] = useState<MaskInfo[]>([])
  const [selectedMasks, setSelectedMasks] = useState<Set<string>>(new Set())
  const [clickPoints, setClickPoints] = useState<Array<{x: number, y: number, id: string}>>([])
  const [hoverPosition, setHoverPosition] = useState<{x: number, y: number} | null>(null)
  const [segmentError, setSegmentError] = useState<string | null>(null)

  const [isOCRScanning, setIsOCRScanning] = useState(false)
  const [ocrRegions, setOcrRegions] = useState<OCRRegion[]>([])
  const [selectedOCRRegion, setSelectedOCRRegion] = useState<OCRRegion | null>(null)
  const [textInput, setTextInput] = useState('')
  const [customFontSize, setCustomFontSize] = useState<number | null>(null)
  const [customFontColor, setCustomFontColor] = useState<string | null>(null)
  const [customBold, setCustomBold] = useState(false)  // 文字加粗
  const [customGradient, setCustomGradient] = useState<string | null>(null)  // 渐变色预设
  const [customFontFamily, setCustomFontFamily] = useState<string>('default')  // 自定义字体
  const [isRedrawing, setIsRedrawing] = useState(false)
  const [redrawResult, setRedrawResult] = useState<string | null>(null)
  const [showResultPreview, setShowResultPreview] = useState(false)
  const [textBbox, setTextBbox] = useState<number[] | null>(null)
  const [redrawError, setRedrawError] = useState<string | null>(null)

  const [brushSize, setBrushSize] = useState(30)
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushStrokes, setBrushStrokes] = useState<ImageData[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isRemoving, setIsRemoving] = useState(false)
  const [removeResult, setRemoveResult] = useState<string | null>(null)
  const [showRemovePreview, setShowRemovePreview] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const editModes = [
    { id: 'hand', label: '移动', icon: Hand },
    { id: 'segment', label: '智能分割', icon: Scissors },
    { id: 'text', label: '文本重绘', icon: Type },
    { id: 'remove', label: '智能消除', icon: Eraser },
  ]

  const displayImageUrl = useMemo(() => {
    if (editMode === 'remove' && showRemovePreview && removeResult) return removeResult
    if (showResultPreview && redrawResult) return redrawResult
    if (editMode === 'text' && selectedMasks.size > 0) {
      const firstSelected = Array.from(selectedMasks)[0]
      const mask = segmentMasks.find(m => m.mask_id === firstSelected)
      if (mask) return `http://localhost:8000${mask.mask_url}`
    }
    return imageUrl
  }, [imageUrl, showResultPreview, redrawResult, editMode, selectedMasks, segmentMasks, showRemovePreview, removeResult])

  const handleImageClick = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height

    if (editMode === 'text' && ocrRegions.length > 0) {
      for (const region of ocrRegions) {
        const [bx1, by1, bx2, by2] = region.bbox
        if (x >= bx1 && x <= bx2 && y >= by1 && y <= by2) {
          selectOCRRegion(region)
          return
        }
      }
    }

    if (editMode !== 'segment' || isSegmenting) return

    const clickId = Date.now().toString()
    setClickPoints(prev => [...prev, { x, y, id: clickId }])
    setIsSegmenting(true)
    setSegmentError(null)

    try {
      const imageId = imageUrl.split('/').pop()?.split('.')[0]

      const response = await fetch('http://localhost:8000/api/v1/segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_id: imageId, x, y })
      })

      if (!response.ok) throw new Error('Segmentation failed')

      const result = await response.json()

      if (result.success && result.data) {
        setSegmentMasks(prev => [...prev, ...result.data])
      }
    } catch (error) {
      console.error('Segmentation error:', error)
      setSegmentError('分割失败，请重试')
    } finally {
      setIsSegmenting(false)
    }
  }, [editMode, isSegmenting, imageUrl, ocrRegions])

  const handleOCRScan = useCallback(async () => {
    setIsOCRScanning(true)
    setOcrRegions([])
    setSelectedOCRRegion(null)
    setTextInput('')
    setRedrawResult(null)
    setShowResultPreview(false)

    try {
      const imageId = imageUrl.split('/').pop()?.split('.')[0]
      let maskUrl = null

      if (editMode === 'segment' && selectedMasks.size > 0) {
        const firstSelectedId = Array.from(selectedMasks)[0]
        const mask = segmentMasks.find(m => m.mask_id === firstSelectedId)
        if (mask) maskUrl = mask.mask_url
      }

      const response = await fetch('http://localhost:8000/api/v1/ocr/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_id: imageId,
          mask_url: maskUrl
        })
      })

      if (!response.ok) throw new Error('OCR scan failed')

      const result = await response.json()

      if (result.success && result.regions) {
        setOcrRegions(result.regions)
        // 不再自动选中区域，需要用户手动点击选择
      }
    } catch (error) {
      console.error('OCR scan error:', error)
      setRedrawError('文字识别失败，请重试')
    } finally {
      setIsOCRScanning(false)
    }
  }, [imageUrl, editMode, selectedMasks, segmentMasks])
  
  useEffect(() => {
    if (editMode === 'text' && ocrRegions.length === 0 && !isOCRScanning) {
      const timer = setTimeout(() => {
        handleOCRScan()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [editMode])

  useEffect(() => {
    if (editMode !== 'remove') return
    const timer = setTimeout(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const container = canvas.parentElement
      if (!container) return
      const img = container.querySelector('img')
      if (!img) return
      const rect = img.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        canvas.width = rect.width
        canvas.height = rect.height
        const ctx = canvas.getContext('2d')
        if (ctx && brushStrokes.length > 0) {
          ctx.putImageData(brushStrokes[brushStrokes.length - 1], 0, 0)
        }
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [editMode, brushStrokes])

  const selectOCRRegion = useCallback((region: OCRRegion) => {
    setSelectedOCRRegion(region)
    setTextInput(region.text)
    setTextBbox(region.bbox)
    setRedrawResult(null)
    setShowResultPreview(false)
    // 重置自定义样式
    setCustomFontSize(null)
    setCustomFontColor(null)
    setCustomBold(false)
    setCustomGradient(null)
    setCustomFontFamily('default')
  }, [])

  const handleTextRedraw = useCallback(async () => {
    if (!textInput.trim()) {
      setRedrawError('请输入要替换的文字内容')
      return
    }
    
    if (!textBbox || !selectedOCRRegion) {
      setRedrawError('请先选择要修改的文字区域')
      return
    }

    console.log('Text redraw request:', { imageId: imageUrl, bbox: textBbox, text: textInput })
    
    setIsRedrawing(true)
    setRedrawError(null)

    try {
      const imageId = imageUrl.split('/').pop()?.split('.')[0]
      
      // 使用OCR识别到的原始样式参数
      let finalFontSize = customFontSize || selectedOCRRegion?.font_size || null
      let finalFontColor = null
      let finalGradientColors = []
      let hasGradient = false
      
      // 处理渐变色预设
      if (customGradient) {
        const gradientMap: Record<string, [number[], number[]]> = {
          'gold': [[255, 215, 0], [184, 134, 11]],           // 金色渐变
          'fire': [[255, 69, 0], [178, 34, 34]],             // 火焰红橙
          'sunset': [[255, 140, 0], [220, 20, 60]],          // 日落橙红
          'ocean': [[0, 119, 190], [0, 191, 255]],           // 海洋蓝
          'forest': [[34, 139, 34], [50, 205, 50]],          // 森林绿
          'purple': [[138, 43, 226], [186, 85, 211]],        // 紫罗兰
          'rose': [[255, 105, 180], [255, 182, 193]],        // 玫瑰粉
          'rainbow': [[255, 0, 0], [75, 0, 130]]             // 彩虹
        }
        
        if (gradientMap[customGradient]) {
          hasGradient = true
          finalGradientColors = gradientMap[customGradient]
          finalFontColor = gradientMap[customGradient][0]
        }
      } else if (customFontColor && customFontColor.startsWith('#')) {
        // 用户自定义纯色：转换为RGB数组
        const hex = customFontColor.replace('#', '')
        finalFontColor = [
          parseInt(hex.substring(0, 2), 16),
          parseInt(hex.substring(2, 4), 16),
          parseInt(hex.substring(4, 6), 16)
        ]
      } else if (selectedOCRRegion?.color && Array.isArray(selectedOCRRegion.color)) {
        // OCR识别的颜色
        finalFontColor = [...selectedOCRRegion.color]
      }
      
      const styleParams = {
        font_size: finalFontSize,
        font_color: finalFontColor,
        font_family: customFontFamily !== 'default' ? customFontFamily : null,
        is_bold: customBold,                    // 加粗参数
        has_gradient: hasGradient,              // 是否使用渐变
        gradient_colors: finalGradientColors,   // 渐变颜色数组
        has_shadow: false
      }
      
      console.log('Style params:', { 
        custom: { size: customFontSize, color: customFontColor }, 
        ocr: { size: selectedOCRRegion?.font_size, color: selectedOCRRegion?.color }, 
        final: styleParams 
      })

      const response = await fetch('http://localhost:8000/api/v1/edit/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_id: imageId,
          bbox: textBbox,
          text: textInput.trim(),
          ...styleParams
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Text redraw HTTP error:', response.status, errorText)
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      console.log('Text redraw result:', result)

      if (result.success && result.output_url) {
        setRedrawResult(`http://localhost:8000${result.output_url}`)
        setShowResultPreview(true)
        // 重绘成功后清除选中状态，隐藏边框
        setSelectedOCRRegion(null)
      } else {
        throw new Error(result.error || 'Unknown error')
      }
    } catch (error) {
      console.error('Text redraw error:', error)
      setRedrawError(`文本重绘失败: ${error instanceof Error ? error.message : '请重试'}`)
    } finally {
      setIsRedrawing(false)
    }
  }, [textInput, textBbox, imageUrl, customFontSize, customFontColor, customBold, customGradient, customFontFamily])

  const downloadResult = useCallback(async () => {
    if (!redrawResult) return
    try {
      const response = await fetch(redrawResult)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `redraw_${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }, [redrawResult])

  const toggleMaskSelection = (maskId: string) => {
    setSelectedMasks(prev => {
      const newSet = new Set(prev)
      if (newSet.has(maskId)) {
        newSet.delete(maskId)
      } else {
        newSet.add(maskId)
        setClickPoints([])
      }
      return newSet
    })
  }

  const clearSegmentation = () => {
    setSegmentMasks([])
    setSelectedMasks(new Set())
    setClickPoints([])
    setSegmentError(null)
  }

  const clearTextState = () => {
    setOcrRegions([])
    setSelectedOCRRegion(null)
    setTextInput('')
    setRedrawResult(null)
    setShowResultPreview(false)
    setTextBbox(null)
    setRedrawError(null)
  }

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (editMode !== 'segment') return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setHoverPosition({ x, y })
  }, [editMode])

  const handleMouseLeave = () => {
    setHoverPosition(null)
  }

  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    }
  }, [])

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (editMode !== 'remove') return
    e.preventDefault()
    e.stopPropagation()
    setIsDrawing(true)
    const coords = getCanvasCoords(e)
    if (!coords) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = 'rgba(56, 189, 248, 0.40)'
    ctx.beginPath()
    ctx.arc(coords.x, coords.y, brushSize, 0, Math.PI * 2)
    ctx.fill()
  }, [editMode, brushSize, getCanvasCoords])

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || editMode !== 'remove') return
    e.preventDefault()
    e.stopPropagation()
    const coords = getCanvasCoords(e)
    if (!coords) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = 'rgba(56, 189, 248, 0.40)'
    ctx.beginPath()
    ctx.arc(coords.x, coords.y, brushSize, 0, Math.PI * 2)
    ctx.fill()
  }, [isDrawing, editMode, brushSize, getCanvasCoords])

  const stopDrawing = useCallback(() => {
    if (!isDrawing) return
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    setBrushStrokes(prev => [...prev, imageData])
  }, [isDrawing])

  const clearBrushStrokes = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setBrushStrokes([])
    setRemoveResult(null)
    setShowRemovePreview(false)
    setRemoveError(null)
  }, [])

  const undoLastStroke = useCallback(() => {
    setBrushStrokes(prev => {
      const newStrokes = prev.slice(0, -1)
      const canvas = canvasRef.current
      if (!canvas) return newStrokes
      const ctx = canvas.getContext('2d')
      if (!ctx) return newStrokes
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (newStrokes.length > 0) {
        ctx.putImageData(newStrokes[newStrokes.length - 1], 0, 0)
      }
      return newStrokes
    })
  }, [])

  const handleRemove = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) {
      setRemoveError('画布未初始化，请重试')
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setRemoveError('无法获取画布上下文，请重试')
      return
    }
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    let hasContent = false
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) {
        hasContent = true
        break
      }
    }
    if (!hasContent) {
      setRemoveError('请先涂抹需要消除的区域')
      return
    }

    setIsRemoving(true)
    setRemoveError(null)

    try {
      const maskCanvas = document.createElement('canvas')
      maskCanvas.width = canvas.width
      maskCanvas.height = canvas.height
      const maskCtx = maskCanvas.getContext('2d')
      if (!maskCtx) throw new Error('Cannot create mask canvas')

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const idx = (y * canvas.width + x) * 4
          const alpha = data[idx + 3]
          if (alpha > 0) {
            maskCtx.fillStyle = 'white'
          } else {
            maskCtx.fillStyle = 'black'
          }
          maskCtx.fillRect(x, y, 1, 1)
        }
      }

      const maskBase64 = maskCanvas.toDataURL('image/png')

      const imageId = imageUrl.split('/').pop()?.split('.')[0]

      const response = await fetch('http://localhost:8000/api/v1/edit/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_id: imageId,
          mask_data: maskBase64,
          brush_size: brushSize
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const result = await response.json()

      if (result.success && result.output_url) {
        setRemoveResult(`http://localhost:8000${result.output_url}`)
        setShowRemovePreview(true)
      } else {
        throw new Error(result.error || 'Unknown error')
      }
    } catch (error) {
      console.error('Remove error:', error)
      setRemoveError(`智能消除失败: ${error instanceof Error ? error.message : '请重试'}`)
    } finally {
      setIsRemoving(false)
    }
  }, [imageUrl, brushSize])

  const downloadRemoveResult = useCallback(async () => {
    if (!removeResult) return
    try {
      const response = await fetch(removeResult)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `remove_${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }, [removeResult])

  return (
    <div className="space-y-6">
      <motion.div className="glass-card p-4" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors" whileHover={{ scale: 1.05, x: -2 }} whileTap={{ scale: 0.95 }}>
              <ArrowLeft className="w-5 h-5" />
            </motion.button>
            <div className="h-6 w-px bg-gray-200" />

            <div className="flex items-center gap-2">
              {editModes.map((mode) => {
                const Icon = mode.icon
                const isActive = editMode === mode.id
                return (
                  <motion.button key={mode.id} onClick={() => { setEditMode(mode.id as EditMode); clearTextState(); clearBrushStrokes(); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${isActive ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} animate={isActive ? { scale: 1.02 } : { scale: 1 }}>
                    <Icon className="w-4 h-4" />
                    {mode.label}
                  </motion.button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <motion.button onClick={() => setZoom(Math.max(50, zoom - 10))} className="p-1.5 rounded-md hover:bg-white text-gray-600" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <ZoomOut className="w-4 h-4" />
              </motion.button>
              <span className="text-sm font-medium text-gray-600 w-12 text-center">{zoom}%</span>
              <motion.button onClick={() => setZoom(Math.min(200, zoom + 10))} className="p-1.5 rounded-md hover:bg-white text-gray-600" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <ZoomIn className="w-4 h-4" />
              </motion.button>
            </div>

            <div className="h-6 w-px bg-gray-200" />

            <motion.button onClick={onProcess} className="btn-gradient flex items-center gap-2" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Play className="w-4 h-4" />
              开始处理
            </motion.button>
          </div>
        </div>
      </motion.div>

      <div className="flex gap-6">
        <motion.div className="w-80 flex-shrink-0 space-y-5" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <div className="glass-card p-6 overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500" />
            <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2.5">
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                editMode === 'text' ? 'bg-purple-100 text-purple-600' :
                editMode === 'remove' ? 'bg-red-100 text-red-500' :
                editMode === 'hand' ? 'bg-gray-100 text-gray-600' :
                'bg-sky-100 text-sky-600'
              }`}>
              {editMode === 'text' && <Type className="w-4 h-4" />}
              {editMode === 'remove' && <Eraser className="w-4 h-4" />}
              {editMode === 'hand' && <Hand className="w-4 h-4" />}
              {editMode === 'segment' && <Scissors className="w-4 h-4" />}
              </span>
              当前模式
            </h3>
            <p className="text-[13px] text-gray-500 leading-relaxed mb-3">
              {editMode === 'text' && '点击扫描按钮识别图片中的文字区域，选择后输入新文本进行替换。'}
              {editMode === 'remove' && '涂抹需要消除的物体，AI 将智能修补背景，保持视觉一致。'}
              {editMode === 'hand' && '拖拽移动画布，滚轮缩放视图。'}
              {editMode === 'segment' && '点击图片上的物体，AI 将自动识别并分割出轮廓。'}
            </p>

            {editMode === 'segment' && segmentMasks.length > 0 && (
              <motion.button onClick={clearSegmentation} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-50 to-orange-50 text-red-600 text-sm font-semibold hover:from-red-100 hover:to-orange-100 transition-all border border-red-100" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                清除所有分割
              </motion.button>
            )}

            {editMode === 'text' && ocrRegions.length > 0 && (
              <motion.button onClick={clearTextState} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-50 to-orange-50 text-red-600 text-sm font-semibold hover:from-red-100 hover:to-orange-100 transition-all border border-red-100 mb-2" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                清除识别结果
              </motion.button>
            )}
          </div>

          {editMode === 'text' && (
            <motion.div className="glass-card p-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <h3 className="font-semibold text-gray-800 mb-3">文字编辑</h3>

              {!isOCRScanning && ocrRegions.length === 0 && (
                <motion.button onClick={handleOCRScan} className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 text-white text-sm font-medium shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center gap-2" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Wand2 className="w-4 h-4" />
                  AI 扫描识别文字
                </motion.button>
              )}

              {isOCRScanning && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 text-sky-500 animate-spin mr-2" />
                  <span className="text-sm text-gray-600">正在识别...</span>
                </div>
              )}

              {ocrRegions.length > 0 && !isOCRScanning && (
                <>
                  <div className="mb-3 p-3 bg-gradient-to-br from-sky-50 to-blue-50 rounded-lg border border-sky-100">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                      <span className="text-xs font-medium text-sky-700">AI识别结果 ({ocrRegions.length} 个区域)</span>
                    </div>
                    
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                      {ocrRegions.map((region, idx) => {
                        const displayText = region.text?.trim() || `区域 ${idx + 1}`
                        const isSelected = selectedOCRRegion?.id === region.id
                        
                        return (
                          <motion.button
                            key={region.id}
                            onClick={() => selectOCRRegion(region)}
                            className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg text-left transition-all text-sm group ${
                              isSelected 
                                ? 'bg-gradient-to-r from-sky-100 to-blue-100 border-2 border-sky-400 shadow-md' 
                                : 'bg-white/70 border border-gray-200 hover:border-sky-300 hover:bg-sky-50/50'
                            }`}
                            whileHover={{ scale: 1.01 }} 
                            whileTap={{ scale: 0.99 }}
                          >
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                              isSelected ? 'bg-sky-500 text-white' : 'bg-gray-200 text-gray-600 group-hover:bg-sky-200 group-hover:text-sky-700'
                            }`}>
                              {idx + 1}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className={`font-medium truncate ${isSelected ? 'text-sky-900' : 'text-gray-800'}`}>
                                {displayText.length > 20 ? displayText.slice(0, 20) + '...' : displayText}
                              </div>
                              
                              {region.confidence && (
                                <div className={`text-[10px] ${isSelected ? 'text-sky-600' : 'text-gray-500'}`}>
                                  置信度: {(region.confidence * 100).toFixed(0)}%
                                </div>
                              )}
                            </div>
                            
                            {isSelected && (
                              <CheckCircle2 className="w-4 h-4 text-sky-500 flex-shrink-0" />
                            )}
                          </motion.button>
                        )
                      })}
                    </div>
                  </div>

                  {selectedOCRRegion && (
                    <>
                      <label className="block text-xs font-semibold text-gray-800 mb-1.5 flex items-center gap-1.5">
                        <Edit3 className="w-3.5 h-3.5 text-sky-500" />
                        编辑内容
                      </label>
                      <textarea
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        placeholder="输入替换后的文字..."
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none resize-none text-sm transition-all"
                        rows={3}
                      />
                      
                      {/* AI识别的字体信息 */}
                      <div className="mt-3 p-2.5 bg-gradient-to-br from-gray-50 to-slate-50 rounded-lg border border-gray-100">
                        <div className="text-[10px] font-semibold text-gray-500 mb-2 uppercase tracking-wider">AI 识别样式</div>
                        <div className="flex items-center gap-3 flex-wrap">
                          {/* 字体大小 */}
                          <div className="flex items-center gap-1.5">
                            <Type className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-600">大小:</span>
                            <span className="text-xs font-bold text-sky-600">{selectedOCRRegion.font_size || '自动'}px</span>
                          </div>
                          
                          {/* 字体颜色 */}
                          <div className="flex items-center gap-1.5">
                            <Palette className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-600">颜色:</span>
                            <div 
                              className="w-4 h-4 rounded border border-gray-300 shadow-sm"
                              style={{ 
                                backgroundColor: selectedOCRRegion.color 
                                  ? `rgb(${selectedOCRRegion.color[0]}, ${selectedOCRRegion.color[1]}, ${selectedOCRRegion.color[2]})` 
                                  : '#ccc' 
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* 用户自定义样式选项 */}
                      <div className="mt-3 p-2.5 bg-white rounded-lg border border-dashed border-gray-200">
                        <div className="text-[10px] font-semibold text-gray-400 mb-2 uppercase tracking-wider">自定义调整（可选）</div>
                        
                        {/* 自定义字体大小 */}
                        <div className="mb-2.5">
                          <label className="block text-[10px] text-gray-500 mb-1 flex justify-between">
                            <span>文字大小</span>
                            <span className="text-sky-600 font-bold">{customFontSize || selectedOCRRegion.font_size || '自动'}px</span>
                          </label>
                          <input 
                            type="range" 
                            min="12" 
                            max="120"
                            value={customFontSize || (selectedOCRRegion.font_size || 36)}
                            onChange={(e) => setCustomFontSize(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-sky-500"
                          />
                          <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                            <span>12px</span>
                            <span>120px</span>
                          </div>
                        </div>
                        
                        {/* 自定义颜色 */}
                        <div className="mb-2.5">
                          <label className="block text-[10px] text-gray-500 mb-1">文字颜色</label>
                          <div className="flex items-center gap-2">
                            <input 
                              type="color" 
                              value={customFontColor || (selectedOCRRegion.color 
                                ? `#${((1 << 24) + (selectedOCRRegion.color[0] << 16) + (selectedOCRRegion.color[1] << 8) + selectedOCRRegion.color[2]).toString(16).slice(1)}`
                                : '#c4a35a'
                              )}
                              onChange={(e) => { setCustomFontColor(e.target.value); setCustomGradient(null) }}
                              className="w-8 h-8 rounded cursor-pointer border-0"
                            />
                            <span className="text-[10px] text-gray-400">纯色</span>
                          </div>
                        </div>
                        
                        {/* 文字加粗 */}
                        <div className="mb-2.5">
                          <label className="flex items-center justify-between cursor-pointer">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-gray-500">文字加粗</span>
                              {customBold && (
                                <span className="text-[9px] font-bold text-sky-600">已开启</span>
                              )}
                            </div>
                            <div 
                              onClick={() => setCustomBold(!customBold)}
                              className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${customBold ? 'bg-sky-500' : 'bg-gray-300'}`}
                            >
                              <div 
                                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${customBold ? 'translate-x-4' : 'translate-x-0.5'}`}
                              />
                            </div>
                          </label>
                        </div>

                        {/* 字体选择 */}
                        <div className="mb-2.5">
                          <label className="block text-[10px] text-gray-500 mb-1.5">字体样式</label>
                          <select
                            value={customFontFamily}
                            onChange={(e) => setCustomFontFamily(e.target.value)}
                            className="w-full px-2.5 py-2 rounded-lg border border-gray-200 focus:border-sky-400 focus:ring-1 focus:ring-sky-100 outline-none text-xs bg-white cursor-pointer hover:border-sky-300 transition-all"
                          >
                            <option value="default">默认（微软雅黑）</option>
                            <option value="simhei">黑体 (SimHei)</option>
                            <option value="simsun">宋体 (SimSun)</option>
                            <option value="simkai">楷体 (SimKai)</option>
                            <option value="simfang">仿宋 (SimFang)</option>
                            <option value="lishu">隶书 (LiSu)</option>
                            <option value="stxingkai">行楷 (STXingKai)</option>
                            <option value="stcaiyun">华文彩云 (STCaiyun)</option>
                            <option value="sthuapo">华文琥珀 (STHupo)</option>
                          </select>
                          {customFontFamily !== 'default' && (
                            <div className="mt-1 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-sky-500" />
                              <span className="text-[9px] text-sky-600 font-medium">已选择自定义字体</span>
                            </div>
                          )}
                        </div>
                        
                        {/* 渐变色选择 */}
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1.5">渐变效果</label>
                          <div className="grid grid-cols-4 gap-1.5">
                            {[
                              { id: null, name: '无', colors: ['#ccc', '#eee'] },
                              { id: 'gold', name: '金色', colors: ['#FFD700', '#B8860B'] },
                              { id: 'fire', name: '火焰', colors: ['#FF4500', '#B22222'] },
                              { id: 'sunset', name: '日落', colors: ['#FF8C00', '#DC143C'] },
                              { id: 'ocean', name: '海洋', colors: ['#0077BF', '#00BFFF'] },
                              { id: 'forest', name: '森林', colors: ['#228B22', '#32CD32'] },
                              { id: 'purple', name: '紫罗兰', colors: ['#8A2BE2', '#BA55D3'] },
                              { id: 'rose', name: '玫瑰', colors: ['#FF69B4', '#FFB6C1'] }
                            ].map((grad) => (
                              <button
                                key={grad.id || 'none'}
                                onClick={() => { 
                                  setCustomGradient(grad.id); 
                                  if (grad.id) setCustomFontColor(null);
                                }}
                                className={`p-1 rounded-lg border-2 transition-all ${
                                  customGradient === grad.id 
                                    ? 'border-sky-500 ring-1 ring-sky-200' 
                                    : 'border-transparent hover:border-gray-300'
                                }`}
                                title={grad.name}
                              >
                                <div 
                                  className="w-full h-6 rounded"
                                  style={{ 
                                    background: `linear-gradient(135deg, ${grad.colors[0]}, ${grad.colors[1]})` 
                                  }}
                                />
                                <span className="text-[8px] text-gray-500 mt-0.5 block">{grad.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  <motion.button onClick={handleTextRedraw} disabled={isRedrawing || !textInput.trim()}
                    className={`w-full mt-3 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2.5 ${isRedrawing || !textInput.trim() ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-600 text-white shadow-lg hover:shadow-xl hover:shadow-purple-500/25'}`}
                    whileHover={textInput.trim() && !isRedrawing ? { scale: 1.03 } : {}} whileTap={textInput.trim() && !isRedrawing ? { scale: 0.97 } : {}}>
                    {isRedrawing ? (<><Loader2 className="w-4 h-4 animate-spin" />AI重绘中...</>) : (<><Sparkles className="w-4 h-4" />AI智能重绘</>)}
                  </motion.button>
                </>
              )}

              {redrawResult && showResultPreview && (
                <motion.div className="mt-3 pt-3 border-t border-gray-100" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <button onClick={() => setShowResultPreview(!showResultPreview)} className="w-full py-2 rounded-lg bg-sky-50 text-sky-600 text-sm font-medium hover:bg-sky-100 transition-colors flex items-center justify-center gap-2 mb-2">
                    <Eye className="w-4 h-4" />
                    切换预览
                  </button>
                  <button onClick={downloadResult} className="w-full py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-medium shadow-md hover:shadow-lg transition-shadow flex items-center justify-center gap-2">
                    <Download className="w-4 h-4" />
                    下载结果
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {editMode === 'remove' && (
            <motion.div className="glass-card p-6 space-y-5 overflow-hidden relative" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-400 via-orange-500 to-yellow-500" />
              <h3 className="font-semibold text-gray-800 flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-100 to-orange-100 text-red-500 flex items-center justify-center">
                  <Eraser className="w-4 h-4" />
                </span>
                智能消除
              </h3>

              <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl p-4 border border-gray-100/80">
                <label className="block text-xs font-medium text-gray-700 mb-2.5 flex justify-between items-center">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                    笔刷大小
                  </span>
                  <span className="px-2 py-0.5 bg-white rounded-md text-sky-600 font-bold text-xs shadow-sm border border-sky-100">{brushSize}px</span>
                </label>
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="w-full h-2 bg-gradient-to-r from-sky-200 via-sky-300 to-sky-400 rounded-full appearance-none cursor-pointer accent-sky-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-sky-400 [&::-webkit-slider-thumb]:cursor-grab"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1.5 font-medium">
                  <span>精细</span>
                  <span>粗犷</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <motion.button
                  onClick={undoLastStroke}
                  disabled={brushStrokes.length === 0}
                  className={`py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 border ${
                    brushStrokes.length === 0
                      ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
                      : 'bg-amber-50/80 text-amber-600 hover:bg-amber-100 border-amber-200 shadow-sm'
                  }`}
                  whileHover={brushStrokes.length > 0 ? { scale: 1.02 } : {}}
                  whileTap={brushStrokes.length > 0 ? { scale: 0.98 } : {}}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  撤销
                </motion.button>
                <motion.button
                  onClick={clearBrushStrokes}
                  className="py-2.5 rounded-xl bg-sky-50/80 text-sky-600 text-xs font-semibold hover:bg-sky-100 border border-sky-200 shadow-sm transition-all flex items-center justify-center gap-1.5"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  重置
                </motion.button>
              </div>

              {removeError && (
                <motion.div className="p-3 bg-red-50/80 border border-red-200 rounded-xl flex items-start gap-2" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}>
                  <X className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-red-600 leading-relaxed">{removeError}</p>
                </motion.div>
              )}

              <motion.button
                onClick={handleRemove}
                disabled={isRemoving || brushStrokes.length === 0}
                className={`w-full py-3.5 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2.5 ${
                  isRemoving || brushStrokes.length === 0
                    ? 'bg-gray-100 text-gray-350 cursor-not-allowed'
                    : 'bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 text-white shadow-lg shadow-red-500/20 hover:shadow-xl hover:shadow-red-500/30'
                }`}
                whileHover={brushStrokes.length > 0 && !isRemoving ? { scale: 1.02 } : {}}
                whileTap={brushStrokes.length > 0 && !isRemoving ? { scale: 0.98 } : {}}
              >
                {isRemoving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />AI 消除中...</>
                ) : (
                  <><Sparkles className="w-4 h-4" />智能消除</>
                )}
              </motion.button>

              {removeResult && showRemovePreview && (
                <motion.div className="pt-4 border-t border-gray-100 space-y-2.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <button
                    onClick={() => setShowRemovePreview(!showRemovePreview)}
                    className="w-full py-2.5 rounded-xl bg-slate-50 text-sky-600 text-sm font-semibold hover:bg-sky-50 border border-sky-100 transition-all flex items-center justify-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    {showRemovePreview ? '查看原图' : '查看效果'}
                  </button>
                  <button
                    onClick={downloadRemoveResult}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold shadow-md hover:shadow-lg hover:shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    下载结果
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {editMode === 'segment' && segmentMasks.length > 0 && (
            <motion.div className="glass-card p-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <h3 className="font-semibold text-gray-800 mb-3">分割结果</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {segmentMasks.map((mask, index) => (
                  <motion.button key={mask.mask_id} onClick={() => toggleMaskSelection(mask.mask_id)}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-all ${selectedMasks.has(mask.mask_id) ? 'bg-sky-50 border-2 border-sky-500' : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'}`}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${selectedMasks.has(mask.mask_id) ? 'bg-sky-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                      {selectedMasks.has(mask.mask_id) ? <Check className="w-4 h-4" /> : <span className="text-xs">{index + 1}</span>}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700">区域 {index + 1}</p>
                      <p className="text-xs text-gray-500">面积: {(mask.area * 100).toFixed(1)}%</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          <div className="glass-card p-6 overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-600 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4" />
                </span>
                操作历史
              </h3>
            </div>
            <div className="space-y-2.5 relative pl-3 border-l-2 border-gray-100 ml-1.5">
              <div className="relative flex items-center gap-2.5 text-[13px] text-gray-600 py-2 px-3.5 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50/50 border border-green-100/60"><div className="absolute -left-[19px] w-3 h-3 rounded-full bg-green-400 border-2 border-white shadow-sm" /><div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />上传图片</div>
              {segmentMasks.length > 0 && (<div className="relative flex items-center gap-2.5 text-[13px] text-gray-600 py-2 px-3.5 rounded-xl bg-gradient-to-r from-sky-50 to-blue-50/50 border border-sky-100/60"><div className="absolute -left-[19px] w-3 h-3 rounded-full bg-sky-400 border-2 border-white shadow-sm" /><div className="w-2 h-2 rounded-full bg-sky-400 flex-shrink-0" />智能分割 ({segmentMasks.length} 个区域)</div>)}
              {ocrRegions.length > 0 && (<div className="relative flex items-center gap-2.5 text-[13px] text-gray-600 py-2 px-3.5 rounded-xl bg-gradient-to-r from-purple-50 to-violet-50/50 border border-purple-100/60"><div className="absolute -left-[19px] w-3 h-3 rounded-full bg-purple-400 border-2 border-white shadow-sm" /><div className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />OCR识别 ({ocrRegions.length} 个区域)</div>)}
              {redrawResult && (<div className="relative flex items-center gap-2.5 text-[13px] text-gray-600 py-2 px-3.5 rounded-xl bg-gradient-to-r from-green-50 to-lime-50/50 border border-green-100/60"><div className="absolute -left-[19px] w-3 h-3 rounded-full bg-green-500 border-2 border-white shadow-sm" /><div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />文本重绘完成</div>)}
              {removeResult && (<div className="relative flex items-center gap-2.5 text-[13px] text-gray-600 py-2 px-3.5 rounded-xl bg-gradient-to-r from-red-50 to-orange-50/50 border border-red-100/60"><div className="absolute -left-[19px] w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow-sm" /><div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />智能消除完成</div>)}
              {!segmentMasks.length && !ocrRegions.length && !redrawResult && !removeResult && (<div className="text-[13px] text-gray-400 py-3 px-3 text-center">暂无更多操作</div>)}
            </div>
          </div>
        </motion.div>

        <motion.div className="flex-1 glass-card p-6 min-h-[500px] flex items-center justify-center overflow-hidden relative" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.2 }}>
          <motion.div className="relative rounded-xl overflow-hidden shadow-2xl" style={{ transform: `scale(${zoom / 100})`, transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
            onClick={handleImageClick} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
            <img src={displayImageUrl} alt="Editing" className="max-w-full max-h-[600px] object-contain" draggable={false} key={displayImageUrl} />

            {editMode === 'remove' && !showRemovePreview && (
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full cursor-crosshair"
                style={{ maxWidth: '100%', maxHeight: '600px', objectFit: 'contain' }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
            )}

            <div className="absolute inset-0 pointer-events-none opacity-10" style={{ backgroundImage: `linear-gradient(to right, #94a3b8 1px, transparent 1px), linear-gradient(to bottom, #94a3b8 1px, transparent 1px)`, backgroundSize: '20px 20px' }} />

            {editMode === 'segment' && hoverPosition && (
              <div className="absolute pointer-events-none" style={{ left: `${hoverPosition.x}%`, top: `${hoverPosition.y}%`, transform: 'translate(-50%, -50%)' }}>
                <div className="absolute w-8 h-8 border-2 border-sky-400 rounded-full -translate-x-1/2 -translate-y-1/2 opacity-80" />
                <div className="absolute w-2 h-2 bg-sky-500 rounded-full -translate-x-1/2 -translate-y-1/2" />
                <div className="absolute w-6 h-0.5 bg-sky-400/60 -translate-x-1/2 -translate-y-1/2" />
                <div className="absolute w-0.5 h-6 bg-sky-400/60 -translate-x-1/2 -translate-y-1/2" />
              </div>
            )}

            {editMode === 'segment' && selectedMasks.size === 0 && clickPoints.map((point) => (
              <div key={point.id} className="absolute pointer-events-none animate-ping" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%`, transform: 'translate(-50%, -50%)' }}>
                <div className="w-6 h-6 border-2 border-sky-500 rounded-full opacity-60" />
              </div>
            ))}

            {editMode === 'segment' && selectedMasks.size === 0 && clickPoints.map((point) => (
              <div key={`fixed-${point.id}`} className="absolute pointer-events-none" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%`, transform: 'translate(-50%, -50%)' }}>
                <div className="w-4 h-4 border-2 border-sky-500 rounded-full bg-sky-500/20" />
                <div className="absolute w-2 h-2 bg-sky-600 rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
            ))}

            {(editMode === 'segment' || (editMode === 'text' && selectedMasks.size > 0)) && segmentMasks.length > 0 && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {segmentMasks.map((mask) => (
                  selectedMasks.has(mask.mask_id) && (
                    <img key={mask.mask_id} src={`http://localhost:8000${mask.mask_url}`} alt="Mask" className="absolute inset-0 w-full h-full object-fill transition-opacity duration-300" style={{ opacity: editMode === 'text' ? 0.25 : 0.5, mixBlendMode: 'screen', filter: editMode === 'text' ? 'hue-rotate(280deg) saturate(150%) brightness(1.3)' : 'hue-rotate(200deg) saturate(300%) brightness(1.2)' }} />
                  )
                ))}

                {segmentMasks.map((mask) => (
                  selectedMasks.has(mask.mask_id) && mask.contour_svg && (
                    <svg key={`contour-${mask.mask_id}`} className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <path d={mask.contour_svg} fill="none" stroke="#38bdf8" strokeWidth="0.3" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 2px rgba(56, 189, 248, 0.8))' }} />
                    </svg>
                  )
                ))}
              </div>
            )}

            {editMode === 'text' && selectedOCRRegion && !showResultPreview && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div onClick={(e) => { e.stopPropagation(); selectOCRRegion(selectedOCRRegion); }}
                  className="absolute border-[3px] border-amber-400 bg-amber-100/10 z-20 cursor-pointer rounded"
                  style={{ 
                    left: `${selectedOCRRegion.bbox[0] * 100}%`, 
                    top: `${selectedOCRRegion.bbox[1] * 100}%`, 
                    width: `${(selectedOCRRegion.bbox[2] - selectedOCRRegion.bbox[0]) * 100}%`, 
                    height: `${(selectedOCRRegion.bbox[3] - selectedOCRRegion.bbox[1]) * 100}%`,
                    boxShadow: '0 0 0 4px rgba(251, 191, 36, 0.3), 0 8px 32px rgba(251, 191, 36, 0.2)'
                  }}>
                  <div className="absolute -top-9 left-1/2 -translate-x-1/2 px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold rounded-xl shadow-xl whitespace-nowrap">
                    {selectedOCRRegion.text?.trim() || '选中区域'}
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-orange-500 rotate-45" />
                  </div>
                </div>
              </div>
            )}

            {isOCRScanning && (
              <motion.div className="absolute inset-0 z-20 pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="absolute inset-0 bg-black/20 rounded-xl" />
                <motion.div className="absolute left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, transparent, #3b82f6, #8b5cf6, #3b82f6, transparent)', boxShadow: '0 0 20px rgba(59,130,246,0.6), 0 0 40px rgba(139,92,246,0.4)' }}
                  initial={{ top: '0%' }} animate={{ top: ['0%', '100%', '0%'] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} />
                <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/60 backdrop-blur-sm px-5 py-2.5 rounded-full shadow-lg" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
                  <div className="flex items-center gap-2.5">
                    <motion.div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                    <span className="text-white text-sm font-medium whitespace-nowrap">AI 正在识别文字区域...</span>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {isRedrawing && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-30 pointer-events-none">
                <motion.div className="bg-white rounded-xl p-5 shadow-xl flex items-center gap-3" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                  <Loader2 className="w-5 h-5 text-green-500 animate-spin" />
                  <span className="text-sm font-medium text-gray-700">正在重绘文字...</span>
                </motion.div>
              </div>
            )}

            {isSegmenting && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
                <motion.div className="bg-white rounded-xl p-4 flex items-center gap-3 shadow-xl" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                  <Loader2 className="w-5 h-5 text-sky-500 animate-spin" />
                  <span className="text-sm font-medium text-gray-700">正在分割...</span>
                </motion.div>
              </div>
            )}

            {isRemoving && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-30 pointer-events-none">
                <motion.div className="bg-white rounded-xl p-5 shadow-xl flex items-center gap-3" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                  <Loader2 className="w-5 h-5 text-red-500 animate-spin" />
                  <span className="text-sm font-medium text-gray-700">正在智能消除...</span>
                </motion.div>
              </div>
            )}
          </motion.div>

          <AnimatePresence>
            {(segmentError || redrawError || removeError) && (
              <motion.div className="absolute top-4 left-1/2 -translate-x-1/2" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg">
                  <X className="w-4 h-4" />
                  <span className="text-sm">{segmentError || redrawError || removeError}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}
