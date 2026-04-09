import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Upload, 
  Image as ImageIcon, 
  Wand2, 
  Eraser, 
  Download,
  Sparkles,
  CheckCircle2,
  ArrowRight
} from 'lucide-react'
import UploadZone from './components/UploadZone'
import ImageEditor from './components/ImageEditor'
import ProcessingPanel from './components/ProcessingPanel'
import ResultViewer from './components/ResultViewer'

type AppState = 'upload' | 'edit' | 'processing' | 'result'

function App() {
  const [appState, setAppState] = useState<AppState>('upload')
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [resultImage, setResultImage] = useState<string | null>(null)

  const handleImageUpload = (imageUrl: string) => {
    setUploadedImage(imageUrl)
    setAppState('edit')
  }

  const handleStartProcessing = () => {
    setAppState('processing')
    // 模拟处理过程
    setTimeout(() => {
      setResultImage(uploadedImage) // 暂时使用原图作为结果
      setAppState('result')
    }, 3000)
  }

  const handleReset = () => {
    setUploadedImage(null)
    setResultImage(null)
    setAppState('upload')
  }

  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-amber-50">
      {/* 导航栏 */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        className="fixed top-0 left-0 right-0 z-50 glass-card mx-4 mt-4"
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <motion.div 
            className="flex items-center gap-3"
            whileHover={{ scale: 1.02 }}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gradient">AI PixelFlow</h1>
              <p className="text-xs text-gray-500">本地智能图像编辑</p>
            </div>
          </motion.div>

          {/* 步骤指示器 */}
          <div className="hidden md:flex items-center gap-2">
            {[
              { id: 'upload', label: '上传图片', icon: Upload },
              { id: 'edit', label: '编辑处理', icon: Wand2 },
              { id: 'result', label: '查看结果', icon: CheckCircle2 },
            ].map((step, index) => {
              const Icon = step.icon
              const isActive = appState === step.id || 
                (step.id === 'edit' && appState === 'processing')
              const isCompleted = 
                (step.id === 'upload' && uploadedImage) ||
                (step.id === 'edit' && resultImage)
              
              return (
                <div key={step.id} className="flex items-center">
                  <motion.div
                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 ${
                      isActive 
                        ? 'bg-gradient-to-r from-sky-100 to-blue-100 text-blue-700' 
                        : isCompleted
                        ? 'text-green-600'
                        : 'text-gray-400'
                    }`}
                    animate={isActive ? { scale: 1.05 } : { scale: 1 }}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{step.label}</span>
                  </motion.div>
                  {index < 2 && (
                    <ArrowRight className="w-4 h-4 text-gray-300 mx-2" />
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex items-center gap-3">
            <button className="btn-secondary text-sm">
              帮助
            </button>
          </div>
        </div>
      </motion.nav>

      {/* 主内容区 */}
      <main className="min-h-screen px-4 flex items-center justify-center">
        <div className="max-w-6xl mx-auto w-full">
          <AnimatePresence mode="wait">
            {appState === 'upload' && (
              <motion.div
                key="upload"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              >
                {/* 欢迎区域 */}
                <motion.div
                  className="text-center mb-12"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  <motion.div
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-sky-100 to-amber-100 text-blue-700 text-sm font-medium mb-8"
                    whileHover={{ scale: 1.05 }}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>AI 驱动的本地图像编辑工具</span>
                  </motion.div>
                  <h2 className="text-4xl md:text-5xl font-bold text-gray-800">
                    智能图像编辑，<span className="text-gradient">触手可及</span>
                  </h2>
                </motion.div>

                {/* 功能卡片 */}
                <motion.div
                  className="grid md:grid-cols-3 gap-8 mb-16 mt-24"
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                >
                  {[
                    {
                      icon: ImageIcon,
                      title: '智能上传',
                      desc: '支持 4K 高清图片，自动处理 EXIF 旋转信息',
                      color: 'from-sky-400 to-blue-500'
                    },
                    {
                      icon: Wand2,
                      title: '文本重绘',
                      desc: '自动匹配字体、光影、透视与背景纹理',
                      color: 'from-blue-400 to-indigo-500'
                    },
                    {
                      icon: Eraser,
                      title: '智能消除',
                      desc: '一键移除物体并智能修补背景',
                      color: 'from-indigo-400 to-purple-500'
                    },
                  ].map((feature, index) => (
                    <motion.div
                      key={feature.title}
                      className="glass-card p-8 hover-lift"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
                      whileHover={{ y: -4 }}
                    >
                      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 shadow-lg`}>
                        <feature.icon className="w-7 h-7 text-white" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-800 mb-4">
                        {feature.title}
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        {feature.desc}
                      </p>
                    </motion.div>
                  ))}
                </motion.div>

                {/* 上传区域 */}
                <motion.div
                  className="flex justify-center mt-24"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.6 }}
                >
                  <div className="w-full max-w-4xl">
                    <UploadZone onUpload={handleImageUpload} />
                  </div>
                </motion.div>
              </motion.div>
            )}

            {appState === 'edit' && uploadedImage && (
              <motion.div
                key="edit"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              >
                <ImageEditor 
                  imageUrl={uploadedImage}
                  onProcess={handleStartProcessing}
                  onBack={handleReset}
                />
              </motion.div>
            )}

            {appState === 'processing' && (
              <motion.div
                key="processing"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              >
                <ProcessingPanel />
              </motion.div>
            )}

            {appState === 'result' && resultImage && (
              <motion.div
                key="result"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              >
                <ResultViewer 
                  originalImage={uploadedImage!}
                  resultImage={resultImage}
                  onReset={handleReset}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* 页脚 */}
      <motion.footer 
        className="py-6 text-center text-gray-500 text-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <p>AI PixelFlow © 2026 - 本地智能图像编辑系统</p>
      </motion.footer>
    </div>
  )
}

export default App
