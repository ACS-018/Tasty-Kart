import { cn } from '@/lib/utils'
import { type InputHTMLAttributes, forwardRef } from 'react'
import type { ReactNode } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label, error, leftIcon, rightIcon, className, ...props
}, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full rounded-lg border bg-white dark:bg-gray-900 px-3 py-2 text-sm',
            'border-gray-200 dark:border-gray-700',
            'text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600',
            'focus:outline-none focus:ring-2 focus:ring-[#B32B2C]/30 focus:border-[#B32B2C]',
            'transition-colors duration-150',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            leftIcon && 'pl-9',
            rightIcon && 'pr-9',
            error && 'border-red-500 focus:ring-red-200',
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            {rightIcon}
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
})
Input.displayName = 'Input'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label, error, className, children, ...props
}, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}
      <select
        ref={ref}
        className={cn(
          'w-full rounded-lg border bg-white dark:bg-gray-900 px-3 py-2 text-sm',
          'border-gray-200 dark:border-gray-700',
          'text-gray-900 dark:text-gray-100',
          'focus:outline-none focus:ring-2 focus:ring-[#B32B2C]/30 focus:border-[#B32B2C]',
          'transition-colors duration-150',
          error && 'border-red-500',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
})
Select.displayName = 'Select'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  label, error, className, ...props
}, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        rows={4}
        className={cn(
          'w-full rounded-lg border bg-white dark:bg-gray-900 px-3 py-2 text-sm',
          'border-gray-200 dark:border-gray-700',
          'text-gray-900 dark:text-gray-100 placeholder:text-gray-400',
          'focus:outline-none focus:ring-2 focus:ring-[#B32B2C]/30 focus:border-[#B32B2C]',
          'transition-colors duration-150 resize-none',
          error && 'border-red-500',
          className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
})
Textarea.displayName = 'Textarea'
