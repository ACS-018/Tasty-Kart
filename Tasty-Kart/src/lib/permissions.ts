/**
 * ADMIN PERMISSIONS & ROLE-BASED ACCESS CONTROL
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Defines all admin roles and their permissions for the production system.
 * Used for:
 * - UI button/menu visibility
 * - Form field access control
 * - Action enablement/disablement
 * - Firestore security rules (backend)
 */

// ─── Type Definitions ───────────────────────────────────────────────────────

export type AdminRole = 'SUPER_ADMIN' | 'OPERATIONS_ADMIN' | 'FINANCE_ADMIN' | 'SUPPORT_ADMIN'

/**
 * Permission actions that can be controlled
 */
export type Permission = 
  // Cities
  | 'CREATE_CITY' | 'EDIT_CITY' | 'DELETE_CITY' | 'VIEW_CITIES'
  
  // Zones
  | 'CREATE_ZONE' | 'EDIT_ZONE' | 'DELETE_ZONE' | 'VIEW_ZONES'
  
  // Slots
  | 'CREATE_SLOT' | 'EDIT_SLOT' | 'DELETE_SLOT' | 'DUPLICATE_SLOT' | 'CANCEL_SLOT' | 'VIEW_SLOTS'
  
  // Slot Bookings
  | 'VIEW_SLOT_BOOKINGS' | 'MANAGE_BOOKINGS'
  
  // Earning Rules
  | 'CREATE_EARNING_RULE' | 'EDIT_EARNING_RULE' | 'DELETE_EARNING_RULE' | 'VIEW_EARNING_RULES'
  
  // Partner Levels
  | 'CREATE_PARTNER_LEVEL' | 'EDIT_PARTNER_LEVEL' | 'DELETE_PARTNER_LEVEL' | 'VIEW_PARTNER_LEVELS'
  
  // Delivery Partners
  | 'VIEW_DELIVERY_PARTNERS' | 'EDIT_DELIVERY_PARTNER' | 'APPROVE_PARTNER' | 'BLOCK_PARTNER' | 'MANAGE_PARTNER_LEVEL'
  
  // Orders
  | 'VIEW_ORDERS' | 'EDIT_ORDER_STATUS' | 'ASSIGN_ORDER' | 'CANCEL_ORDER' | 'REFUND_ORDER'
  
  // Wallet & Transactions
  | 'VIEW_WALLET_TRANSACTIONS' | 'CREATE_WALLET_ADJUSTMENT' | 'CREATE_DEDUCTION' | 'REVERSE_TRANSACTION'
  
  // Payouts
  | 'VIEW_PAYOUTS' | 'APPROVE_PAYOUT' | 'REJECT_PAYOUT' | 'PROCESS_PAYOUT' | 'COMPLETE_PAYOUT'
  
  // Incentives
  | 'CREATE_INCENTIVE_CAMPAIGN' | 'EDIT_INCENTIVE_CAMPAIGN' | 'VIEW_INCENTIVE_CAMPAIGNS' | 'VIEW_INCENTIVE_PROGRESS'
  
  // Reports & Analytics
  | 'VIEW_REPORTS' | 'VIEW_ANALYTICS' | 'EXPORT_REPORTS'
  
  // Audit Logs
  | 'VIEW_AUDIT_LOGS'
  
  // Settings
  | 'VIEW_SETTINGS' | 'EDIT_SETTINGS' | 'MANAGE_ADMIN_USERS'

// ─── Role Definitions ───────────────────────────────────────────────────────

/**
 * Permission matrix for each admin role
 */
export const rolePermissions: Record<AdminRole, Permission[]> = {
  // SUPER_ADMIN: All permissions
  SUPER_ADMIN: [
    // Cities
    'CREATE_CITY', 'EDIT_CITY', 'DELETE_CITY', 'VIEW_CITIES',
    // Zones
    'CREATE_ZONE', 'EDIT_ZONE', 'DELETE_ZONE', 'VIEW_ZONES',
    // Slots
    'CREATE_SLOT', 'EDIT_SLOT', 'DELETE_SLOT', 'DUPLICATE_SLOT', 'CANCEL_SLOT', 'VIEW_SLOTS',
    // Slot Bookings
    'VIEW_SLOT_BOOKINGS', 'MANAGE_BOOKINGS',
    // Earning Rules
    'CREATE_EARNING_RULE', 'EDIT_EARNING_RULE', 'DELETE_EARNING_RULE', 'VIEW_EARNING_RULES',
    // Partner Levels
    'CREATE_PARTNER_LEVEL', 'EDIT_PARTNER_LEVEL', 'DELETE_PARTNER_LEVEL', 'VIEW_PARTNER_LEVELS',
    // Delivery Partners
    'VIEW_DELIVERY_PARTNERS', 'EDIT_DELIVERY_PARTNER', 'APPROVE_PARTNER', 'BLOCK_PARTNER', 'MANAGE_PARTNER_LEVEL',
    // Orders
    'VIEW_ORDERS', 'EDIT_ORDER_STATUS', 'ASSIGN_ORDER', 'CANCEL_ORDER', 'REFUND_ORDER',
    // Wallet & Transactions
    'VIEW_WALLET_TRANSACTIONS', 'CREATE_WALLET_ADJUSTMENT', 'CREATE_DEDUCTION', 'REVERSE_TRANSACTION',
    // Payouts
    'VIEW_PAYOUTS', 'APPROVE_PAYOUT', 'REJECT_PAYOUT', 'PROCESS_PAYOUT', 'COMPLETE_PAYOUT',
    // Incentives
    'CREATE_INCENTIVE_CAMPAIGN', 'EDIT_INCENTIVE_CAMPAIGN', 'VIEW_INCENTIVE_CAMPAIGNS', 'VIEW_INCENTIVE_PROGRESS',
    // Reports
    'VIEW_REPORTS', 'VIEW_ANALYTICS', 'EXPORT_REPORTS',
    // Audit Logs
    'VIEW_AUDIT_LOGS',
    // Settings
    'VIEW_SETTINGS', 'EDIT_SETTINGS', 'MANAGE_ADMIN_USERS',
  ],

  // OPERATIONS_ADMIN: Cities, Zones, Slots, Orders, Delivery Partners
  OPERATIONS_ADMIN: [
    // Cities
    'VIEW_CITIES', 'CREATE_CITY', 'EDIT_CITY', 'DELETE_CITY',
    // Zones
    'VIEW_ZONES', 'CREATE_ZONE', 'EDIT_ZONE',
    // Slots
    'VIEW_SLOTS', 'CREATE_SLOT', 'EDIT_SLOT', 'DUPLICATE_SLOT', 'CANCEL_SLOT',
    // Slot Bookings
    'VIEW_SLOT_BOOKINGS', 'MANAGE_BOOKINGS',
    // Partner Levels
    'VIEW_PARTNER_LEVELS',
    // Delivery Partners
    'VIEW_DELIVERY_PARTNERS', 'APPROVE_PARTNER', 'BLOCK_PARTNER', 'MANAGE_PARTNER_LEVEL',
    // Orders
    'VIEW_ORDERS', 'EDIT_ORDER_STATUS', 'ASSIGN_ORDER', 'CANCEL_ORDER',
    // Reports
    'VIEW_REPORTS', 'VIEW_ANALYTICS',
    // Audit Logs
    'VIEW_AUDIT_LOGS',
  ],

  // FINANCE_ADMIN: Earnings, Wallet, Incentives, Payouts
  FINANCE_ADMIN: [
    // Earning Rules
    'VIEW_EARNING_RULES', 'CREATE_EARNING_RULE', 'EDIT_EARNING_RULE',
    // Partner Levels
    'VIEW_PARTNER_LEVELS',
    // Delivery Partners (read-only)
    'VIEW_DELIVERY_PARTNERS',
    // Wallet & Transactions
    'VIEW_WALLET_TRANSACTIONS', 'CREATE_WALLET_ADJUSTMENT', 'CREATE_DEDUCTION', 'REVERSE_TRANSACTION',
    // Payouts
    'VIEW_PAYOUTS', 'APPROVE_PAYOUT', 'REJECT_PAYOUT', 'PROCESS_PAYOUT', 'COMPLETE_PAYOUT',
    // Incentives
    'CREATE_INCENTIVE_CAMPAIGN', 'EDIT_INCENTIVE_CAMPAIGN', 'VIEW_INCENTIVE_CAMPAIGNS', 'VIEW_INCENTIVE_PROGRESS',
    // Reports
    'VIEW_REPORTS', 'VIEW_ANALYTICS', 'EXPORT_REPORTS',
    // Audit Logs
    'VIEW_AUDIT_LOGS',
  ],

  // SUPPORT_ADMIN: Customer support, Orders, Partner support
  SUPPORT_ADMIN: [
    // Delivery Partners (read-only)
    'VIEW_DELIVERY_PARTNERS',
    // Orders
    'VIEW_ORDERS', 'EDIT_ORDER_STATUS', 'REFUND_ORDER',
    // Wallet (read-only for disputes)
    'VIEW_WALLET_TRANSACTIONS',
    // Reports (read-only)
    'VIEW_REPORTS',
    // Audit Logs
    'VIEW_AUDIT_LOGS',
  ],
}

// ─── Role Information ───────────────────────────────────────────────────────

export interface RoleInfo {
  id: AdminRole
  name: string
  description: string
  permissions: Permission[]
  color: string
  icon: string
}

export const roleInfoMap: Record<AdminRole, RoleInfo> = {
  SUPER_ADMIN: {
    id: 'SUPER_ADMIN',
    name: 'Super Admin',
    description: 'Full system access - all permissions',
    permissions: rolePermissions.SUPER_ADMIN,
    color: 'bg-red-600',
    icon: '👑',
  },
  OPERATIONS_ADMIN: {
    id: 'OPERATIONS_ADMIN',
    name: 'Operations Admin',
    description: 'Manage cities, zones, slots, orders, and delivery partners',
    permissions: rolePermissions.OPERATIONS_ADMIN,
    color: 'bg-blue-600',
    icon: '⚙️',
  },
  FINANCE_ADMIN: {
    id: 'FINANCE_ADMIN',
    name: 'Finance Admin',
    description: 'Manage earnings, wallets, payouts, and incentives',
    permissions: rolePermissions.FINANCE_ADMIN,
    color: 'bg-green-600',
    icon: '💰',
  },
  SUPPORT_ADMIN: {
    id: 'SUPPORT_ADMIN',
    name: 'Support Admin',
    description: 'Customer support - handle orders and partner issues',
    permissions: rolePermissions.SUPPORT_ADMIN,
    color: 'bg-purple-600',
    icon: '🆘',
  },
}

// ─── Permission Check Functions ──────────────────────────────────────────────

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: AdminRole | null, permission: Permission): boolean {
  if (!role) return false
  return rolePermissions[role].includes(permission)
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: AdminRole | null, permissions: Permission[]): boolean {
  if (!role) return false
  return permissions.some(permission => hasPermission(role, permission))
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: AdminRole | null, permissions: Permission[]): boolean {
  if (!role) return false
  return permissions.every(permission => hasPermission(role, permission))
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: AdminRole): Permission[] {
  return rolePermissions[role] || []
}

/**
 * Get role info
 */
export function getRoleInfo(role: AdminRole): RoleInfo {
  return roleInfoMap[role]
}

// ─── Page Access Control ─────────────────────────────────────────────────────

/**
 * Defines which roles can access which admin pages
 */
export const pageAccessControl: Record<string, AdminRole[]> = {
  '/': ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_ADMIN'], // Dashboard
  '/cities': ['SUPER_ADMIN', 'OPERATIONS_ADMIN'],
  '/zones': ['SUPER_ADMIN', 'OPERATIONS_ADMIN'],
  '/slots': ['SUPER_ADMIN', 'OPERATIONS_ADMIN'],
  '/earning-rules': ['SUPER_ADMIN', 'FINANCE_ADMIN'],
  '/partner-levels': ['SUPER_ADMIN', 'FINANCE_ADMIN', 'OPERATIONS_ADMIN'],
  '/delivery-partners': ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_ADMIN'],
  '/orders': ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_ADMIN'],
  '/wallet-transactions': ['SUPER_ADMIN', 'FINANCE_ADMIN'],
  '/payouts': ['SUPER_ADMIN', 'FINANCE_ADMIN'],
  '/incentive-campaigns': ['SUPER_ADMIN', 'FINANCE_ADMIN'],
  '/reports': ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_ADMIN'],
  '/settings': ['SUPER_ADMIN'],
  '/profile': ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_ADMIN'],
}

/**
 * Check if a role can access a page
 */
export function canAccessPage(role: AdminRole | null, page: string): boolean {
  if (!role) return false
  const allowedRoles = pageAccessControl[page]
  if (!allowedRoles) return false
  return allowedRoles.includes(role)
}

// ─── Permission Groups ──────────────────────────────────────────────────────

/**
 * Groups of related permissions for easier checking
 */
export const permissionGroups = {
  cityManagement: ['CREATE_CITY', 'EDIT_CITY', 'DELETE_CITY', 'VIEW_CITIES'] as Permission[],
  zoneManagement: ['CREATE_ZONE', 'EDIT_ZONE', 'DELETE_ZONE', 'VIEW_ZONES'] as Permission[],
  slotManagement: ['CREATE_SLOT', 'EDIT_SLOT', 'DELETE_SLOT', 'DUPLICATE_SLOT', 'CANCEL_SLOT', 'VIEW_SLOTS'] as Permission[],
  slotBookingManagement: ['VIEW_SLOT_BOOKINGS', 'MANAGE_BOOKINGS'] as Permission[],
  earningRuleManagement: ['CREATE_EARNING_RULE', 'EDIT_EARNING_RULE', 'DELETE_EARNING_RULE', 'VIEW_EARNING_RULES'] as Permission[],
  partnerLevelManagement: ['CREATE_PARTNER_LEVEL', 'EDIT_PARTNER_LEVEL', 'DELETE_PARTNER_LEVEL', 'VIEW_PARTNER_LEVELS'] as Permission[],
  deliveryPartnerManagement: ['VIEW_DELIVERY_PARTNERS', 'EDIT_DELIVERY_PARTNER', 'APPROVE_PARTNER', 'BLOCK_PARTNER', 'MANAGE_PARTNER_LEVEL'] as Permission[],
  orderManagement: ['VIEW_ORDERS', 'EDIT_ORDER_STATUS', 'ASSIGN_ORDER', 'CANCEL_ORDER', 'REFUND_ORDER'] as Permission[],
  walletManagement: ['VIEW_WALLET_TRANSACTIONS', 'CREATE_WALLET_ADJUSTMENT', 'CREATE_DEDUCTION', 'REVERSE_TRANSACTION'] as Permission[],
  payoutManagement: ['VIEW_PAYOUTS', 'APPROVE_PAYOUT', 'REJECT_PAYOUT', 'PROCESS_PAYOUT', 'COMPLETE_PAYOUT'] as Permission[],
  incentiveManagement: ['CREATE_INCENTIVE_CAMPAIGN', 'EDIT_INCENTIVE_CAMPAIGN', 'VIEW_INCENTIVE_CAMPAIGNS', 'VIEW_INCENTIVE_PROGRESS'] as Permission[],
  reportAccess: ['VIEW_REPORTS', 'VIEW_ANALYTICS', 'EXPORT_REPORTS'] as Permission[],
  auditAccess: ['VIEW_AUDIT_LOGS'] as Permission[],
  settingsManagement: ['VIEW_SETTINGS', 'EDIT_SETTINGS', 'MANAGE_ADMIN_USERS'] as Permission[],
}

/**
 * Check if a role has access to a permission group
 */
export function hasPermissionGroup(role: AdminRole | null, group: keyof typeof permissionGroups): boolean {
  if (!role) return false
  return hasAnyPermission(role, permissionGroups[group])
}
