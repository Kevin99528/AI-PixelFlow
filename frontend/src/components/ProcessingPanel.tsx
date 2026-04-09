import { motion } from 'framer-motion'
import { Sparkles, Cpu, Image as ImageIcon, Wand2 } from 'lucide-react'

export default function ProcessingPanel() {
  const steps = [
    { id: 1, label: '分析图像', icon: ImageIcon, status: 'completed' },
    { id: 2, label: 'AI 处理中', icon: Cpu, status: 'processing' },
    { id: 3, label: '优化细节', icon: Wand2, status: 'pending' },
    { id: 4, label: '生成结果', icon: Sparkles, status: 'pending' },
  ]

  return (
    <div className="flex flex-col items-center justify-center min-h-[500px]">
      {/* 主动画区域 */}
      <motion.div
        className="relative mb-12"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* 外圈光环 */}
        <motion.div
          className="absolute inset-0 rounded-full bg-gradient-to-r from-sky-400/20 to-blue-500/20"
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.5, 0.8, 0.5]
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{ width: 200, height: 200, margin: -28 }}
        />

        {/* 中圈 */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-sky-300/40"
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          style={{ width: 180, height: 180, margin: -18 }}
        >
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 rounded-full bg-sky-400"
              style={{
                top: '50%',
                left: '50%',
                transform: `rotate(${i * 90}deg) translateX(90px) translateY(-50%)`,
              }}
            />
          ))}
        </motion.div>

        {/* 内圈 */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-dashed border-blue-300/60"
          animate={{ rotate: -360 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          style={{ width: 160, height: 160, margin: -8 }}
        />

        {/* 中心图标 */}
        <motion.div
          className="relative w-36 h-36 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-2xl"
          animate={{ 
            boxShadow: [
              '0 0 30px rgba(14, 165, 233, 0.3)',
              '0 0 60px rgba(14, 165, 233, 0.5)',
              '0 0 30px rgba(14, 165, 233, 0.3)'
            ]
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          >
            <Sparkles className="w-14 h-14 text-white" />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* 标题 */}
      <motion.h2
        className="text-2xl font-bold text-gray-800 mb-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        AI 正在处理中
      </motion.h2>
      <motion.p
        className="text-gray-500 mb-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        请稍候，智能算法正在为您优化图像...
      </motion.p>

      {/* 步骤指示器 */}
      <motion.div 
        className="flex items-center gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        {steps.map((step, index) => {
          const Icon = step.icon
          const isCompleted = step.status === 'completed'
          const isProcessing = step.status === 'processing'
          
          return (
            <div key={step.id} className="flex items-center">
              <motion.div
                className={`
                  flex flex-col items-center gap-2
                  ${isProcessing ? 'opacity-100' : isCompleted ? 'opacity-100' : 'opacity-40'}
                `}
                animate={isProcessing ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <div className={`
                  w-12 h-12 rounded-xl flex items-center justify-center
                  ${isCompleted 
                    ? 'bg-green-100 text-green-600' 
                    : isProcessing
                    ? 'bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-400'
                  }
                `}>
                  {isCompleted ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </motion.div>
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <span className={`
                  text-xs font-medium
                  ${isProcessing ? 'text-sky-600' : 'text-gray-500'}
                `}>
                  {step.label}
                </span>
              </motion.div>
              
              {index < steps.length - 1 && (
                <div className="w-12 h-0.5 bg-gray-200 mx-2">
                  <motion.div
                    className="h-full bg-gradient-to-r from-sky-400 to-blue-500"
                    initial={{ width: '0%' }}
                    animate={{ width: isCompleted ? '100%' : '0%' }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </motion.div>

      {/* 提示信息 */}
      <motion.div
        className="mt-12 glass-card px-6 py-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <p className="text-sm text-gray-500 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-sky-500" />
          正在使用本地 GPU 加速处理
        </p>
      </motion.div>
    </div>
  )
}
