import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  Bell, Menu, Search, ChevronRight, User, Settings, LogOut,
  Plus, ShoppingBag, Store, Users, Bike, Ticket, Image, BarChart3,
  Home, Package, CreditCard, Star, MessageSquare, Crown, Zap,
  UtensilsCrossed, Tag, X, ArrowRight, ExternalLink, Eye, MapPin, Wallet
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/context/SidebarContext'
import { useAuth } from '@/context/AuthContext'
import { formatTime, formatCurrency } from '@/lib/utils'
import { subscribeToCollection } from '@/lib/firebaseService'
import { Modal, Drawer } from '@/components/ui/Modal'

type NotifItem = { id: string; title: string; message: string; type: string; read: boolean; createdAt: string }

// ─── Types for Search ───────────────────────────────────────────────────────
type SearchResult = {
  type: 'order' | 'restaurant' | 'customer' | 'food' | 'addon' | 'coupon' | 'offer' | 'partner'
  id: string
  title: string
  subtitle: string
  icon: React.ElementType
  path: string
  status?: string
}

// ─── Page Info ─────────────────────────────────────────────────────────────
const pageInfo: Record<string, { title: string; description: string; icon: React.ElementType }> = {
  '/': { title: 'Dashboard', description: 'Overview & Analytics', icon: Home },
  '/orders': { title: 'Orders', description: 'Manage all orders', icon: ShoppingBag },
  '/restaurants': { title: 'Restaurants', description: 'Partner restaurants', icon: Store },
  '/restaurant-categories': { title: 'Restaurant Categories', description: 'Cuisine types', icon: Package },
  '/food-categories': { title: 'Food Categories', description: 'Menu categories', icon: Package },
  '/food-items': { title: 'Food Items', description: 'Menu items', icon: ShoppingBag },
  '/addons': { title: 'Add-ons', description: 'Extra toppings & extras', icon: Plus },
  '/offers': { title: 'Offers', description: 'Promotional offers', icon: Crown },
  '/coupons': { title: 'Coupons', description: 'Discount coupons', icon: Ticket },
  '/banners': { title: 'Banners', description: 'Promotional banners', icon: Image },
  '/customers': { title: 'Customers', description: 'Customer management', icon: Users },
  '/cities': { title: 'Cities', description: 'Cities delivery partners select', icon: MapPin },
  '/delivery-partners': { title: 'Delivery Partners', description: 'Delivery fleet', icon: Bike },
  '/delivery-map': { title: 'Delivery Map', description: 'Real-time partner tracking', icon: MapPin },
  '/surge-requests': { title: 'Surge Requests', description: 'Review city surge from partners', icon: Zap },
  '/payouts': { title: 'Withdraw Requests', description: 'Pending and approved withdrawals', icon: Wallet },
  '/subscriptions': { title: 'Subscriptions', description: 'Membership plans', icon: Crown },
  '/payments': { title: 'Payments', description: 'Transaction history', icon: CreditCard },
  '/reviews': { title: 'Reviews', description: 'Customer feedback', icon: Star },
  '/notifications': { title: 'Notifications', description: 'System alerts', icon: MessageSquare },
  '/support': { title: 'Delivery Support', description: 'Partner order & payment tickets', icon: MessageSquare },
  '/reports': { title: 'Reports', description: 'Analytics & insights', icon: BarChart3 },
  '/settings': { title: 'Settings', description: 'System configuration', icon: Settings },
  '/profile': { title: 'Profile', description: 'Account settings', icon: User },
}

export function Topbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { toggleMobile } = useSidebar()
  const { user, logout } = useAuth()
  
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [notifications, setNotifications] = useState<NotifItem[]>([])
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  // ─── All Data Collections for Search ─────────────────────────────────────
  const [orders, setOrders] = useState<any[]>([])
  const [restaurants, setRestaurants] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [foodItems, setFoodItems] = useState<any[]>([])
  const [addons, setAddons] = useState<any[]>([])
  const [coupons, setCoupons] = useState<any[]>([])
  const [offers, setOffers] = useState<any[]>([])
  const [partners, setPartners] = useState<any[]>([])

  // Subscribe to all collections
  useEffect(() => {
    const unsubs = [
      subscribeToCollection<NotifItem>('notifications', setNotifications),
      subscribeToCollection('orders', setOrders),
      subscribeToCollection('restaurants', setRestaurants),
      subscribeToCollection('customers', setCustomers),
      subscribeToCollection('foodItems', setFoodItems),
      subscribeToCollection('addons', setAddons),
      subscribeToCollection('coupons', setCoupons),
      subscribeToCollection('offers', setOffers),
      subscribeToCollection('deliveryPartners', setPartners),
    ]
    return () => unsubs.forEach(fn => fn())
  }, [])

  // ─── Global Search Logic ─────────────────────────────────────────────────
  const searchResults = useMemo((): SearchResult[] => {
    if (!searchQuery.trim() || searchQuery.length < 2) return []

    const query = searchQuery.toLowerCase()
    const results: SearchResult[] = []

    // Search Orders
    orders.forEach(o => {
      if (o.orderNumber?.toLowerCase().includes(query) || o.customerName?.toLowerCase().includes(query) || o.restaurantName?.toLowerCase().includes(query)) {
        results.push({
          type: 'order', id: o.id, title: o.orderNumber, subtitle: `${o.customerName} • ${o.restaurantName}`,
          icon: ShoppingBag, path: '/orders', status: o.status
        })
      }
    })

    // Search Restaurants
    restaurants.forEach(r => {
      if (r.name?.toLowerCase().includes(query) || r.cuisine?.toLowerCase().includes(query)) {
        results.push({
          type: 'restaurant', id: r.id, title: r.name, subtitle: `${r.cuisine} • ${r.city}`,
          icon: Store, path: `/restaurants/${r.id}`, status: r.status
        })
      }
    })

    // Search Customers
    customers.forEach(c => {
      if (c.name?.toLowerCase().includes(query) || c.email?.toLowerCase().includes(query) || c.phone?.includes(query)) {
        results.push({
          type: 'customer', id: c.id, title: c.name, subtitle: `${c.email} • ${c.phone}`,
          icon: Users, path: '/customers', status: c.status
        })
      }
    })

    // Search Food Items
    foodItems.forEach(f => {
      if (f.name?.toLowerCase().includes(query) || f.categoryName?.toLowerCase().includes(query)) {
        results.push({
          type: 'food', id: f.id, title: f.name, subtitle: `${f.restaurantName} • ${formatCurrency(f.price)}`,
          icon: UtensilsCrossed, path: '/food-items', status: f.status
        })
      }
    })

    // Search Addons
    addons.forEach(a => {
      if (a.name?.toLowerCase().includes(query)) {
        results.push({
          type: 'addon', id: a.id, title: a.name, subtitle: `${a.category} • ${formatCurrency(a.price)}`,
          icon: Plus, path: '/addons', status: a.status
        })
      }
    })

    // Search Coupons
    coupons.forEach(c => {
      if (c.code?.toLowerCase().includes(query) || c.description?.toLowerCase().includes(query)) {
        results.push({
          type: 'coupon', id: c.id, title: c.code, subtitle: c.description,
          icon: Ticket, path: '/coupons', status: c.status
        })
      }
    })

    // Search Offers
    offers.forEach(o => {
      if (o.title?.toLowerCase().includes(query)) {
        results.push({
          type: 'offer', id: o.id, title: o.title, subtitle: o.description,
          icon: Crown, path: '/offers', status: o.status
        })
      }
    })

    // Search Partners
    partners.forEach(p => {
      if (p.name?.toLowerCase().includes(query) || p.phone?.includes(query)) {
        results.push({
          type: 'partner', id: p.id, title: p.name, subtitle: `${p.phone} • ${p.vehicle}`,
          icon: Bike, path: '/delivery-partners', status: p.status
        })
      }
    })

    return results.slice(0, 15) // Limit results
  }, [searchQuery, orders, restaurants, customers, foodItems, addons, coupons, offers, partners])

  // Group results by type
  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {}
    searchResults.forEach(r => {
      if (!groups[r.type]) groups[r.type] = []
      groups[r.type].push(r)
    })
    return groups
  }, [searchResults])

  // Current page info
  const currentPage = useMemo(() => {
    if (location.pathname.startsWith('/restaurants/') && location.pathname !== '/restaurants') {
      return { title: 'Restaurant Menu', description: 'Categories, items & add-ons', icon: Store }
    }
    return pageInfo[location.pathname] || pageInfo['/']
  }, [location.pathname])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
        setShowSearch(true)
      }
      if (e.key === 'Escape') {
        setShowNotifications(false)
        setShowProfile(false)
        setShowSearch(false)
        setSearchFocused(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const unread = notifications.filter(n => !n.read).length
  const notifIcons: Record<string, string> = {
    order: '🛍️', restaurant: '🏪', review: '⭐', payment: '💳', partner: '🛵', coupon: '🎟️'
  }

  const handleSearchResultClick = (result: SearchResult) => {
    setShowSearch(false)
    setSearchQuery('')
    navigate(result.path)
  }

  const handleShowClick = (result: SearchResult, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedResult(result)
    setShowPreviewModal(true)
    setShowSearch(false)
  }

  const handleNavigateClick = (result: SearchResult, e: React.MouseEvent) => {
    e.stopPropagation()
    setShowSearch(false)
    setSearchQuery('')
    navigate(result.path)
  }

  const closePreviewModal = () => {
    setShowPreviewModal(false)
    setSelectedResult(null)
  }

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      order: 'bg-blue-100 text-blue-700',
      restaurant: 'bg-green-100 text-green-700',
      customer: 'bg-purple-100 text-purple-700',
      food: 'bg-orange-100 text-orange-700',
      addon: 'bg-pink-100 text-pink-700',
      coupon: 'bg-amber-100 text-amber-700',
      offer: 'bg-red-100 text-red-700',
      partner: 'bg-cyan-100 text-cyan-700',
    }
    return colors[type] || 'bg-gray-100 text-gray-700'
  }

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 gap-3 shrink-0 sticky top-0 z-30 shadow-sm">
      {/* Mobile menu */}
      <button onClick={toggleMobile} className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
        <Menu size={20} />
      </button>

      {/* Breadcrumb */}
      <nav className="hidden md:flex items-center gap-2 text-sm">
        {location.pathname !== '/' && (
          <>
            <Link to="/" className="text-gray-400 hover:text-[#B32B2C] transition-colors">
              <Home size={16} />
            </Link>
            <ChevronRight size={14} className="text-gray-300" />
          </>
        )}
        <div className="flex items-center gap-2">
          <currentPage.icon size={16} className="text-[#B32B2C]" />
          <span className="font-semibold text-gray-900">{currentPage.title}</span>
        </div>
      </nav>

      {/* Global Search */}
      <div className="relative flex-1 max-w-2xl">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setShowSearch(true) }}
            onFocus={() => { setSearchFocused(true); setShowSearch(true) }}
            onBlur={() => setTimeout(() => setShowSearch(false), 200)}
            placeholder="Search orders, restaurants, customers, food items, coupons..."
            className={cn(
              "w-full pl-9 pr-20 py-2 text-sm bg-gray-50 border rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#B32B2C]/20 focus:border-[#B32B2C] transition-all",
              searchFocused && "ring-2 ring-[#B32B2C]/20 border-[#B32B2C]"
            )}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
            <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-100 text-gray-400 text-[10px] rounded border border-gray-200">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Search Results Dropdown */}
        <AnimatePresence>
          {showSearch && searchQuery.length >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden max-h-96 overflow-y-auto"
            >
              {searchResults.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Search size={32} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-500">No results found for "{searchQuery}"</p>
                  <p className="text-xs text-gray-400 mt-1">Try searching for orders, restaurants, customers, etc.</p>
                </div>
              ) : (
                <div className="py-2">
                  {Object.entries(groupedResults).map(([type, items]) => (
                    <div key={type}>
                      <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 flex items-center gap-2">
                        <span className={cn("px-1.5 py-0.5 rounded text-[9px]", getTypeColor(type))}>
                          {items.length}
                        </span>
                        {type}s
                      </div>
                      {items.map((result) => (
                        <div
                          key={`${result.type}-${result.id}`}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors group"
                        >
                          <button
                            onClick={() => handleSearchResultClick(result)}
                            className="flex items-center gap-3 flex-1 min-w-0 text-left"
                          >
                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", getTypeColor(result.type))}>
                              <result.icon size={14} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-gray-900 truncate">{result.title}</p>
                                {result.status && (
                                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", 
                                    result.status === 'active' || result.status === 'delivered' ? 'bg-green-100 text-green-700' :
                                    result.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                    'bg-gray-100 text-gray-600'
                                  )}>
                                    {result.status}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 truncate">{result.subtitle}</p>
                            </div>
                          </button>
                          
                          {/* Show & Navigate Buttons */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                              onClick={(e) => handleShowClick(result, e)}
                              className="p-1.5 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                              title="Show Preview"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={(e) => handleNavigateClick(result, e)}
                              className="p-1.5 rounded-md bg-[#B32B2C]/10 text-[#B32B2C] hover:bg-[#B32B2C]/20 transition-colors"
                              title="Navigate"
                            >
                              <ArrowRight size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                  {searchResults.length >= 15 && (
                    <div className="px-4 py-2 text-center text-xs text-gray-400 bg-gray-50">
                      Showing first 15 results. Try a more specific search.
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setShowNotifications(!showNotifications); setShowProfile(false) }}
            className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-[#B32B2C] rounded-full text-[10px] text-white flex items-center justify-center font-bold animate-pulse">
                {unread}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
                  {unread > 0 && (
                    <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                      {unread} new
                    </span>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <Bell size={24} className="mx-auto mb-2 text-gray-300" />
                      <p className="text-sm text-gray-500">No notifications</p>
                    </div>
                  ) : (
                    notifications.slice(0, 5).map(n => (
                      <div key={n.id} className={cn('flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer', !n.read && 'bg-red-50/30')}>
                        <span className="text-xl shrink-0">{notifIcons[n.type] || '📢'}</span>
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm', !n.read ? 'font-semibold text-gray-900' : 'text-gray-700')}>{n.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{n.message}</p>
                        </div>
                        {!n.read && <div className="w-2 h-2 bg-[#B32B2C] rounded-full mt-1.5 shrink-0" />}
                      </div>
                    ))
                  )}
                </div>
                <Link to="/notifications" onClick={() => setShowNotifications(false)} className="block px-4 py-3 border-t border-gray-100 text-center text-xs text-[#B32B2C] font-medium hover:bg-gray-50">
                  View all notifications →
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => { setShowProfile(!showProfile); setShowNotifications(false) }}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-gray-100 transition-colors"
          >
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#B32B2C] to-red-400 flex items-center justify-center text-white text-sm font-bold">
                U
              </div>
            )}
            <div className="hidden sm:block text-left">
              <p className="text-sm font-semibold text-gray-900 leading-none">{user?.name || 'Admin'}</p>
              <p className="text-xs text-gray-500 leading-none mt-0.5">{user?.role || 'Super Admin'}</p>
            </div>
          </button>

          <AnimatePresence>
            {showProfile && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                className="absolute right-0 top-12 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-red-50 to-orange-50">
                  <p className="text-sm font-bold text-gray-900">{user?.name || 'Uday Admin'}</p>
                  <p className="text-xs text-gray-500">{user?.email || 'admin@tastykart.com'}</p>
                </div>
                <div className="py-1">
                  <Link to="/profile" onClick={() => setShowProfile(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                    <User size={16} /> My Profile
                  </Link>
                  <Link to="/settings" onClick={() => setShowProfile(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                    <Settings size={16} /> Settings
                  </Link>
                  <Link to="/reports" onClick={() => setShowProfile(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                    <BarChart3 size={16} /> Analytics
                  </Link>
                </div>
                <div className="border-t border-gray-100 py-1">
                  <button onClick={logout} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50">
                    <LogOut size={16} /> Logout
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Preview Modal for Search Results */}
      <Modal open={showPreviewModal} onClose={closePreviewModal} title={selectedResult ? `${selectedResult.type.charAt(0).toUpperCase() + selectedResult.type.slice(1)} Details` : ''}>
        {selectedResult && (
          <div className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", getTypeColor(selectedResult.type))}>
                <selectedResult.icon size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{selectedResult.title}</h3>
                <p className="text-sm text-gray-500">{selectedResult.subtitle}</p>
              </div>
              {selectedResult.status && (
                <span className={cn("ml-auto text-xs px-2 py-1 rounded-full font-medium", 
                  selectedResult.status === 'active' || selectedResult.status === 'delivered' ? 'bg-green-100 text-green-700' :
                  selectedResult.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-100 text-gray-600'
                )}>
                  {selectedResult.status}
                </span>
              )}
            </div>
            
            {/* Type-specific details */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">ID: {selectedResult.id}</p>
              <p className="text-xs text-gray-500">Type: {selectedResult.type}</p>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => { closePreviewModal(); navigate(selectedResult.path) }}
                className="flex-1 py-2 px-4 bg-[#B32B2C] text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                <ExternalLink size={14} />
                Navigate to {selectedResult.type}s
              </button>
              <button 
                onClick={closePreviewModal}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </header>
  )
}