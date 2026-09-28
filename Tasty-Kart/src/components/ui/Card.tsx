import { cn } from '@/lib/utils'
import type { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function Card({ hover, padding = 'md', className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800',
        'shadow-sm',
        hover && 'card-hover cursor-pointer',
        padding === 'none' && 'p-0',
        padding === 'sm' && 'p-3',
        padding === 'md' && 'p-5',
        padding === 'lg' && 'p-7',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-base font-semibold text-gray-900 dark:text-white', className)} {...props}>
      {children}
    </h3>
  )
}

export function CardDescription({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-sm text-gray-500 dark:text-gray-400 mt-0.5', className)} {...props}>
      {children}
    </p>
  )
}
