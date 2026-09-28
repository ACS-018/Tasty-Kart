import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
}

interface ToastContextType {
  toasts: Toast[]
  toast: (type: ToastType, title: string, message?: string) => void
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
  warning: (title: string, message?: string) => void
  info: (title: string, message?: string) => void
}

const ToastContext = createContext<ToastContextType>({
  toasts: [],
  toast: () => {},
  success: () => {},
  error: () => {},
  warning: () => {},
  info: () => {},
})

const icons = {
  success: <CheckCircle size={18} className="text-green-500" />,
  error:   <XCircle size={18} className="text-red-500" />,
  warning: <AlertCircle size={18} className="text-amber-500" />,
  info:    <Info size={18} className="text-blue-500" />,
}

const bgColors = {
  success: 'border-l-green-500',
  error:   'border-l-red-500',
  warning: 'border-l-amber-500',
  info:    'border-l-blue-500',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const remove = useCallback((id: string) => {
    setToasts(t => t.filter(toast => toast.id !== id))
  }, [])

  const toast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(t => [...t, { id, type, title, message }])
    setTimeout(() => remove(id), 4000)
  }, [remove])

  const success = useCallback((t: string, m?: string) => toast('success', t, m), [toast])
  const error   = useCallback((t: string, m?: string) => toast('error', t, m), [toast])
  const warning = useCallback((t: string, m?: string) => toast('warning', t, m), [toast])
  const info    = useCallback((t: string, m?: string) => toast('info', t, m), [toast])

  return (
    <ToastContext.Provider value={{ toasts, toast, success, error, warning, info }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100 }}
              className={cn(
                'flex items-start gap-3 p-4 bg-white dark:bg-gray-900 rounded-xl shadow-lg',
                'border border-gray-100 dark:border-gray-800 border-l-4',
                bgColors[t.type]
              )}
            >
              <div className="shrink-0 mt-0.5">{icons[t.type]}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{t.title}</p>
                {t.message && <p className="text-xs text-gray-500 mt-0.5">{t.message}</p>}
              </div>
              <button onClick={() => remove(t.id)} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
