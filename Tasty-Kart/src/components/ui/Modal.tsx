import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  className?: string
}

const sizes = {
  sm:   'max-w-sm',
  md:   'max-w-lg',
  lg:   'max-w-2xl',
  xl:   'max-w-4xl',
  full: 'max-w-7xl',
}

export function Modal({ open, onClose, title, description, children, size = 'md', className }: ModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'relative w-full bg-white dark:bg-gray-900 rounded-2xl shadow-2xl',
              'border border-gray-100 dark:border-gray-800',
              'max-h-[90vh] flex flex-col',
              sizes[size],
              className
            )}
          >
            {title && (
              <div className="flex items-start justify-between p-6 border-b border-gray-100 dark:border-gray-800 shrink-0">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
                  {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ml-4 shrink-0"
                >
                  <X size={18} />
                </button>
              </div>
            )}
            <div className="overflow-y-auto flex-1 p-6">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  side?: 'right' | 'left'
  width?: string
}

export function Drawer({ open, onClose, title, children, side = 'right', width = 'w-[480px]' }: DrawerProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: side === 'right' ? '100%' : '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: side === 'right' ? '100%' : '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={cn(
              'relative bg-white dark:bg-gray-900 shadow-2xl flex flex-col h-full',
              'border-l border-gray-100 dark:border-gray-800',
              side === 'right' ? 'ml-auto' : 'mr-auto',
              width,
              'max-w-full'
            )}
          >
            {title && (
              <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800 shrink-0">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            )}
            <div className="overflow-y-auto flex-1 p-5">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  variant?: 'danger' | 'warning' | 'default'
  loading?: boolean
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'danger', loading }: ConfirmDialogProps) {
  const btnClass = variant === 'danger'
    ? 'bg-red-500 hover:bg-red-600'
    : variant === 'warning'
    ? 'bg-amber-500 hover:bg-amber-600'
    : 'bg-[#B32B2C] hover:bg-[#9b1d1d]'

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="text-center">
        <div className={cn(
          'mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center',
          variant === 'danger' ? 'bg-red-100' : 'bg-amber-100'
        )}>
          <span className="text-2xl">{variant === 'danger' ? '🗑️' : '⚠️'}</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn('px-5 py-2 rounded-lg text-white text-sm font-medium transition-colors', btnClass)}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
