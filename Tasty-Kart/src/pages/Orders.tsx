import { useState, useEffect, useRef } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { motion } from 'framer-motion'
import { Eye, Printer, RefreshCw, UserPlus, XCircle, Loader2, ShoppingBag, Clock, CheckCircle2, MapPin, Bike, MessageCircle, Wallet } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Modal'
import { type Order, type OrderStatus } from '@/data/dummy'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { openOrderInvoice } from '@/lib/orderInvoice'
import { useToast } from '@/components/ui/Toast'
import {
  subscribeToOrders,
  autoAssignOrderToNearestPartner,
  subscribeToCollection,
  updateOrderStatusInFirestore,
  refundToWallet,
  reconcileAllStuckPartners,
  forceResetPartnerStatus,
} from '@/lib/firebaseService'
import { type DeliveryPartner } from '@/data/dummy'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const statusColors: Record<OrderStatus, string> = {
  pending: 'bg-amber-50 border-amber-200',
  accepted: 'bg-blue-50 border-blue-200',
  preparing: 'bg-indigo-50 border-indigo-200',
  picked: 'bg-purple-50 border-purple-200',
  delivered: 'bg-green-50 border-green-200',
  cancelled: 'bg-red-50 border-red-200',
  refunded: 'bg-gray-50 border-gray-200',
}

const colorMap = {
  red:    { bg: 'bg-red-50', icon: 'text-red-600' },
  green:  { bg: 'bg-green-50', icon: 'text-green-600' },
  blue:   { bg: 'bg-blue-50', icon: 'text-blue-600' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-600' },
  amber:  { bg: 'bg-amber-50', icon: 'text-amber-600' },
}

// ── Delivery stage pipeline definition ────────────────────────────────────────
const DELIVERY_STAGES = [
  { key: 'assigned',         label: 'Assigned',              statusMatch: ['accepted'],                              stageMatch: [] },
  { key: 'to_restaurant',    label: 'En Route to Restaurant', statusMatch: ['accepted'],                              stageMatch: ['to_restaurant'] },
  { key: 'preparing',        label: 'At Restaurant',          statusMatch: ['preparing', 'accepted'],                 stageMatch: ['preparing', 'at_restaurant'] },
  { key: 'pickup',           label: 'Food Ready / OTP',       statusMatch: ['preparing', 'accepted'],                 stageMatch: ['pickup'] },
  { key: 'to_customer',      label: 'En Route to Customer',   statusMatch: ['picked'],                                stageMatch: ['to_customer'] },
  { key: 'arrived_customer', label: 'At Customer',            statusMatch: ['picked'],                                stageMatch: ['arrived_customer', 'at_customer'] },
  { key: 'delivered',        label: 'Delivered',              statusMatch: ['delivered'],                             stageMatch: ['delivered'] },
]

function getStageIndex(order: Order): number {
  if (order.status === 'delivered') return 6
  if (order.status === 'cancelled' || order.status === 'refunded') return -1

  const stage = (order as any).deliveryStage as string | undefined
  if (!stage) {
    if (!order.deliveryPartnerId) return -1
    if (!order.partnerAccepted)   return 0  // assigned, not yet accepted
    return 1                                // accepted → heading to restaurant
  }

  if (['arrived_customer', 'at_customer'].includes(stage)) return 5
  if (['to_customer'].includes(stage)) return 4
  if (['pickup'].includes(stage)) return 3
  if (['preparing', 'at_restaurant'].includes(stage)) return 2
  if (['to_restaurant'].includes(stage)) return 1
  return 0
}

export function Orders() {
  const [ordersList, setOrdersList] = useState<Order[]>([])
  const [partnersList, setPartnersList] = useState<DeliveryPartner[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Order | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [isAssigning, setIsAssigning] = useState(false)
  const [refundOrder, setRefundOrder] = useState<Order | null>(null)
  const [reconcilingPartners, setReconcilingPartners] = useState(false)
  const [resettingPartnerId, setResettingPartnerId] = useState<string | null>(null)
  const { success, error: showError } = useToast()

  // Track order IDs already sent for auto-assignment to prevent duplicate triggers
  const assignedOrderIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    const unsub = subscribeToOrders((data) => {
      setOrdersList(data)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = subscribeToCollection<DeliveryPartner>('deliveryPartners', (data) => {
      setPartnersList(data)
    })
    return () => unsub()
  }, [])

  // 🔧 AUTO-FIX: Run a one-shot reconciliation whenever the Orders page mounts
  // so partners stuck as BUSY without an active order are rescued immediately.
  // Also re-run every 2 minutes while the admin is viewing the page.
  useEffect(() => {
    let cancelled = false
    const runOnce = async () => {
      if (cancelled) return
      setReconcilingPartners(true)
      try {
        const r = await reconcileAllStuckPartners()
        if (!cancelled && r.reset > 0) {
          success(`Unstuck ${r.reset} delivery ${r.reset === 1 ? 'partner' : 'partners'} whose status was stuck as BUSY`, 'Auto Reconcile')
        }
      } catch (err: any) {
        console.warn('auto reconcile failed:', err)
      } finally {
        if (!cancelled) setReconcilingPartners(false)
      }
    }
    runOnce()
    const id = window.setInterval(runOnce, 2 * 60 * 1000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  const handleReconcileNow = async () => {
    setReconcilingPartners(true)
    try {
      const r = await reconcileAllStuckPartners()
      if (r.reset > 0) success(`Reset ${r.reset} stuck ${r.reset === 1 ? 'partner' : 'partners'} → ONLINE`)
      else success('All partner statuses already in sync ✓', 'Reconcile')
    } catch (err: any) {
      showError('Reconcile failed', err?.message || String(err))
    } finally {
      setReconcilingPartners(false)
    }
  }

  const handleResetPartnerInOrder = async (partnerId: string, partnerName: string) => {
    setResettingPartnerId(partnerId)
    try {
      const r = await forceResetPartnerStatus(partnerId)
      if (r.skipped && r.toStatus === 'busy' && r.error) {
        showError('Cannot reset', r.error)
      } else if (r.skipped && (r.toStatus === 'blocked' || r.toStatus === 'offline')) {
        success(`${partnerName} left as ${r.toStatus} (no change needed)`)
      } else if (r.success) {
        success(`${partnerName} reset → ${r.toStatus?.toUpperCase()}`)
      } else {
        showError('Reset failed', r.error || 'Unknown error')
      }
    } catch (err: any) {
      showError('Reset failed', err?.message || String(err))
    } finally {
      setResettingPartnerId(null)
    }
  }

  // Keep selected order in sync with live Firestore data
  useEffect(() => {
    if (!selected) return
    const live = ordersList.find(o => o.id === selected.id)
    if (live) setSelected(live)
  }, [ordersList])

  const filtered = filterStatus === 'all' ? ordersList : ordersList.filter(o => o.status === filterStatus)

  const handleAutoAssign = async (order: Order, options?: { silent?: boolean }) => {
    // Safety check: Don't assign cancelled, refunded, or delivered orders
    const excludedStatuses = ['cancelled', 'refunded', 'delivered']
    if (excludedStatuses.includes(order.status)) {
      if (!options?.silent) {
        showError('Cannot Assign', `Cannot assign ${order.status} orders`)
      }
      return
    }

    // Safety check: Don't assign payment placeholder orders (online payment not yet verified)
    const isPaymentPlaceholder =
      (order as any).isPlaceholder === true ||
      ((order as any).paymentVerified === false &&
        (order as any).paymentStatus === 'pending_razorpay')
    if (isPaymentPlaceholder) {
      if (!options?.silent) {
        showError('Cannot Assign', 'Payment not yet verified — waiting for customer to complete payment')
      }
      return
    }

    // Try coords from the order doc first; fall back to fetching the restaurant doc.
    let lat = order.restaurantLat
    let lng = order.restaurantLng

    if ((!lat || !lng) && order.restaurantId) {
      try {
        const { getDoc, doc } = await import('firebase/firestore')
        const { db } = await import('@/lib/firebase')
        const snap = await getDoc(doc(db, 'restaurants', order.restaurantId))
        if (snap.exists()) {
          const d = snap.data() as any
          lat  = d.lat ?? d.latitude ?? d.location?.latitude
          lng  = d.lng ?? d.longitude ?? d.location?.longitude
        }
      } catch (_) { /* ignore — will show error below */ }
    }

    if (!lat || !lng) {
      if (!options?.silent) {
        showError('Error', 'Restaurant location not available — add lat/lng to the restaurant in Restaurants page')
      }
      return
    }

    setIsAssigning(true)
    try {
      // Build the full exclusion list: scalar deniedPartnerId (from Flutter reject)
      // + array deniedPartnerIds (from prior reassignment attempts).
      const deniedScalar: string   = (order as any).deniedPartnerId  || ''
      const deniedArray:  string[] = (order as any).deniedPartnerIds || []
      const excluded = Array.from(new Set([...deniedArray, ...(deniedScalar ? [deniedScalar] : [])]))

      // Filter out denied partners before passing to the nearest-partner finder.
      const eligiblePartners = excluded.length > 0
        ? partnersList.filter(p => !excluded.includes(p.id))
        : partnersList

      if (eligiblePartners.length === 0) {
        if (!options?.silent) {
          showError('No Partners Available', 'All nearby partners have rejected this order')
        }
        return
      }

      const result = await autoAssignOrderToNearestPartner(
        order.id,
        { latitude: lat, longitude: lng },
        eligiblePartners
      )
      if (result.success) {
        success('Order Assigned', `Assigned to nearest available partner`)
      } else if (!options?.silent) {
        showError('Assignment Failed', result.error || 'No nearby delivery partner online')
      }
    } catch (err: any) {
      if (!options?.silent) {
        showError('Error', err?.message || 'Failed to assign order')
      }
    } finally {
      setIsAssigning(false)
    }
  }

  // Auto-assign: fires when an order has no partner (first time OR after rejection).
  // Uses a compound key  orderId + deniedPartnerId  so the same order can be
  // re-queued after a rejection without being blocked by the dedup guard.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    ordersList.forEach(order => {
      // Only auto-assign orders that are:
      // 1. pending or accepted status
      // 2. not already assigned to a delivery partner
      // 3. NOT cancelled, refunded, or delivered
      // 4. NOT a payment placeholder (online payment not yet verified)
      const assignableStatuses = ['pending', 'accepted']
      const excludedStatuses = ['cancelled', 'refunded', 'delivered']
      const isPaymentPlaceholder =
        (order as any).isPlaceholder === true ||
        ((order as any).paymentVerified === false &&
          (order as any).paymentStatus === 'pending_razorpay')

      if (
        assignableStatuses.includes(order.status) &&
        !excludedStatuses.includes(order.status) &&
        !order.deliveryPartnerId &&
        !isPaymentPlaceholder
      ) {
        // Include the denied partner so each rejection produces a unique key,
        // allowing a fresh assignment attempt to be queued.
        const denied = (order as any).deniedPartnerId || ''
        const key = `${order.id}::${denied}`
        if (!assignedOrderIds.current.has(key)) {
          assignedOrderIds.current.add(key)
          timers.push(setTimeout(() => handleAutoAssign(order, { silent: true }), 1500))
        }
      }
    })
    return () => timers.forEach(clearTimeout)
  }, [ordersList])

  const stats = [
    { label: 'Total Orders', value: ordersList.length,                                          icon: ShoppingBag, color: 'blue'   as const },
    { label: 'Pending',      value: ordersList.filter(o => o.status === 'pending').length,      icon: Clock,       color: 'amber'  as const },
    { label: 'Delivered',    value: ordersList.filter(o => o.status === 'delivered').length,    icon: CheckCircle2,color: 'green'  as const },
    { label: 'Cancelled',    value: ordersList.filter(o => o.status === 'cancelled').length,    icon: XCircle,     color: 'red'    as const },
  ]

  const columns: ColumnDef<Order, unknown>[] = [
    {
      accessorKey: 'orderNumber',
      header: 'Order',
      cell: ({ row }) => (
        <span className="font-semibold text-[#B32B2C] text-sm">{row.original.orderNumber}</span>
      ),
    },
    {
      accessorKey: 'customerName',
      header: 'Customer',
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-medium text-gray-900">{row.original.customerName}</p>
          <p className="text-xs text-gray-400">{row.original.customerPhone}</p>
        </div>
      ),
    },
    {
      accessorKey: 'restaurantName',
      header: 'Restaurant',
      cell: ({ row }) => <span className="text-sm text-gray-700">{row.original.restaurantName}</span>,
    },
    {
      id: 'deliveryPartner',
      header: 'Delivery Boy',
      cell: ({ row }) => {
        const name = row.original.deliveryPartnerName
        const accepted = row.original.partnerAccepted
        if (!name) return <span className="text-xs text-gray-400 italic">Unassigned</span>
        return (
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${accepted ? 'bg-green-500' : 'bg-amber-400'}`} />
            <span className="text-sm text-gray-800 font-medium">{name}</span>
          </div>
        )
      },
    },
    {
      accessorKey: 'paymentMethod',
      header: 'Payment',
      cell: ({ row }) => (
        <span className="text-xs bg-gray-100 px-2 py-1 rounded-md font-medium">
          {row.original.paymentMethod}
        </span>
      ),
    },
    {
      accessorKey: 'total',
      header: 'Amount',
      cell: ({ row }) => (
        <span className="font-semibold text-gray-900">{formatCurrency(row.original.total)}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const order = row.original
        // Show "Assigned" (awaiting acceptance) when a partner is assigned but
        // hasn't accepted yet — the raw status is 'accepted' at this point but
        // that's misleading because the partner hasn't confirmed.
        // Show "Awaiting Payment" for online payment placeholders.
        const isPaymentPlaceholder =
          (order as any).isPlaceholder === true ||
          ((order as any).paymentVerified === false &&
            (order as any).paymentStatus === 'pending_razorpay')
        const displayStatus = isPaymentPlaceholder
          ? 'awaiting_payment'
          : (order.status === 'accepted' || order.status === 'pending') &&
            !order.partnerAccepted &&
            order.deliveryPartnerId
          ? 'assigned'
          : order.status
        return (
          <div className="flex items-center gap-1.5">
            <StatusBadge status={displayStatus} />
            {(order as any).refundAmount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                ₹{(order as any).refundAmount} refunded
              </span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Date',
      cell: ({ row }) => (
        <span className="text-xs text-gray-400">{formatDateTime(row.original.createdAt)}</span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <button
          onClick={e => { e.stopPropagation(); setSelected(row.original) }}
          className="p-1.5 rounded-lg text-gray-400 hover:text-[#B32B2C] hover:bg-red-50 transition-colors"
        >
          <Eye size={16} />
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-6 pb-8">

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const colors = colorMap[stat.color]
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
            >
              <div className={`w-11 h-11 rounded-xl ${colors.bg} flex items-center justify-center mb-3`}>
                <stat.icon size={20} className={colors.icon} />
              </div>
              <p className="text-xs font-medium text-gray-500 mb-1">{stat.label}</p>
              <p className="text-2xl font-black text-gray-900">{stat.value}</p>
            </motion.div>
          )
        })}
      </div>

      {/* Filter chips + Reconcile button */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {['all','pending','accepted','preparing','picked','delivered','cancelled','refunded'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${
                filterStatus === s
                  ? 'bg-[#B32B2C] text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-[#B32B2C] hover:text-[#B32B2C]'
              }`}
            >
              {s === 'all' ? 'All Orders' : s}
              {s === 'all' && <span className="ml-1.5 bg-white/20 rounded-full px-1">{ordersList.length}</span>}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleReconcileNow}
          loading={reconcilingPartners}
          icon={<RefreshCw size={14} className={reconcilingPartners ? 'animate-spin' : ''} />}
        >
          Fix Stuck Statuses
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
          <Loader2 size={22} className="animate-spin text-[#B32B2C]" />
          <span className="text-sm font-medium">Loading orders…</span>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <DataTable
            data={filtered}
            columns={columns}
            searchPlaceholder="Search orders, customers…"
            onRowClick={setSelected}
          />
        </div>
      )}

      {/* Order Detail Drawer */}
      <Drawer open={!!selected} onClose={() => setSelected(null)} title="Order Details" width="w-[520px]">
        {selected && (
          <div className="space-y-5">

            {/* Header */}
            <div className={`rounded-xl border p-4 ${statusColors[selected.status]}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-lg text-gray-900">{selected.orderNumber}</span>
                <div className="flex items-center gap-2">
                  <StatusBadge status={
                    (selected.status === 'accepted' || selected.status === 'pending') &&
                    !selected.partnerAccepted &&
                    selected.deliveryPartnerId
                      ? 'assigned'
                      : selected.status
                  } />
                  {(selected as any).refundAmount > 0 && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                      ✓ ₹{(selected as any).refundAmount} refunded
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-500">{formatDateTime(selected.createdAt)}</p>
            </div>

            {/* ── Delivery Stage Tracker ───────────────────────────────── */}
            {!['cancelled','refunded','pending'].includes(selected.status) && selected.deliveryPartnerId && (
              <Section title={
                <div className="flex items-center gap-2">
                  <Bike size={14} className="text-[#B32B2C]" />
                  <span>Live Delivery Progress</span>
                </div>
              }>
                <DeliveryStageTracker order={selected} />
              </Section>
            )}

            {/* Customer */}
            <Section title="Customer">
              <InfoRow label="Name" value={selected.customerName} />
              <InfoRow label="Phone" value={selected.customerPhone} />
              <InfoRow label="Address" value={selected.address} />
            </Section>

            {/* Restaurant */}
            <Section title="Restaurant">
              <InfoRow label="Name" value={selected.restaurantName} />
            </Section>

            {/* Delivery Partner */}
            <Section title="Delivery Partner">
              {selected.deliveryPartnerName ? (
                <div className="space-y-2">
                  <InfoRow label="Name" value={selected.deliveryPartnerName} />
                  {(selected as any).estimatedDistance && (
                    <InfoRow label="Distance" value={`${(selected as any).estimatedDistance} km`} />
                  )}
                  {(selected as any).estimatedDeliveryTime && (
                    <InfoRow label="Est. Time" value={(selected as any).estimatedDeliveryTime} />
                  )}
                  {/* 🔧 Manual partner status fixer for admin use */}
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 mt-2">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <RefreshCw size={13} />
                      <span>Status stuck? Force reset → ONLINE</span>
                    </div>
                    <Button
                      size="xs"
                      variant="secondary"
                      loading={resettingPartnerId === selected.deliveryPartnerId}
                      onClick={() => handleResetPartnerInOrder(
                        selected.deliveryPartnerId as string,
                        selected.deliveryPartnerName as string
                      )}
                    >
                      Reset Status
                    </Button>
                  </div>
                  <div className="pt-1">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      selected.partnerAccepted
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {selected.partnerAccepted ? '✓ Accepted' : '⏳ Awaiting Acceptance'}
                    </span>
                  </div>
                </div>
              ) : ['cancelled', 'refunded'].includes(String(selected.status).toLowerCase()) ? (
                <p className="text-sm text-gray-500">Not assigned. This order is {selected.status} and cannot be updated.</p>
              ) : (
                <div>
                  <p className="text-sm text-gray-400 italic mb-3">Not assigned yet</p>
                  <Button
                    size="sm"
                    icon={<UserPlus size={14} />}
                    className="w-full"
                    onClick={() => handleAutoAssign(selected)}
                    disabled={isAssigning}
                  >
                    {isAssigning ? 'Assigning…' : 'Auto-Assign Nearest Partner'}
                  </Button>
                </div>
              )}
            </Section>

            {/* Reassignment history */}
            {(selected as any).cancellationHistory?.length > 0 && (
              <Section title="Reassignment History">
                <div className="space-y-2">
                  {(selected as any).cancellationHistory.map((c: any, i: number) => (
                    <div key={i} className="p-2 bg-red-50 border border-red-100 rounded-lg text-xs">
                      <p className="font-medium text-red-700">{c.partnerName} cancelled</p>
                      <p className="text-red-600 mt-0.5">Reason: {c.reason}</p>
                      <p className="text-red-500 text-[10px] mt-1">{formatDateTime(c.timestamp)}</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Items */}
            <Section title="Items Ordered">
              <div className="space-y-2">
                {selected.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{item.name} × {item.qty ?? 1}</span>
                    <span className="font-medium text-gray-900">{formatCurrency((Number(item.price) || 0) * (Number(item.qty) || 1))}</span>
                  </div>
                ))}
              </div>
            </Section>

            {/* Price breakdown */}
            <Section title="Price Breakdown">
              <div className="space-y-1.5">
                <InfoRow label="Subtotal"      value={formatCurrency(selected.subtotal)} />
                <InfoRow label="Tax"           value={formatCurrency(selected.tax)} />
                <InfoRow label="Delivery Fee"  value={formatCurrency(selected.deliveryFee)} />
                {(selected.surgeFee ?? 0) > 0 && (
                  <InfoRow label="  ↳ Incl. Surge Fee" value={formatCurrency(selected.surgeFee!)} small accent="orange" />
                )}
                <InfoRow label="Platform Fee"  value={formatCurrency(selected.platformFee)} />
                {(selected.discount ?? 0) > 0 && (
                  <InfoRow label={`Coupon${selected.couponCode ? ` (${selected.couponCode})` : ''}`} value={`-${formatCurrency(selected.discount)}`} />
                )}
                {(selected.tip ?? 0) > 0 && (
                  <InfoRow label="Tip 🙏" value={formatCurrency(selected.tip!)} accent="green" />
                )}
                {(selected.walletUsed ?? 0) > 0 && (
                  <InfoRow label="Wallet Used" value={`-${formatCurrency(selected.walletUsed!)}`} accent="blue" />
                )}
                <div className="border-t border-gray-100 pt-2 mt-2">
                  <InfoRow label="Total" value={formatCurrency(selected.total)} bold />
                </div>
                <InfoRow label="Payment" value={selected.paymentMethod} />
              </div>
            </Section>

            {/* Timeline */}
            <Section title="Order Timeline">
              <div className="relative pl-6">
                {(selected.timeline ?? []).map((t, i) => (
                  <div key={i} className="relative mb-3 last:mb-0">
                    <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-[#B32B2C] border-2 border-white shadow" />
                    {i < (selected.timeline ?? []).length - 1 && (
                      <div className="absolute -left-[21px] top-4 w-0.5 h-full bg-gray-200" />
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700 capitalize">{t.status}</span>
                      <span className="text-xs text-gray-400">{toStr(t.time)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Chat History */}
            {selected.deliveryPartnerId && (
              <Section title={
                <div className="flex items-center gap-2">
                  <MessageCircle size={14} className="text-[#B32B2C]" />
                  <span>Chat History</span>
                </div>
              }>
                <ChatHistory orderId={selected.id} />
              </Section>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2">
              {['cancelled', 'refunded'].includes(String(selected.status).toLowerCase()) && (
                <p className="text-sm text-gray-500 w-full">
                  This order is {selected.status}. Status cannot be changed.
                </p>
              )}
              {selected.status === 'pending' && !selected.deliveryPartnerName && (
                <Button
                  size="sm"
                  icon={<UserPlus size={14} />}
                  onClick={() => handleAutoAssign(selected)}
                  disabled={isAssigning}
                >
                  {isAssigning ? 'Assigning…' : 'Auto-Assign Nearest'}
                </Button>
              )}
              {['pending','accepted','preparing'].includes(selected.status) && (
                <Button variant="danger" size="sm" icon={<XCircle size={14} />}
                  onClick={async () => {
                    const res = await updateOrderStatusInFirestore(selected.id, 'cancelled')
                    if (!res.success) {
                      showError('Cannot update', 'This order is already cancelled')
                      return
                    }
                    success('Order cancelled')
                    setSelected(null)
                  }}>
                  Cancel Order
                </Button>
              )}
              {['delivered', 'cancelled'].includes(String(selected.status).toLowerCase()) && !(selected as any).refundAmount && (
                <Button variant="outline" size="sm" icon={<Wallet size={14} />}
                  onClick={() => setRefundOrder(selected)}>
                  Refund to Wallet
                </Button>
              )}
              {(selected as any).refundAmount > 0 && (
                <p className="text-xs text-green-600 w-full flex items-center gap-1">
                  <Wallet size={12} /> ₹{(selected as any).refundAmount} already refunded to wallet
                </p>
              )}
              <Button variant="secondary" size="sm" icon={<Printer size={14} />}
                onClick={() => {
                  openOrderInvoice(selected)
                  success('Invoice ready', 'The PDF downloaded and opened in a new tab')
                }}>
                Print Invoice
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* Refund Modal */}
      {refundOrder && (
        <RefundModal
          order={refundOrder}
          onClose={() => setRefundOrder(null)}
          onSuccess={(amount) => {
            success('Refund credited', `₹${amount} added to customer's wallet`)
            setRefundOrder(null)
            setSelected(null)
          }}
          onError={(msg) => showError('Refund failed', msg)}
        />
      )}
    </div>
  )
}

// ── Refund Modal ──────────────────────────────────────────────────────────────

type RefundModalProps = {
  order: Order
  onClose: () => void
  onSuccess: (amount: number) => void
  onError: (msg: string) => void
}

function RefundModal({ order, onClose, onSuccess, onError }: RefundModalProps) {
  const [mode, setMode] = useState<'full' | 'partial'>('full')
  const [customAmount, setCustomAmount] = useState('')
  const [busy, setBusy] = useState(false)

  // Only refund the online payment amount (order.total)
  // Wallet credit used should NOT be refunded back
  const paidAmount   = Number(order.total) || 0
  const walletSpent  = Number((order as any).walletUsed ?? 0) || 0
  const maxAmount    = paidAmount  // Only refund online payment, not wallet credit

  const resolvedAmount = mode === 'full'
    ? maxAmount
    : Math.min(Math.max(0, Number(customAmount) || 0), maxAmount)
  const canSubmit = resolvedAmount > 0 && !busy

  const handleSubmit = async () => {
    if (!canSubmit) return
    setBusy(true)
    const customerId = (order as any).customerId || ''
    if (!customerId) {
      onError('Customer ID not found on this order')
      setBusy(false)
      return
    }
    const result = await refundToWallet(
      order.id,
      customerId,
      order.orderNumber,
      resolvedAmount,
    )
    setBusy(false)
    if (result.success) {
      onSuccess(resolvedAmount)
    } else {
      onError(result.error || 'Unknown error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
              <Wallet size={18} className="text-green-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Refund to Wallet</h3>
              <p className="text-xs text-gray-400">{order.orderNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <XCircle size={20} />
          </button>
        </div>

        {/* Order total info */}
        <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Online Payment</span>
            <span className="font-bold text-gray-900">{formatCurrency(paidAmount)}</span>
          </div>
          {walletSpent > 0 && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-blue-600">Wallet Used</span>
                <span className="font-bold text-blue-600">{formatCurrency(walletSpent)}</span>
              </div>
              <p className="text-[10px] text-blue-600 bg-blue-50 rounded px-2 py-1">
                ℹ️ Wallet credit will NOT be refunded (already in wallet)
              </p>
            </>
          )}
          <div className="flex items-center justify-between border-t border-gray-200 pt-1.5">
            <span className="text-gray-700 font-semibold">Refund Amount</span>
            <span className="font-black text-gray-900">{formatCurrency(maxAmount)}</span>
          </div>
        </div>

        {/* Refund type toggle */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Refund Type</p>
          <div className="grid grid-cols-2 gap-2">
            {(['full', 'partial'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                  mode === m
                    ? 'bg-[#B32B2C] text-white border-[#B32B2C]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-[#B32B2C] hover:text-[#B32B2C]'
                }`}
              >
                {m === 'full' ? `Full (${formatCurrency(maxAmount)})` : 'Custom Amount'}
              </button>
            ))}
          </div>
        </div>

        {/* Custom amount input */}
        {mode === 'partial' && (
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
              Refund Amount (max {formatCurrency(maxAmount)})
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">₹</span>
              <input
                type="number"
                min={1}
                max={maxAmount}
                value={customAmount}
                onChange={e => setCustomAmount(e.target.value)}
                placeholder="0"
                className="w-full pl-7 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#B32B2C]/30 focus:border-[#B32B2C]"
              />
            </div>
            {Number(customAmount) > maxAmount && (
              <p className="text-xs text-red-500 mt-1">Cannot exceed {formatCurrency(maxAmount)} (online payment only)</p>
            )}
          </div>
        )}

        {/* Summary */}
        {resolvedAmount > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm">
            <p className="text-green-700 font-medium">
              <span className="font-bold">{formatCurrency(resolvedAmount)}</span> will be added to the customer's TastyKart wallet and a push notification will be sent.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2 ${
              canSubmit
                ? 'bg-[#B32B2C] hover:bg-[#9a2324]'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            {busy ? (
              <><Loader2 size={14} className="animate-spin" /> Processing…</>
            ) : (
              <><Wallet size={14} /> Confirm Refund</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delivery stage progress tracker ──────────────────────────────────────────

function DeliveryStageTracker({ order }: { order: Order }) {
  const currentIdx = getStageIndex(order)
  if (currentIdx < 0) return null

  return (
    <div className="space-y-0">
      {DELIVERY_STAGES.map((stage, i) => {
        const done    = i < currentIdx
        const current = i === currentIdx
        const future  = i > currentIdx

        return (
          <div key={stage.key} className="flex items-start gap-3">
            {/* Dot + connector */}
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all ${
                done    ? 'bg-green-500  border-green-500  text-white' :
                current ? 'bg-[#B32B2C] border-[#B32B2C]  text-white animate-pulse' :
                          'bg-white      border-gray-200   text-gray-300'
              }`}>
                {done ? (
                  <svg viewBox="0 0 12 12" className="w-3.5 h-3.5" fill="currentColor">
                    <path d="M1.5 6.5l3 3 6-6" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <div className={`w-2 h-2 rounded-full ${current ? 'bg-white' : 'bg-gray-200'}`} />
                )}
              </div>
              {i < DELIVERY_STAGES.length - 1 && (
                <div className={`w-0.5 h-6 ${done ? 'bg-green-400' : 'bg-gray-100'}`} />
              )}
            </div>

            {/* Label */}
            <div className={`pb-1 pt-1 ${i < DELIVERY_STAGES.length - 1 ? 'mb-0' : ''}`}>
              <p className={`text-sm font-medium leading-tight ${
                current ? 'text-[#B32B2C]' :
                done    ? 'text-green-700' :
                          'text-gray-300'
              }`}>
                {stage.label}
              </p>
              {current && (
                <p className="text-xs text-gray-400 mt-0.5">In progress…</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Converts any value (including Firestore Timestamps) to a display string. */
function toStr(val: any): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'string') return val.trim() || '—'
  if (typeof val === 'number') return String(val)
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  // Firestore Timestamp
  if (val?.toDate) {
    return val.toDate().toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }
  // Plain JS Date
  if (val instanceof Date) {
    return val.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }
  // Object with seconds (raw Firestore Timestamp shape)
  if (typeof val === 'object' && typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }
  return String(val)
}

function Section({
  title,
  children,
}: {
  title: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        {title}
      </h4>
      {children}
    </div>
  )
}

function InfoRow({ label, value, bold, accent, small }: {
  label: string
  value: any
  bold?: boolean
  accent?: 'green' | 'blue' | 'orange'
  small?: boolean
}) {
  const accentClass =
    accent === 'green' ? 'text-green-700 font-semibold' :
    accent === 'blue'  ? 'text-blue-700 font-semibold'  :
    accent === 'orange'? 'text-orange-600 font-semibold' : ''
  return (
    <div className={`flex items-start justify-between gap-4 ${small ? 'text-xs' : 'text-sm'}`}>
      <span className={`shrink-0 ${accentClass || 'text-gray-500'}`}>{label}</span>
      <span className={`text-right ${bold ? 'font-bold text-gray-900' : accentClass || 'text-gray-700'}`}>{toStr(value)}</span>
    </div>
  )
}

// ── Chat History component ────────────────────────────────────────────────────

type ChatMsg = {
  id: string
  senderId: string
  senderName: string
  senderType: 'customer' | 'partner'
  message: string
  sentAt: any
}

function ChatHistory({ orderId }: { orderId: string }) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'orders', orderId, 'chat'),
      orderBy('sentAt', 'asc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMsg)))
      setLoading(false)
    }, () => setLoading(false))
    return () => unsub()
  }, [orderId])

  if (loading) {
    return <div className="text-xs text-gray-400 py-2">Loading chat…</div>
  }
  if (messages.length === 0) {
    return <div className="text-xs text-gray-400 italic py-1">No messages yet</div>
  }

  return (
    <div className="space-y-2 max-h-60 overflow-y-auto">
      {messages.map(msg => {
        const isPartner = msg.senderType === 'partner'
        const ts = msg.sentAt?.toDate?.()
        const timeStr = ts
          ? `${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}`
          : ''
        return (
          <div key={msg.id} className={`flex ${isPartner ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-xs ${
              isPartner
                ? 'bg-amber-100 text-amber-900 rounded-br-sm'
                : 'bg-gray-100 text-gray-800 rounded-bl-sm'
            }`}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="font-semibold text-[10px] opacity-70">
                  {isPartner ? '🛵 ' : '👤 '}{msg.senderName}
                </span>
                {timeStr && <span className="text-[10px] opacity-50">{timeStr}</span>}
              </div>
              <p className="leading-snug">{msg.message}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
