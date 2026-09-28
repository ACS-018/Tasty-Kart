import { cn } from '@/lib/utils'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
}

const variants = {
  primary:   'bg-[#B32B2C] hover:bg-[#9b1d1d] text-white shadow-sm',
  secondary: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-200 dark:border-gray-700',
  outline:   'border border-[#B32B2C] text-[#B32B2C] hover:bg-red-50 dark:hover:bg-red-900/10',
  ghost:     'hover:bg-gray-100 text-gray-700 dark:hover:bg-gray-800 dark:text-gray-300',
  danger:    'bg-red-500 hover:bg-red-600 text-white shadow-sm',
  success:   'bg-green-500 hover:bg-green-600 text-white shadow-sm',
}

const sizes = {
  xs: 'px-2.5 py-1 text-xs rounded-md gap-1',
  sm: 'px-3 py-1.5 text-sm rounded-lg gap-1.5',
  md: 'px-4 py-2 text-sm rounded-lg gap-2',
  lg: 'px-6 py-2.5 text-base rounded-xl gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  ...props
}, ref) => {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-150',
        'focus:outline-none focus:ring-2 focus:ring-[#B32B2C]/30 focus:ring-offset-1',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      ) : icon}
      {children}
    </button>
  )
})

Button.displayName = 'Button'
