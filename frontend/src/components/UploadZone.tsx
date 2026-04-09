import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Image as ImageIcon, X, CheckCircle2 } from 'lucide-react'

interface UploadZoneProps {
  onUpload: (imageUrl: string) => void
}

export default function UploadZone({ onUpload }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const processFile = async (file: File) => {
    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp']
    if (!allowedTypes.includes(file.type)) {
      alert('请上传 JPG、PNG、WebP 或 BMP 格式的图片')
      return
    }

    // 验证文件大小 (最大 100MB)
    const maxSize = 100 * 1024 * 1024
    if (file.size > maxSize) {
      alert('文件大小不能超过 100MB')
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      // 创建 FormData
      const formData = new FormData()
      formData.append('file', file)

      // 上传到后端
      const response = await fetch('http://localhost:8000/api/v1/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('上传失败')
      }

      const result = await response.json()
      
      if (result.success) {
        setUploadProgress(100)
        setPreviewUrl(`http://localhost:8000${result.data.url}`)
        
        setTimeout(() => {
          onUpload(`http://localhost:8000${result.data.url}`)
        }, 500)
      } else {
        throw new Error(result.message || '上传失败')
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('图片上传失败，请重试')
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      processFile(files[0])
    }
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      processFile(files[0])
    }
  }

  const clearPreview = () => {
    setPreviewUrl(null)
    setIsUploading(false)
    setUploadProgress(0)
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <AnimatePresence mode="wait">
        {!previewUrl ? (
          <motion.div
            key="upload-area"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <label
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                relative flex flex-col items-center justify-center
                w-full h-96 rounded-2xl border-2 border-dashed
                cursor-pointer overflow-hidden
                transition-all duration-400 ease-smooth
                ${isDragging 
                  ? 'border-sky-400 bg-sky-100/60 scale-[1.02] shadow-[0_0_30px_rgba(14,165,233,0.2)]' 
                  : 'border-sky-300/60 bg-white/40 hover:border-sky-400/80 hover:bg-sky-50/60'
                }
              `}
            >
              {/* 背景装饰 */}
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-sky-200/40 to-blue-200/40 rounded-full blur-3xl" />
                <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-br from-amber-200/30 to-orange-200/30 rounded-full blur-3xl" />
              </div>

              <input
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp,image/bmp"
                onChange={handleFileInput}
              />

              <motion.div
                className="relative z-10 flex flex-col items-center"
                animate={isDragging ? { y: -5 } : { y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <motion.div
                  className={`
                    w-20 h-20 rounded-2xl flex items-center justify-center mb-4
                    transition-all duration-300
                    ${isDragging 
                      ? 'bg-gradient-to-br from-sky-400 to-blue-500 shadow-lg' 
                      : 'bg-gradient-to-br from-sky-100 to-blue-100'
                    }
                  `}
                  whileHover={{ scale: 1.05, rotate: 5 }}
                  animate={isDragging ? { scale: 1.1 } : { scale: 1 }}
                >
                  <Upload className={`w-10 h-10 ${isDragging ? 'text-white' : 'text-sky-500'}`} />
                </motion.div>

                <p className="text-lg font-medium text-gray-700 mb-2">
                  {isDragging ? '松开以上传图片' : '点击或拖拽上传图片'}
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  支持 JPG、PNG、WebP、BMP 格式，最大 100MB
                </p>

                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" />
                    4K 高清支持
                  </span>
                  <span className="w-1 h-1 rounded-full bg-gray-300" />
                  <span>自动处理 EXIF</span>
                  <span className="w-1 h-1 rounded-full bg-gray-300" />
                  <span>本地处理</span>
                </div>
              </motion.div>

              {/* 拖拽时的波纹效果 */}
              <AnimatePresence>
                {isDragging && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.5, opacity: 0 }}
                    className="absolute inset-0 bg-gradient-to-br from-sky-100/50 to-blue-100/50"
                    transition={{ duration: 0.3 }}
                  />
                )}
              </AnimatePresence>
            </label>
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="glass-card p-6"
          >
            <div className="flex items-start gap-6">
              {/* 预览图 */}
              <motion.div 
                className="relative w-48 h-48 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                {isUploading && uploadProgress < 100 && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="text-white text-center">
                      <div className="text-2xl font-bold mb-1">{uploadProgress}%</div>
                      <div className="text-xs opacity-80">上传中...</div>
                    </div>
                  </div>
                )}
                {uploadProgress === 100 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute inset-0 bg-black/40 flex items-center justify-center"
                  >
                    <CheckCircle2 className="w-12 h-12 text-green-400" />
                  </motion.div>
                )}
              </motion.div>

              {/* 文件信息 */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">图片预览</h3>
                  <motion.button
                    onClick={clearPreview}
                    className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <X className="w-5 h-5" />
                  </motion.button>
                </div>

                {/* 进度条 */}
                <div className="mb-4">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-sky-400 to-blue-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                  {uploadProgress < 100 
                    ? '正在上传图片，请稍候...' 
                    : '上传完成！正在进入编辑界面...'}
                </p>

                <div className="flex gap-3">
                  <motion.button
                    onClick={clearPreview}
                    className="btn-secondary text-sm"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    重新选择
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
