import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Download, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut,
  Split,
  CheckCircle2,
  Share2,
  Save
} from 'lucide-react'

interface ResultViewerProps {
  originalImage: string
  resultImage: string
  onReset: () => void
}

export default function ResultViewer({ originalImage, resultImage, onReset }: ResultViewerProps) {
  const [zoom, setZoom] = useState(100)
  const [showSplit, setShowSplit] = useState(false)
  const [splitPosition, setSplitPosition] = useState(50)

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = resultImage
    link.download = `ai-pixelflow-result-${Date.now()}.png`
    link.click()
  }

  return (
    <div className="space-y-6">
      {/* 成功提示 */}
      <motion.div
        className="glass-card p-4 flex items-center justify-between"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 30, delay: 0.2 }}
            className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center"
          >
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </motion.div>
          <div>
            <h3 className="font-semibold text-gray-800">处理完成！</h3>
            <p className="text-sm text-gray-500">您的图片已成功编辑</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <motion.button
            onClick={onReset}
            className="btn-secondary flex items-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <RotateCcw className="w-4 h-4" />
            编辑新图片
          </motion.button>
          <motion.button
            onClick={handleDownload}
            className="btn-gradient flex items-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Download className="w-4 h-4" />
            下载结果
          </motion.button>
        </div>
      </motion.div>

      {/* 工具栏 */}
      <motion.div
        className="flex items-center justify-center gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {/* 缩放控制 */}
        <div className="glass-card px-4 py-2 flex items-center gap-3">
          <motion.button
            onClick={() => setZoom(Math.max(50, zoom - 10))}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <ZoomOut className="w-4 h-4" />
          </motion.button>
          <span className="text-sm font-medium text-gray-600 w-14 text-center">
            {zoom}%
          </span>
          <motion.button
            onClick={() => setZoom(Math.min(200, zoom + 10))}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <ZoomIn className="w-4 h-4" />
          </motion.button>
        </div>

        {/* 对比模式 */}
        <motion.button
          onClick={() => setShowSplit(!showSplit)}
          className={`
            glass-card px-4 py-2 flex items-center gap-2 text-sm font-medium
            transition-all duration-300
            ${showSplit ? 'bg-sky-50 text-sky-600' : 'text-gray-600'}
          `}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Split className="w-4 h-4" />
          {showSplit ? '退出对比' : '对比模式'}
        </motion.button>

        {/* 保存和分享 */}
        <div className="glass-card px-2 py-1 flex items-center gap-1">
          <motion.button
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title="保存到历史记录"
          >
            <Save className="w-4 h-4" />
          </motion.button>
          <div className="w-px h-4 bg-gray-200" />
          <motion.button
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title="分享"
          >
            <Share2 className="w-4 h-4" />
          </motion.button>
        </div>
      </motion.div>

      {/* 图片对比区域 */}
      <motion.div
        className="glass-card p-6 min-h-[500px] flex items-center justify-center"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <div 
          className="relative rounded-xl overflow-hidden shadow-2xl"
          style={{ 
            transform: `scale(${zoom / 100})`,
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          {showSplit ? (
            /* 对比模式 */
            <div 
              className="relative"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const x = ((e.clientX - rect.left) / rect.width) * 100
                setSplitPosition(Math.max(10, Math.min(90, x)))
              }}
            >
              {/* 原图 */}
              <img
                src={originalImage}
                alt="Original"
                className="max-w-full max-h-[600px] object-contain"
              />
              {/* 结果图（遮罩） */}
              <div 
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 ${100 - splitPosition}% 0 0)` }}
              >
                <img
                  src={resultImage}
                  alt="Result"
                  className="max-w-full max-h-[600px] object-contain"
                  style={{ 
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%'
                  }}
                />
              </div>
              {/* 分割线 */}
              <div 
                className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize shadow-lg"
                style={{ left: `${splitPosition}%`, transform: 'translateX(-50%)' }}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center">
                  <Split className="w-4 h-4 text-gray-600" />
                </div>
              </div>
              {/* 标签 */}
              <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-black/50 text-white text-sm">
                原图
              </div>
              <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-sky-500/80 text-white text-sm">
                结果
              </div>
            </div>
          ) : (
            /* 单图模式 */
            <div className="relative">
              <img
                src={resultImage}
                alt="Result"
                className="max-w-full max-h-[600px] object-contain"
              />
              <motion.div
                className="absolute bottom-4 right-4 px-3 py-1.5 rounded-full bg-gradient-to-r from-sky-500 to-blue-500 text-white text-sm font-medium shadow-lg"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                AI 处理结果
              </motion.div>
            </div>
          )}
        </div>
      </motion.div>

      {/* 图片信息 */}
      <motion.div
        className="grid grid-cols-3 gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        {[
          { label: '处理方式', value: 'AI 智能编辑' },
          { label: '处理时间', value: '2.3 秒' },
          { label: '输出格式', value: 'PNG' },
        ].map((info, index) => (
          <motion.div
            key={info.label}
            className="glass-card p-4 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + index * 0.1 }}
          >
            <p className="text-xs text-gray-500 mb-1">{info.label}</p>
            <p className="font-semibold text-gray-800">{info.value}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
