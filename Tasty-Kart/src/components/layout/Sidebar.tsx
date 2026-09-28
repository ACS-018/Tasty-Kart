import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/context/SidebarContext'
import { useAuth } from '@/context/AuthContext'
import {
  LayoutDashboard, ShoppingBag, Store, Tag, UtensilsCrossed,
  Pizza, PlusCircle, Users, Bike,
  CreditCard, Star, Bell, Image, Settings,
  User, LogOut, ChevronLeft, ChevronRight, Layers, X, Wallet,
  Crown, Map, MapPin, Zap, MessageSquare
} from 'lucide-react'

const navItems = [
  {
    group: 'Overview',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard, description: 'Analytics & overview', badge: null },
      { path: '/orders', label: 'Orders', icon: ShoppingBag, description: 'Live order management', badge: null },
    ],
  },
  {
    group: 'Catalogue',
    items: [
      { path: '/restaurants', label: 'Restaurants', icon: Store, description: 'Partner restaurants', badge: null },
      { path: '/restaurant-categories', label: 'Rest. Categories', icon: Layers, description: 'Cuisine types', badge: null },
      { path: '/food-categories', label: 'Food Categories', icon: Tag, description: 'Menu categories', badge: null },
      { path: '/food-items', label: 'Food Items', icon: Pizza, description: 'All menu items', badge: null },
      { path: '/addons', label: 'Add-ons', icon: PlusCircle, description: 'Extras & toppings', badge: null },
    ],
  },
  {
    group: 'Marketing',
    items: [
      { path: '/offers', label: 'Offers', icon: Crown, description: 'Promotional offers', badge: null },
      { path: '/banners', label: 'Banners', icon: Image, description: 'Promotional banners', badge: null },
    ],
  },
  {
    group: 'Users',
    items: [
      { path: '/customers', label: 'Customers', icon: Users, description: 'Customer accounts', badge: null },
      { path: '/cities', label: 'Cities', icon: MapPin, description: 'Cities for delivery partners', badge: null },
      { path: '/delivery-partners', label: 'Delivery Partners', icon: Bike, description: 'Fleet management', badge: null },
      { path: '/delivery-map', label: 'Delivery Map', icon: Map, description: 'Real-time partner tracking', badge: null },
      { path: '/surge-requests', label: 'Surge Requests', icon: Zap, description: 'City surge from partners', badge: null },
      { path: '/support', label: 'Delivery Support', icon: MessageSquare, description: 'Partner order & payment tickets', badge: null },
    ],
  },
  {
    group: 'Finance',
    items: [
      { path: '/subscriptions', label: 'Subscriptions', icon: Crown, description: 'Membership plans', badge: null },
      { path: '/payouts', label: 'Withdraw Requests', icon: Wallet, description: 'Pending and approved', badge: null },
      { path: '/payments', label: 'Payments', icon: CreditCard, description: 'Transaction history', badge: null },
      { path: '/reviews', label: 'Reviews', icon: Star, description: 'Customer feedback', badge: null },
      { path: '/notifications', label: 'Notifications', icon: Bell, description: 'System alerts', badge: null },
    ],
  },
  {
    group: 'System',
    items: [
      { path: '/settings', label: 'Settings', icon: Settings, description: 'Configuration', badge: null },
      { path: '/profile', label: 'Profile', icon: User, description: 'Account settings', badge: null },
    ],
  },
]

interface NavItemProps {
  path: string
  label: string
  icon: React.ElementType
  description: string
  badge: string | null
  collapsed: boolean
  onClick: () => void
  active: boolean
}

/**
 * Admin Role Badge Component
 */
function RoleBadge({ collapsed, isMobile }: { collapsed: boolean; isMobile: boolean }) {
  const { user } = useAuth()
  
  if (!user?.adminRole) return null
  
  const roleIcons: Record<string, string> = {
    SUPER_ADMIN: '👑',
    OPERATIONS_ADMIN: '⚙️',
    FINANCE_ADMIN: '💰',
    SUPPORT_ADMIN: '🆘',
  }
  
  const roleColors: Record<string, string> = {
    SUPER_ADMIN: 'bg-red-600',
    OPERATIONS_ADMIN: 'bg-blue-600',
    FINANCE_ADMIN: 'bg-green-600',
    SUPPORT_ADMIN: 'bg-purple-600',
  }

  const roleNames: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
    OPERATIONS_ADMIN: 'Operations',
    FINANCE_ADMIN: 'Finance',
    SUPPORT_ADMIN: 'Support',
  }

  return (
    <div className={cn(
      'mx-4 mb-3 px-3 py-2 rounded-lg shrink-0',
      roleColors[user.adminRole],
      'bg-opacity-20 border border-current border-opacity-30'
    )}>
      <p className="text-[10px] text-white/60 uppercase tracking-wider font-semibold">Role</p>
      <p className="text-sm font-bold text-white flex items-center gap-2">
        <span>{roleIcons[user.adminRole]}</span>
        {roleNames[user.adminRole]}
      </p>
    </div>
  )
}

function NavItem({ path, label, icon: Icon, description, badge, collapsed, onClick, active }: NavItemProps) {
  return (
    <NavLink
      to={path}
      // Mouse focus scrolls the nav back to the top; keep the click without focusing.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200 group',
        'scroll-my-2',
        collapsed ? 'px-0 py-3 justify-center' : 'px-3 py-2.5',
        active
          ? 'bg-white text-[#B32B2C] shadow-md'
          : 'text-white/70 hover:bg-white/10 hover:text-white',
      )}
    >
      {/* Static active indicator — no layoutId (that caused sidebar scroll jumps) */}
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full shadow-lg" />
      )}

      <div className={cn(
        'flex items-center justify-center shrink-0 rounded-lg w-9 h-9 transition-all duration-200',
        active
          ? 'bg-[#B32B2C] text-white'
          : 'bg-white/10 text-white/70 group-hover:bg-white/20 group-hover:text-white',
      )}>
        <Icon size={18} />
      </div>

      {!collapsed && (
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="truncate">{label}</span>
            {badge && (
              <span className="ml-2 text-[10px] font-bold bg-white text-[#B32B2C] rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                {badge}
              </span>
            )}
          </div>
          <p className={cn('text-[10px] truncate mt-0.5', active ? 'text-[#B32B2C]/75' : 'text-white/75')}>
            {description}
          </p>
        </div>
      )}

      {collapsed && (
        <div className="absolute left-full ml-3 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-[60] shadow-xl transition-all duration-200 translate-x-2 group-hover:translate-x-0">
          <p className="font-semibold">{label}</p>
          <p className="text-white/60 text-[10px]">{description}</p>
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-6 border-transparent border-r-gray-900" />
        </div>
      )}
    </NavLink>
  )
}

function SidebarContent({
  isMobile = false,
  collapsed,
  onCloseMobile,
  onToggleCollapse,
  onLogout,
  isActive,
  activeItem,
  badges,
}: {
  isMobile?: boolean
  collapsed: boolean
  onCloseMobile: () => void
  onToggleCollapse: () => void
  onLogout: () => void
  isActive: (path: string) => boolean
  activeItem?: { label: string; icon: React.ElementType }
  badges: Record<string, string | null>
}) {
  const navRef = useRef<HTMLElement>(null)
  const scrollTopRef = useRef(0)

  useLayoutEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const saved = scrollTopRef.current
    const restore = () => {
      if (nav.scrollTop !== saved) nav.scrollTop = saved
    }
    restore()
    const frame = requestAnimationFrame(restore)
    return () => cancelAnimationFrame(frame)
  })

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Logo */}
      <div className={cn(
        'flex items-center shrink-0 px-4 pt-5 pb-4',
        collapsed && !isMobile ? 'justify-center px-2' : 'gap-3',
      )}>
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-lg"
        >
          <UtensilsCrossed size={22} className="text-[#B32B2C]" />
        </motion.div>
        {(!collapsed || isMobile) && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="overflow-hidden"
          >
            <p className="font-extrabold text-white text-[18px] leading-none tracking-tight">TastyKart</p>
            <p className="text-white/40 text-[9px] font-semibold tracking-[0.18em] mt-0.5 uppercase">Admin Panel</p>
          </motion.div>
        )}
      </div>

      {/* Active Page Indicator */}
      {(!collapsed || isMobile) && activeItem && (
        <div className="mx-4 mb-3 px-3 py-2 bg-white/10 rounded-lg shrink-0">
          <p className="text-[10px] text-white/40 uppercase tracking-wider">Currently viewing</p>
          <p className="text-sm font-bold text-white flex items-center gap-2">
            <activeItem.icon size={14} />
            {activeItem.label}
          </p>
        </div>
      )}

      <div className="mx-4 h-px bg-white/10 mb-3 shrink-0" />

      {/* Navigation — overflow-anchor:none prevents jump when selecting bottom tabs */}
      <nav
        ref={navRef}
        onScroll={(e) => { scrollTopRef.current = e.currentTarget.scrollTop }}
        className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-2"
        style={{ overflowAnchor: 'none' }}
      >
        {navItems.map((group) => (
          <div key={group.group} className="mb-3">
            {(!collapsed || isMobile) && (
              <p className="px-3 pt-2 pb-1.5 text-[9px] font-bold text-white/30 uppercase tracking-[0.15em]">
                {group.group}
              </p>
            )}
            {collapsed && !isMobile && <div className="py-1" />}

            <div className="space-y-1">
              {group.items.map(item => (
                <NavItem
                  key={item.path}
                  {...item}
                  badge={badges[item.path] ?? item.badge}
                  collapsed={collapsed && !isMobile}
                  onClick={onCloseMobile}
                  active={isActive(item.path)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: Logout only */}
      <div className="shrink-0 px-3 pb-4">
        <div className="h-px bg-white/10 mb-3" />
        <button
          type="button"
          onClick={onLogout}
          className={cn(
            'flex items-center gap-3 w-full rounded-xl text-sm font-medium transition-all duration-200',
            'text-white/50 hover:text-white hover:bg-white/10',
            collapsed && !isMobile ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5',
          )}
        >
          <div className="w-9 h-9 flex items-center justify-center rounded-lg shrink-0">
            <LogOut size={18} />
          </div>
          {(!collapsed || isMobile) && <span>Logout</span>}
        </button>
      </div>

      {!isMobile && (
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex absolute -right-3 top-[72px] w-7 h-7 bg-white border-2 border-gray-100 rounded-full items-center justify-center text-gray-400 hover:text-[#B32B2C] hover:border-[#B32B2C] transition-all z-20 shadow-md"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      )}
    </div>
  )
}

export function Sidebar() {
  const { collapsed, toggleCollapse, mobileOpen, closeMobile } = useSidebar()
  const { logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  const activeItem = navItems.flatMap(g => g.items).find(i => isActive(i.path))

  const [unreadSupport, setUnreadSupport] = useState(0)
  useEffect(() => {
    const q = query(collection(db, 'supportTickets'), where('unreadByAdmin', '==', true))
    return onSnapshot(q, snap => setUnreadSupport(snap.size), () => setUnreadSupport(0))
  }, [])
  const badges = { '/support': unreadSupport > 0 ? String(unreadSupport) : null }

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <>
      <motion.aside
        animate={{ width: collapsed ? 80 : 260 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="hidden lg:flex flex-col relative shrink-0 h-screen overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #991818 0%, #B32B2C 50%, #c0392b 100%)',
          boxShadow: '4px 0 24px rgba(178,34,34,0.3)',
        }}
      >
        <SidebarContent
          collapsed={collapsed}
          onCloseMobile={closeMobile}
          onToggleCollapse={toggleCollapse}
          onLogout={handleLogout}
          isActive={isActive}
          activeItem={activeItem}
          badges={badges}
        />
      </motion.aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-40 lg:hidden"
              onClick={closeMobile}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed left-0 top-0 h-full w-[280px] z-50 lg:hidden shadow-2xl overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, #991818 0%, #B32B2C 50%, #c0392b 100%)',
              }}
            >
              <button
                onClick={closeMobile}
                className="absolute top-4 right-4 p-2 rounded-lg bg-white/15 text-white hover:bg-white/25 transition-colors z-10"
              >
                <X size={18} />
              </button>
              <SidebarContent
                isMobile
                collapsed={collapsed}
                onCloseMobile={closeMobile}
                onToggleCollapse={toggleCollapse}
                onLogout={handleLogout}
                isActive={isActive}
                activeItem={activeItem}
                badges={badges}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
