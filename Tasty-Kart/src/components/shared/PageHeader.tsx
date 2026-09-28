import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  breadcrumb?: Array<{ label: string; path?: string }>
}

export function PageHeader({ title, description, actions, breadcrumb }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
      <div>
        {breadcrumb && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1.5">
            {breadcrumb.map((b, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span>/</span>}
                <span className={i === breadcrumb.length - 1 ? 'text-gray-900 dark:text-white font-medium' : 'hover:text-gray-700 cursor-pointer'}>
                  {b.label}
                </span>
              </span>
            ))}
          </div>
        )}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
        {description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  )
}
