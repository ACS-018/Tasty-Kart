import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import {
  ShoppingBag, DollarSign, Users, Store, Bike,
  Star, TrendingUp, Calendar, Search, ChevronLeft, ChevronRight,
  CheckCircle2,
  BarChart3, TrendingDown, Package, MessageSquare
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { Modal, Drawer } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  type OrderStatus, type Order, type Restaurant, type Customer, type DeliveryPartner
} from '@/data/dummy'
import { formatCurrency, formatTime, getInitials } from '@/lib/utils'

/** Safely converts a Firestore Timestamp, ISO string, or Date to a JS Date. */
function toDate(val: any): Date {
  if (!val) return new Date(0)
  if (val?.toDate) return val.toDate()          // Firestore Timestamp
  return new Date(val)
}

function restaurantKey(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function isCancelledOrder(status: unknown) {
  const value = String(status ?? '').trim().toLowerCase()
  return value === 'cancelled' || value === 'canceled' || value === 'refunded' || value.includes('cancel')
}

function orderAmount(order: Order) {
  const total = Number(order.total) || 0
  if (total > 0) return total
  const items = Array.isArray(order.items) ? order.items : []
  const fromItems = items.reduce((sum, item) => {
    const price = Number(item?.price) || 0
    const qty = Number(item?.qty) || 0
    return sum + price * (qty > 0 ? qty : 1)
  }, 0)
  if (fromItems > 0) return fromItems
  const record = order as Order & Record<string, unknown>
  const computed =
    (Number(record.subtotal) || 0) +
    (Number(record.tax) || 0) +
    (Number(record.deliveryFee) || 0) +
    (Number(record.platformFee) || 0) +
    (Number(record.tip) || 0) -
    (Number(record.discount) || 0)
  return computed > 0 ? computed : 0
}

function compactRevenue(amount: number) {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`
  if (amount >= 1000) {
    const thousands = amount / 1000
    return `₹${thousands >= 10 ? thousands.toFixed(0) : thousands.toFixed(1)}k`
  }
  return `₹${Math.round(amount)}`
}

function liveRatingLabel(restaurant: Restaurant) {
  const reviews = Number(restaurant.totalReviews) || 0
  if (reviews <= 0) return '—'
  const value = Number(restaurant.averageRating ?? restaurant.rating)
  return value > 0 ? value.toFixed(1) : '—'
}
import { useToast } from '@/components/ui/Toast'
import { subscribeToOrders, updateOrderStatusInFirestore, subscribeToCollection } from '@/lib/firebaseService'

// ─── Types ───────────────────────────────────────────────────────────────────
type StatItem = {
  id: string; title: string; value: string | number
  icon: LucideIcon
  color: 'red' | 'green' | 'blue' | 'purple' | 'amber' | 'indigo' | 'rose' | 'teal'
  trend: 'up' | 'down' | 'neutral'; changeLabel: string
}

// ─── Animated Counter Component ─────────────────────────────────────────────
function AnimatedCounter({ value, prefix = '', suffix = '' }: { value: string | number; prefix?: string; suffix?: string }) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="font-black"
    >
      {prefix}{typeof value === 'number' ? value.toLocaleString('en-IN') : value}{suffix}
    </motion.span>
  )
}

// ─── Custom Tooltip ─────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload) return null
  return (
    <div className="bg-white rounded-xl shadow-2xl border border-gray-100 p-3 z-50">
      <p className="text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
        <Calendar size={12} className="text-[#B32B2C]" />
        {label}
      </p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 text-xs py-0.5">
          <span className="flex items-center gap-1.5 text-gray-600">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            {p.name}
          </span>
          <span className="font-bold text-gray-900">
            {typeof p.value === 'number' && (p.name.toLowerCase().includes('revenue') || p.name.toLowerCase().includes('amount'))
              ? formatCurrency(p.value)
              : p.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export function Dashboard() {
  const toast = useToast()
  const [ordersList, setOrdersList] = useState<Order[]>([])
  const [restaurantsList, setRestaurantsList] = useState<Restaurant[]>([])
  const [customersList, setCustomersList] = useState<Customer[]>([])
  const [partnersList, setPartnersList] = useState<DeliveryPartner[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [ordersPage, setOrdersPage] = useState(0)
  const [chartMetric, setChartMetric] = useState<'revenue' | 'orders'>('revenue')

  // Modal states
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)

  // ── Last 6 months of real orders, used by both chart modes ───────────────
  const monthlyChart = useMemo(() => {
    const now = new Date()
    const buckets = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      return {
        key: `${d.getFullYear()}-${d.getMonth()}`,
        month: d.toLocaleString('en-IN', { month: 'short' }),
        revenue: 0,
        orders: 0,
      }
    })
    const index = new Map(buckets.map((bucket, i) => [bucket.key, i]))
    ordersList.forEach(order => {
      const created = toDate(order.createdAt)
      if (Number.isNaN(created.getTime()) || created.getTime() === 0) return
      const slot = index.get(`${created.getFullYear()}-${created.getMonth()}`)
      if (slot === undefined) return
      buckets[slot].orders += 1
      const status = String(order.status || '').toLowerCase()
      if (status !== 'cancelled' && status !== 'refunded') {
        buckets[slot].revenue += Number(order.total) || 0
      }
    })
    return buckets
  }, [ordersList])

  const chartTotal = useMemo(
    () => monthlyChart.reduce(
      (sum, row) => sum + (chartMetric === 'revenue' ? row.revenue : row.orders),
      0,
    ),
    [monthlyChart, chartMetric],
  )

  // ── Live Weekly Orders (last 7 calendar days) ────────────────────────────
  const liveWeeklyData = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(today)
      day.setDate(today.getDate() - (6 - i))
      const dateStr = day.toDateString()
      const dayOrders = ordersList.filter(order => toDate(order.createdAt).toDateString() === dateStr)
      const statusOf = (order: Order) => String(order.status || '').toLowerCase()
      const delivered = dayOrders.filter(order => statusOf(order) === 'delivered').length
      const cancelled = dayOrders.filter(order => statusOf(order) === 'cancelled' || statusOf(order) === 'refunded').length
      return {
        label: `${day.toLocaleDateString('en-IN', { weekday: 'short' })} ${day.getDate()}`,
        orders: dayOrders.length,
        delivered,
        cancelled,
        inProgress: Math.max(0, dayOrders.length - delivered - cancelled),
      }
    })
  }, [ordersList])

  const weeklyOrderTotal = liveWeeklyData.reduce((sum, day) => sum + day.orders, 0)


  useEffect(() => {
    const unsub = subscribeToOrders((liveOrders) => setOrdersList(liveOrders))
    return () => unsub()
  }, [])
  useEffect(() => {
    const unsub = subscribeToCollection<Restaurant>('restaurants', (data) => setRestaurantsList(data))
    return () => unsub()
  }, [])
  useEffect(() => {
    const unsub = subscribeToCollection<Customer>('customers', (data) => setCustomersList(data))
    return () => unsub()
  }, [])
  useEffect(() => {
    const unsub = subscribeToCollection<DeliveryPartner>('deliveryPartners', (data) => setPartnersList(data))
    return () => unsub()
  }, [])

  // ── Computed Stats ─────────────────────────────────────────────────────────
  const stats = useMemo((): StatItem[] => {
    const todayStr = new Date().toDateString()
    const todayOrders = ordersList.filter(o => toDate(o.createdAt).toDateString() === todayStr)
    const todayRevenue = todayOrders.filter(o => o.status !== 'cancelled' && o.status !== 'refunded').reduce((s, o) => s + o.total, 0)
    const totalRevenue = ordersList.filter(o => o.status !== 'cancelled' && o.status !== 'refunded').reduce((s, o) => s + o.total, 0)
    const pendingOrders = ordersList.filter(o => o.status === 'pending' || o.status === 'accepted' || o.status === 'preparing').length
    const activeRestaurants = restaurantsList.filter(r => r.status === 'active').length
    const activePartners = partnersList.filter(p => p.status === 'online' || p.status === 'busy').length
    const avgRating = restaurantsList.length > 0
      ? (restaurantsList.reduce((s, r) => s + (r.rating || 0), 0) / restaurantsList.length).toFixed(1)
      : '—'
    const revenueLabel = totalRevenue >= 100000 ? `₹${(totalRevenue / 100000).toFixed(1)}L` : formatCurrency(totalRevenue)

    return [
      { id: 'orders', title: "Today's Orders", value: todayOrders.length, icon: ShoppingBag, color: 'red', trend: 'up', changeLabel: '+12%' },
      { id: 'revenue', title: "Today's Revenue", value: formatCurrency(todayRevenue), icon: DollarSign, color: 'green', trend: 'up', changeLabel: '+8%' },
      { id: 'total-rev', title: 'Total Revenue', value: revenueLabel, icon: TrendingUp, color: 'blue', trend: 'up', changeLabel: '+15%' },
      { id: 'customers', title: 'Total Customers', value: customersList.length, icon: Users, color: 'purple', trend: 'up', changeLabel: '+5%' },
      { id: 'restaurants', title: 'Restaurants', value: restaurantsList.length, icon: Store, color: 'amber', trend: 'up', changeLabel: '+2%' },
      { id: 'partners', title: 'Delivery Partners', value: partnersList.length, icon: Bike, color: 'indigo', trend: 'up', changeLabel: '+8%' },
    ]
  }, [ordersList, restaurantsList, customersList, partnersList])

  const topRestaurants = useMemo(() => {
    const ids = new Set(restaurantsList.map(restaurant => restaurant.id))
    const nameOwners = new Map<string, string[]>()
    for (const restaurant of restaurantsList) {
      const key = restaurantKey(restaurant.name)
      if (!key) continue
      const owners = nameOwners.get(key) ?? []
      owners.push(restaurant.id)
      nameOwners.set(key, owners)
    }

    const totals = new Map<string, { orders: number; revenue: number }>()
    const add = (id: string, amount: number) => {
      const current = totals.get(id) ?? { orders: 0, revenue: 0 }
      current.orders += 1
      current.revenue += amount
      totals.set(id, current)
    }

    for (const order of ordersList) {
      const amount = isCancelledOrder(order.status) ? 0 : orderAmount(order)
      const restaurantId = String(order.restaurantId || '')
      if (restaurantId && ids.has(restaurantId)) {
        add(restaurantId, amount)
        continue
      }
      const owners = nameOwners.get(restaurantKey(order.restaurantName)) ?? []
      if (owners.length === 1) add(owners[0], amount)
    }

    return restaurantsList
      .map(restaurant => {
        const live = totals.get(restaurant.id) ?? { orders: 0, revenue: 0 }
        return { ...restaurant, orderCount: live.orders, revenue: live.revenue }
      })
      .sort((a, b) => b.orderCount - a.orderCount || b.revenue - a.revenue || a.name.localeCompare(b.name))
      .slice(0, 5)
  }, [restaurantsList, ordersList])

  // ── Recent Orders ──────────────────────────────────────────────────────────
  const ORDERS_PAGE_SIZE = 6
  const recentOrders = useMemo(() => {
    return [...ordersList].sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime())
  }, [ordersList])

  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return recentOrders
    const q = searchQuery.toLowerCase()
    return recentOrders.filter(o =>
      (o.orderNumber || '').toLowerCase().includes(q) ||
      (o.customerName || '').toLowerCase().includes(q) ||
      (o.restaurantName || '').toLowerCase().includes(q)
    )
  }, [recentOrders, searchQuery])

  const ordersPageCount = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PAGE_SIZE))
  const ordersPageIndex = Math.min(ordersPage, ordersPageCount - 1)
  const pagedOrders = filteredOrders.slice(
    ordersPageIndex * ORDERS_PAGE_SIZE,
    ordersPageIndex * ORDERS_PAGE_SIZE + ORDERS_PAGE_SIZE,
  )

  const selectedOrder = ordersList.find(order => order.id === selectedOrderId) ?? null

  const isLockedStatus = (status: string) => {
    const value = status.trim().toLowerCase()
    return value === 'cancelled' || value === 'canceled' || value === 'refunded' || value.includes('cancel')
  }

  // ── Order Status Handler ───────────────────────────────────────────────────
  const handleUpdateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    if (updatingStatus) return
    const current = ordersList.find(order => order.id === orderId)
    if (current && isLockedStatus(String(current.status || ''))) {
      toast.error('Cannot update', 'This order is cancelled and its status cannot be changed')
      return
    }
    setUpdatingStatus(true)
    const result = await updateOrderStatusInFirestore(orderId, newStatus)
    setUpdatingStatus(false)
    if (!result.success) {
      const message = typeof result.error === 'string'
        ? result.error
        : 'Could not update this order'
      if (message.toLowerCase().includes('cancel')) {
        setOrdersList(prev => prev.map(order => (
          order.id === orderId ? { ...order, status: 'cancelled' } : order
        )))
      }
      toast.error('Cannot update', message)
      return
    }
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    setOrdersList(prev => prev.map(order => {
      if (order.id !== orderId) return order
      return {
        ...order,
        status: newStatus,
        timeline: [...(order.timeline ?? []), { status: newStatus, time: timeStr }],
      }
    }))
    toast.success('Order Updated', `Status changed to ${newStatus.toUpperCase()}`)
  }

  const orderSteps: OrderStatus[] = ['pending', 'accepted', 'preparing', 'picked', 'delivered']
  const getStepIndex = (status: OrderStatus) => {
    const value = String(status || '').toLowerCase()
    if (value === 'cancelled' || value === 'canceled' || value === 'refunded' || value.includes('cancel')) return -1
    return orderSteps.indexOf(value as OrderStatus)
  }

  // ─── UI Components ─────────────────────────────────────────────────────────
  const colorMap = {
    red:    { bg: 'bg-red-50', icon: 'text-red-600', border: 'border-red-200', shadow: 'shadow-red-100' },
    green:  { bg: 'bg-green-50', icon: 'text-green-600', border: 'border-green-200', shadow: 'shadow-green-100' },
    blue:   { bg: 'bg-blue-50', icon: 'text-blue-600', border: 'border-blue-200', shadow: 'shadow-blue-100' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600', border: 'border-purple-200', shadow: 'shadow-purple-100' },
    amber:  { bg: 'bg-amber-50', icon: 'text-amber-600', border: 'border-amber-200', shadow: 'shadow-amber-100' },
    indigo: { bg: 'bg-indigo-50', icon: 'text-indigo-600', border: 'border-indigo-200', shadow: 'shadow-indigo-100' },
    rose:   { bg: 'bg-rose-50', icon: 'text-rose-600', border: 'border-rose-200', shadow: 'shadow-rose-100' },
    teal:   { bg: 'bg-teal-50', icon: 'text-teal-600', border: 'border-teal-200', shadow: 'shadow-teal-100' },
  }

  return (
    <div className="space-y-6 pb-8">

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat, i) => {
          const colors = colorMap[stat.color]
          return (
            <motion.div
              key={stat.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-xl hover:border-gray-200 transition-all cursor-pointer group`}
            >
              <div className={`w-11 h-11 rounded-xl ${colors.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                <stat.icon size={20} className={colors.icon} />
              </div>
              <p className="text-xs font-medium text-gray-500 mb-1">{stat.title}</p>
              <div className="flex items-end justify-between">
                <AnimatedCounter value={stat.value} />
                <span className={`text-[10px] font-bold flex items-center gap-0.5 ${stat.trend === 'up' ? 'text-green-600' : stat.trend === 'down' ? 'text-red-600' : 'text-gray-400'}`}>
                  {stat.trend === 'up' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {stat.changeLabel}
                </span>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* ── Main Content Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ── Left: Revenue Chart & Recent Orders ── */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Revenue Chart */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <BarChart3 size={18} className="text-[#B32B2C]" /> Revenue Analytics
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Last 6 months · {chartMetric === 'revenue' ? formatCurrency(chartTotal) : `${chartTotal.toLocaleString('en-IN')} orders`}
                </p>
              </div>
              <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl">
                {['Revenue', 'Orders'].map(m => (
                  <button
                    key={m}
                    onClick={() => setChartMetric(m.toLowerCase() as 'revenue' | 'orders')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      chartMetric === m.toLowerCase()
                        ? 'bg-white text-[#B32B2C] shadow-sm'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4">
              <ResponsiveContainer key={chartMetric} width="100%" height={280}>
                {chartMetric === 'revenue' ? (
                  <AreaChart data={monthlyChart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#B32B2C" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#B32B2C" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#B32B2C" strokeWidth={2.5} fill="url(#revGrad)" />
                  </AreaChart>
                ) : (
                  <BarChart data={monthlyChart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="orders" name="Orders" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={48} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Orders Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <ShoppingBag size={18} className="text-[#B32B2C]" /> Recent Orders
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                  {ordersList.length} Total
                </span>
              </div>
              <div className="relative w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setOrdersPage(0) }}
                  placeholder="Search orders..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Order', 'Customer', 'Restaurant', 'Amount', 'Status', 'Time'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center">
                        <ShoppingBag size={32} className="mx-auto mb-2 text-gray-300" />
                        <p className="text-sm text-gray-500 font-medium">No orders found</p>
                      </td>
                    </tr>
                  ) : (
                    pagedOrders.map(order => (
                      <tr key={order.id} onClick={() => setSelectedOrderId(order.id)} className="hover:bg-red-50/50 transition-colors cursor-pointer">
                        <td className="px-5 py-3.5">
                          <span className="text-xs font-bold text-[#B32B2C]">{order.orderNumber}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
                              {getInitials(order.customerName)}
                            </div>
                            <span className="text-xs font-medium text-gray-900">{order.customerName}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-600">{order.restaurantName}</td>
                        <td className="px-5 py-3.5 text-xs font-bold text-gray-900">{formatCurrency(order.total)}</td>
                        <td className="px-5 py-3.5"><StatusBadge status={order.status} /></td>
                        <td className="px-5 py-3.5 text-xs text-gray-400">{formatTime(order.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500">
                {filteredOrders.length === 0
                  ? '0 orders'
                  : `Showing ${ordersPageIndex * ORDERS_PAGE_SIZE + 1}–${Math.min(filteredOrders.length, (ordersPageIndex + 1) * ORDERS_PAGE_SIZE)} of ${filteredOrders.length}`}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Previous orders"
                  disabled={ordersPageIndex === 0}
                  onClick={() => setOrdersPage(ordersPageIndex - 1)}
                  className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-semibold text-gray-600 min-w-[3.5rem] text-center">
                  {ordersPageIndex + 1} / {ordersPageCount}
                </span>
                <button
                  type="button"
                  aria-label="Next orders"
                  disabled={ordersPageIndex >= ordersPageCount - 1}
                  onClick={() => setOrdersPage(ordersPageIndex + 1)}
                  className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Top Restaurants & Activity ── */}
        <div className="space-y-6">
          
          {/* Top Restaurants */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Store size={16} className="text-amber-500" /> Top Restaurants
              </h3>
              <span className="text-[10px] text-gray-400 font-medium">By Orders</span>
            </div>
            <div className="divide-y divide-gray-50">
              {topRestaurants.length === 0 ? (
                <p className="px-5 py-6 text-xs text-gray-400">No restaurants yet</p>
              ) : topRestaurants.map((r, i) => (
                <div key={r.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                    i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-700' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-500'
                  }`}>
                    #{i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{r.name}</p>
                    <p className="text-[10px] text-gray-500">{r.orderCount} orders</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-gray-900">{compactRevenue(r.revenue)}</p>
                    <div className="flex items-center gap-0.5 justify-end">
                      <Star size={10} className="text-amber-400 fill-amber-400" />
                      <span className="text-[10px] text-gray-500">{liveRatingLabel(r)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white">
              <div className="flex items-center justify-between mb-3">
                <Package size={20} className="opacity-80" />
                <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full">Live</span>
              </div>
              <p className="text-2xl font-black">{ordersList.filter(o => o.status === 'preparing').length}</p>
              <p className="text-xs opacity-80 mt-1">Preparing Now</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 text-white">
              <div className="flex items-center justify-between mb-3">
                <MessageSquare size={20} className="opacity-80" />
              </div>
              <p className="text-2xl font-black">{customersList.filter(c => c.status === 'active').length}</p>
              <p className="text-xs opacity-80 mt-1">Active Users</p>
            </div>
          </div>

          {/* Weekly Performance — last 7 days from live orders */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Calendar size={16} className="text-blue-500" /> Weekly Orders
              </h3>
              <span className="text-[10px] font-bold text-gray-500">{weeklyOrderTotal} orders</span>
            </div>
            <p className="text-[11px] text-gray-400 mb-3">Last 7 days from live orders</p>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={liveWeeklyData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="delivered" name="Delivered" stackId="week" fill="#22c55e" maxBarSize={28} />
                <Bar dataKey="inProgress" name="In progress" stackId="week" fill="#f59e0b" maxBarSize={28} />
                <Bar dataKey="cancelled" name="Cancelled" stackId="week" fill="#f87171" radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Order Detail Modal ── */}
      <Modal open={!!selectedOrder} onClose={() => setSelectedOrderId(null)} title={selectedOrder ? `Order ${selectedOrder.orderNumber}` : ''} size="lg">
        {selectedOrder && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-gray-50 rounded-xl">
              <div>
                <span className="text-xs text-gray-400 block">Placed At</span>
                <span className="text-xs font-bold text-gray-900">{toDate(selectedOrder.createdAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-xs text-gray-400 block">Payment</span>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{selectedOrder.paymentMethod}</span>
              </div>
              <div>
                <span className="text-xs text-gray-400 block">Total</span>
                <span className="text-lg font-black text-[#B32B2C]">{formatCurrency(selectedOrder.total)}</span>
              </div>
              <StatusBadge status={selectedOrder.status} />
            </div>

            {/* Timeline */}
            <div className="flex items-center justify-between relative px-2">
              <div className="absolute left-8 right-8 top-4 h-0.5 bg-gray-200" />
              {orderSteps.map((step, idx) => {
                const currentIdx = getStepIndex(selectedOrder.status)
                const isCompleted = currentIdx >= idx
                return (
                  <div key={step} className="flex flex-col items-center relative z-10">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isCompleted ? 'bg-[#B32B2C] text-white' : 'bg-gray-200 text-gray-500'}`}>
                      {isCompleted ? <CheckCircle2 size={14} /> : idx + 1}
                    </div>
                    <span className={`text-[10px] font-semibold mt-1 capitalize ${isCompleted ? 'text-[#B32B2C]' : 'text-gray-400'}`}>{step}</span>
                  </div>
                )
              })}
            </div>

            {isLockedStatus(String(selectedOrder.status || '')) ? (
              <p className="text-sm text-gray-500 bg-gray-50 rounded-xl px-4 py-3">
                This order is {selectedOrder.status}. Its status cannot be changed.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {orderSteps.map(step => {
                  const active = String(selectedOrder.status || '').toLowerCase() === step
                  return (
                  <button
                    key={step}
                    onClick={() => handleUpdateOrderStatus(selectedOrder.id, step)}
                    disabled={active || updatingStatus}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                      active
                        ? 'bg-[#B32B2C] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-[#B32B2C] border border-gray-200'
                    }`}
                  >
                    {step}
                  </button>
                  )
                })}
              </div>
            )}

            {/* Items */}
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-2.5 font-bold text-gray-500">Item</th>
                    <th className="text-center p-2.5 font-bold text-gray-500">Qty</th>
                    <th className="text-right p-2.5 font-bold text-gray-500">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedOrder.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5 font-medium text-gray-800">{item.name}</td>
                      <td className="p-2.5 text-center font-bold">{item.qty}</td>
                      <td className="p-2.5 text-right font-medium">{formatCurrency(item.price * item.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button onClick={() => setSelectedOrderId(null)} className="w-full">Close</Button>
          </div>
        )}
      </Modal>
    </div>
  )
}