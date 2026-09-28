import { cn } from '@/lib/utils'
import type { HTMLAttributes } from 'react'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'primary'
}

const variantClasses = {
  default: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  primary: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  danger: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  muted: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
}

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium',
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
    pending:   { label: 'Pending',   variant: 'warning' },
    accepted:  { label: 'Accepted',  variant: 'info' },
    preparing: { label: 'Preparing', variant: 'info' },
    picked:    { label: 'Picked Up', variant: 'default' },
    delivered: { label: 'Delivered', variant: 'success' },
    cancelled: { label: 'Cancelled', variant: 'danger' },
    refunded:  { label: 'Refunded',  variant: 'muted' },
    active:    { label: 'Active',    variant: 'success' },
    inactive:  { label: 'Inactive',  variant: 'muted' },
    blocked:   { label: 'Blocked',   variant: 'danger' },
    online:    { label: 'Online',    variant: 'success' },
    offline:   { label: 'Offline',   variant: 'muted' },
    busy:      { label: 'Busy',      variant: 'warning' },
    available: { label: 'Available', variant: 'info' },
    expired:   { label: 'Expired',   variant: 'danger' },
    published: { label: 'Published', variant: 'success' },
    reported:  { label: 'Reported',  variant: 'danger' },
    success:   { label: 'Success',   variant: 'success' },
  }
  const s = map[status] ?? { label: status, variant: 'default' as const }
  return <Badge variant={s.variant}>{s.label}</Badge>
}
