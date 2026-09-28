/**
 * PROTECTED ACTION COMPONENT
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Renders UI elements conditionally based on user permissions.
 * Usage: <ProtectedAction permission="CREATE_CITY"><Button>Create</Button></ProtectedAction>
 */

import { ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'
import { type Permission } from '@/lib/permissions'

interface ProtectedActionProps {
  permission?: Permission
  permissions?: Permission[]
  requireAll?: boolean
  children: ReactNode
  fallback?: ReactNode
  className?: string
  debugLabel?: string
}

/**
 * Renders children only if user has the required permission(s).
 * Otherwise renders fallback (default: null).
 * 
 * @param permission - Single permission to check
 * @param permissions - Multiple permissions to check (uses hasAnyPermission by default)
 * @param requireAll - If true with permissions array, requires ALL permissions (hasAllPermissions)
 * @param children - Element to render if permission granted
 * @param fallback - Element to render if permission denied (default: null)
 * @param className - CSS class to apply to wrapper
 * @param debugLabel - Label for debugging (logged to console in dev)
 */
export function ProtectedAction({
  permission,
  permissions = [],
  requireAll = false,
  children,
  fallback = null,
  className = '',
  debugLabel,
}: ProtectedActionProps) {
  const auth = useAuth()

  let hasAccess = false

  if (permission) {
    hasAccess = auth.hasPermission(permission)
    if (debugLabel && import.meta.env.DEV) {
      console.debug(`[ProtectedAction: ${debugLabel}] Permission: ${permission} -> ${hasAccess}`)
    }
  } else if (permissions.length > 0) {
    if (requireAll) {
      hasAccess = auth.hasAllPermissions(permissions)
      if (debugLabel && import.meta.env.DEV) {
        console.debug(`[ProtectedAction: ${debugLabel}] Permissions (all): ${permissions.join(', ')} -> ${hasAccess}`)
      }
    } else {
      hasAccess = auth.hasAnyPermission(permissions)
      if (debugLabel && import.meta.env.DEV) {
        console.debug(`[ProtectedAction: ${debugLabel}] Permissions (any): ${permissions.join(', ')} -> ${hasAccess}`)
      }
    }
  }

  if (!hasAccess) {
    return fallback
  }

  return className ? <div className={className}>{children}</div> : children
}

/**
 * Wrapper for buttons - disables instead of hiding
 * Useful for maintaining layout and showing tooltip about lack of permission
 */
interface ProtectedButtonProps {
  permission?: Permission
  permissions?: Permission[]
  requireAll?: boolean
  children: ReactNode
  tooltip?: string
  className?: string
  debugLabel?: string
}

export function ProtectedButton({
  permission,
  permissions = [],
  requireAll = false,
  children,
  tooltip,
  className = '',
  debugLabel,
}: ProtectedButtonProps) {
  const auth = useAuth()

  let hasAccess = false

  if (permission) {
    hasAccess = auth.hasPermission(permission)
  } else if (permissions.length > 0) {
    hasAccess = requireAll
      ? auth.hasAllPermissions(permissions)
      : auth.hasAnyPermission(permissions)
  }

  // Assuming children is a button element, clone it with disabled state
  // This is a simplified version - in real usage you might want to handle different element types
  const buttonProps: any = {}
  if (!hasAccess) {
    buttonProps.disabled = true
    buttonProps.title = tooltip || 'You do not have permission for this action'
    buttonProps.className = `${className} opacity-50 cursor-not-allowed`
  } else {
    buttonProps.className = className
  }

  return children
}

/**
 * Wrapper for menu items - hides items user can't access
 */
interface ProtectedMenuItemProps {
  permission?: Permission
  permissions?: Permission[]
  requireAll?: boolean
  children: ReactNode
  debugLabel?: string
}

export function ProtectedMenuItem({
  permission,
  permissions = [],
  requireAll = false,
  children,
  debugLabel,
}: ProtectedMenuItemProps) {
  const auth = useAuth()

  let hasAccess = false

  if (permission) {
    hasAccess = auth.hasPermission(permission)
  } else if (permissions.length > 0) {
    hasAccess = requireAll
      ? auth.hasAllPermissions(permissions)
      : auth.hasAnyPermission(permissions)
  }

  if (debugLabel && import.meta.env.DEV) {
    console.debug(`[ProtectedMenuItem: ${debugLabel}] Access: ${hasAccess}`)
  }

  return hasAccess ? children : null
}
