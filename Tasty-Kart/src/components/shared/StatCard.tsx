import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  change?: number
  changeLabel?: string
  color?: 'red' | 'green' | 'blue' | 'amber' | 'purple' | 'indigo' | 'teal' | 'rose'
  index?: number
  prefix?: string
  suffix?: string
  onClick?: () => void
}

const colorMap = {
  red:    { bg: 'bg-red-100 dark:bg-red-900/20',    icon: 'text-[#B32B2C]',  gradient: 'from-red-500 to-red-600', ring: 'hover:border-red-200 dark:hover:border-red-900/50' },
  green:  { bg: 'bg-green-100 dark:bg-green-900/20', icon: 'text-green-600', gradient: 'from-green-500 to-green-600', ring: 'hover:border-green-200 dark:hover:border-green-900/50' },
  blue:   { bg: 'bg-blue-100 dark:bg-blue-900/20',  icon: 'text-blue-600',   gradient: 'from-blue-500 to-blue-600', ring: 'hover:border-blue-200 dark:hover:border-blue-900/50' },
  amber:  { bg: 'bg-amber-100 dark:bg-amber-900/20', icon: 'text-amber-600', gradient: 'from-amber-500 to-amber-600', ring: 'hover:border-amber-200 dark:hover:border-amber-900/50' },
  purple: { bg: 'bg-purple-100 dark:bg-purple-900/20', icon: 'text-purple-600', gradient: 'from-purple-500 to-purple-600', ring: 'hover:border-purple-200 dark:hover:border-purple-900/50' },
  indigo: { bg: 'bg-indigo-100 dark:bg-indigo-900/20', icon: 'text-indigo-600', gradient: 'from-indigo-500 to-indigo-600', ring: 'hover:border-indigo-200 dark:hover:border-indigo-900/50' },
  teal:   { bg: 'bg-teal-100 dark:bg-teal-900/20',  icon: 'text-teal-600',   gradient: 'from-teal-500 to-teal-600', ring: 'hover:border-teal-200 dark:hover:border-teal-900/50' },
  rose:   { bg: 'bg-rose-100 dark:bg-rose-900/20',  icon: 'text-rose-600',   gradient: 'from-rose-500 to-rose-600', ring: 'hover:border-rose-200 dark:hover:border-rose-900/50' },
}

export function StatCard({ title, value, icon: Icon, change, changeLabel, color = 'red', index = 0, prefix = '', suffix = '', onClick }: StatCardProps) {
  const colors = colorMap[color]
  const isPositive = change !== undefined && change >= 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={onClick ? { y: -3, transition: { duration: 0.2 } } : undefined}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      onClick={onClick}
      className={cn(
        'bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-md group relative overflow-hidden',
        onClick && colors.ring
      )}
    >
      {onClick && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-[10px] text-gray-400 font-medium bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">View</span>
        </div>
      )}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1.5">
            {prefix}{typeof value === 'number' ? value.toLocaleString('en-IN') : value}{suffix}
          </p>
          {change !== undefined && (
            <div className={cn('flex items-center gap-1 mt-2 text-xs font-medium', isPositive ? 'text-green-600' : 'text-red-500')}>
              {isPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              <span>{isPositive ? '+' : ''}{change}%</span>
              {changeLabel && <span className="text-gray-400 font-normal">{changeLabel}</span>}
            </div>
          )}
        </div>
        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110', colors.bg)}>
          <Icon size={22} className={colors.icon} />
        </div>
      </div>
    </motion.div>
  )
}
