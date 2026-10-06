import { useState, useEffect, useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { motion } from 'framer-motion'
import { Eye, CheckCircle, XCircle, AlertTriangle, Loader2, Bike, Star, DollarSign, Users, MapPin, Shield, CreditCard, Ban, RefreshCw, FileText, Award, TrendingUp, Wallet } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Modal'
import { type DeliveryPartner, type Order } from '@/data/dummy'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { app } from '@/lib/firebase'
import { 
  subscribeToCollection, 
  approveDeliveryPartner, 
  blockDeliveryPartner, 
  unblockDeliveryPartner,
  subscribeToTransactions,
  subscribeToAdminSettings,
} from '@/lib/firebaseService'

function toMillis(value: unknown): number {
  if (!value) return 0
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string' || typeof value === 'number') {
    const time = new Date(value).getTime()
    return Number.isNaN(time) ? 0 : time
  }
  if (typeof value === 'object') {
    const record = value as { toDate?: () => Date; seconds?: number }
    if (typeof record.toDate === 'function') return record.toDate().getTime()
    if (typeof record.seconds === 'number') return record.seconds * 1000
  }
  return 0
}

/** Monday 00:00 local time, matching the delivery app's weekly incentive window. */
function weekStartMs() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const mondayOffset = start.getDay() === 0 ? 6 : start.getDay() - 1
  start.setDate(start.getDate() - mondayOffset)
  return start.getTime()
}

function incentiveFor(trips: number, slots: Array<{ trips: number; amount: number }>) {
  let bonus = 0
  for (const slot of [...slots].sort((a, b) => a.trips - b.trips)) {
    if (trips >= slot.trips) bonus = slot.amount
  }
  return bonus
}

const statusDot: Record<string, string> = {
  online: 'bg-green-500', offline: 'bg-gray-400', busy: 'bg-amber-500', available: 'bg-blue-500'
}

const colorMap = {
  red:    { bg: 'bg-red-50', icon: 'text-red-600' },
  green:  { bg: 'bg-green-50', icon: 'text-green-600' },
  blue:   { bg: 'bg-blue-50', icon: 'text-blue-600' },
  amber:  { bg: 'bg-amber-50', icon: 'text-amber-600' },
}

export function DeliveryPartners() {
  const [partnersList, setPartnersList] = useState<DeliveryPartner[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [incentiveSlots, setIncentiveSlots] = useState<Array<{ trips: number; amount: number }>>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<DeliveryPartner | null>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [actionLoading, setActionLoading] = useState(false)
  const [syncingTip, setSyncingTip] = useState(false)
  const { success, error: showError } = useToast()

  const handleSyncTip = async (partnerId: string) => {
    setSyncingTip(true)
    try {
      const fns = getFunctions(app, 'us-central1')
      const backfill = httpsCallable<
        { partnerId: string },
        { success: boolean; totalTips: number; orderCount: number }
      >(fns, 'backfillPartnerTipBalance')
      const result = await backfill({ partnerId })
      const { totalTips, orderCount } = result.data
      success('Tip Balance Synced', `₹${totalTips} tip from ${orderCount} orders credited`)
    } catch (err: any) {
      showError('Sync Failed', err?.message || 'Could not sync tip balance')
    } finally {
      setSyncingTip(false)
    }
  }

  const weekStats = useMemo(() => {
    const start = weekStartMs()
    const trips = new Map<string, number>()
    for (const order of orders) {
      if (order.status !== 'delivered' || !order.deliveryPartnerId) continue
      if (toMillis(order.createdAt) < start) continue
      trips.set(order.deliveryPartnerId, (trips.get(order.deliveryPartnerId) || 0) + 1)
    }
    return trips
  }, [orders])

  const partnerWeek = (partner: DeliveryPartner) => {
    const count = weekStats.get(partner.id) || (partner.uid ? weekStats.get(partner.uid) || 0 : 0)
    return { trips: count, amount: incentiveFor(count, incentiveSlots) }
  }

  /** Breaks down COD-delivered orders for a partner into the 3 money buckets. */
  const partnerCodBreakdown = (partnerId: string) => {
    const codOrders = orders.filter(o => {
      if (o.status !== 'delivered') return false
      if (o.deliveryPartnerId !== partnerId) return false
      const pm = (o.paymentMethod || '').toLowerCase()
      return pm.includes('cash') || pm.includes('cod')
    })
    return codOrders.reduce(
      (acc, o) => {
        const fee   = o.deliveryFee || 0
        const tip   = (o as any).tip || 0
        const total = o.total || 0
        const orderAmt = Math.max(0, total - fee - tip)
        return {
          deliveryFeeTotal: acc.deliveryFeeTotal + fee,
          tipTotal:         acc.tipTotal + tip,
          orderAmtTotal:    acc.orderAmtTotal + orderAmt,
          orderCount:       acc.orderCount + 1,
        }
      },
      { deliveryFeeTotal: 0, tipTotal: 0, orderAmtTotal: 0, orderCount: 0 },
    )
  }

  const totalWallet = partnersList.reduce((sum, partner) => sum + (partner.pocketBalance || 0), 0)
  const totalIncentive = partnersList.reduce((sum, partner) => sum + partnerWeek(partner).amount, 0)
  const totalTips = partnersList.reduce((sum, partner) => sum + ((partner as any).tipBalance || 0), 0)
  const totalCash = partnersList.reduce((sum, partner) => sum + ((partner as any).cashInHand || 0), 0)
  const totalEarnings = partnersList.reduce((sum, partner) => sum + (partner.earnings || 0), 0)

  // Quick stats
  const stats = [
    { label: 'Total Partners', value: partnersList.length, icon: Users, color: 'blue' as const },
    { label: 'Online Now', value: partnersList.filter(p => p.status === 'online').length, icon: Bike, color: 'green' as const },
    { label: 'Approved', value: partnersList.filter(p => p.approved).length, icon: Shield, color: 'green' as const },
    { label: 'Pending Approval', value: partnersList.filter(p => !p.approved).length, icon: AlertTriangle, color: 'amber' as const },
    { label: 'Total Earnings', value: formatCurrency(totalEarnings), icon: DollarSign, color: 'green' as const },
    { label: 'Total Pocket Balance', value: formatCurrency(totalWallet), icon: Wallet, color: 'blue' as const },
    { label: 'Total Tips', value: formatCurrency(totalTips), icon: DollarSign, color: 'amber' as const },
    { label: 'Total Cash in Hand', value: formatCurrency(totalCash), icon: CreditCard, color: 'green' as const },
    { label: 'Weekly Incentives', value: formatCurrency(totalIncentive), icon: Award, color: 'amber' as const },
  ]

  useEffect(() => {
    const unsubs = [
      subscribeToCollection<DeliveryPartner>('deliveryPartners', (data) => {
        // Sort by creation date descending (newest first)
        const toMs = (val: any): number => {
          if (!val) return 0
          if (typeof val === 'string' || typeof val === 'number') return new Date(val).getTime() || 0
          if (typeof val === 'object' && typeof val.toDate === 'function') return val.toDate().getTime()
          if (typeof val === 'object' && typeof val.seconds === 'number') return val.seconds * 1000
          return 0
        }
        data.sort((a, b) => {
          // Primary sort: newest created at top (most recent first)
          return toMs(b.joinedDate || (b as any).createdAt) - toMs(a.joinedDate || (a as any).createdAt)
        })
        setPartnersList(data)
        setLoading(false)
      }),
      subscribeToCollection<Order>('orders', setOrders),
      subscribeToAdminSettings((settings) => {
        setIncentiveSlots(settings.deliveryPartner.incentiveSlots || [])
      }),
    ]
    return () => unsubs.forEach(unsub => unsub())
  }, [])

  useEffect(() => {
    setSelected(prev => {
      if (!prev) return prev
      return partnersList.find(partner => partner.id === prev.id) ?? prev
    })
  }, [partnersList])

  // Load transactions when partner is selected
  useEffect(() => {
    if (selected?.id) {
      const unsub = subscribeToTransactions(selected.id, setTransactions)
      return () => unsub()
    }
  }, [selected?.id])

  const handleApprove = async (partnerId: string) => {
    setActionLoading(true)
    const result = await approveDeliveryPartner(partnerId)
    setActionLoading(false)
    if (result.success) {
      success('Partner approved successfully!')
      setSelected(null)
    } else {
      showError(result.error || 'Failed to approve partner')
    }
  }

  const handleBlock = async (partnerId: string, reason: string) => {
    setActionLoading(true)
    const result = await blockDeliveryPartner(partnerId, reason)
    setActionLoading(false)
    if (result.success) {
      success('Partner blocked successfully!')
      setSelected(null)
    } else {
      showError(result.error || 'Failed to block partner')
    }
  }

  const handleUnblock = async (partnerId: string) => {
    setActionLoading(true)
    const result = await unblockDeliveryPartner(partnerId)
    setActionLoading(false)
    if (result.success) {
      success('Partner unblocked successfully!')
      setSelected(null)
    } else {
      showError(result.error || 'Failed to unblock partner')
    }
  }

  const columns: ColumnDef<DeliveryPartner, unknown>[] = [
    {
      id: 'partner',
      header: 'Partner',
      cell: ({ row: { original: p } }) => (
        <div className="flex items-center gap-3">
          <div className="relative">
            <img src={p.avatar} alt={p.name} className="w-9 h-9 rounded-full bg-gray-100" />
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${statusDot[p.status]}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{p.name}</p>
            <p className="text-xs text-gray-400">{p.phone}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'vehicle',
      header: 'Vehicle',
      cell: ({ row }) => (
        <div>
          <span className="text-xs bg-gray-100 px-2 py-1 rounded-md font-medium">{row.original.vehicle}</span>
          <p className="text-xs text-gray-400 mt-0.5">{row.original.vehicleNumber}</p>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Live Status',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${statusDot[row.original.status]}`} />
          <span className="text-sm capitalize">{row.original.status}</span>
        </div>
      ),
    },
    {
      accessorKey: 'rating',
      header: 'Rating',
      cell: ({ row }) => <span className="text-sm font-semibold">⭐ {row.original.rating}</span>,
    },
    {
      accessorKey: 'completedOrders',
      header: 'Deliveries',
      cell: ({ row }) => <span className="text-sm">{row.original.completedOrders}</span>,
    },
    {
      accessorKey: 'earnings',
      header: 'Earnings',
      cell: ({ row }) => <span className="text-sm font-semibold">{formatCurrency(row.original.earnings)}</span>,
    },
    {
      id: 'wallet',
      header: 'Pocket Balance',
      cell: ({ row }) => (
        <span className="text-sm font-semibold text-gray-900">{formatCurrency(row.original.pocketBalance || 0)}</span>
      ),
    },
    {
      id: 'tips',
      header: 'Tips',
      cell: ({ row }) => (
        <span className="text-sm font-semibold text-purple-600">{formatCurrency((row.original as any).tipBalance || 0)}</span>
      ),
    },
    {
      id: 'cashInHand',
      header: 'Cash in Hand',
      cell: ({ row }) => (
        <span className="text-sm font-semibold text-green-600">{formatCurrency((row.original as any).cashInHand || 0)}</span>
      ),
    },
    {
      id: 'incentive',
      header: 'Incentive',
      cell: ({ row }) => {
        const week = partnerWeek(row.original)
        return (
          <div>
            <p className="text-sm font-semibold text-gray-900">{formatCurrency(week.amount)}</p>
            <p className="text-[11px] text-gray-400">{week.trips} trips this week</p>
          </div>
        )
      },
    },
    {
      id: 'approval',
      header: 'Approved',
      cell: ({ row }) => (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${row.original.approved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
          {row.original.approved ? '✓ Approved' : '⏳ Pending'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <button onClick={e => { e.stopPropagation(); setSelected(row.original) }}
          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
          <Eye size={15} />
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-6 pb-8">

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
          <Loader2 size={22} className="animate-spin text-[#B32B2C]" />
          <span className="text-sm font-medium">Loading partners from Firebase...</span>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <DataTable data={partnersList} columns={columns} searchPlaceholder="Search partners..." onRowClick={setSelected} />
        </div>
      )}

      <Drawer open={!!selected} onClose={() => setSelected(null)} title="Partner Details" width="w-[600px]">
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <div className="relative">
                <img src={selected.avatar} alt={selected.name} className="w-16 h-16 rounded-2xl bg-gray-100" />
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${statusDot[selected.status]}`} />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-gray-900">{selected.name}</h2>
                <p className="text-sm text-gray-500">{selected.email}</p>
                <p className="text-sm text-gray-500">{selected.phone}</p>
                <div className="flex items-center gap-2 mt-2">
                  <StatusBadge status={selected.status} />
                  {selected.status === 'blocked' ? (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700 flex items-center gap-1">
                      <Ban size={12} /> Blocked
                    </span>
                  ) : selected.approved ? (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700 flex items-center gap-1">
                      <CheckCircle size={12} /> Approved
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 flex items-center gap-1">
                      <AlertTriangle size={12} /> Pending Approval
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Rating', value: `⭐ ${selected.rating || 0}`, icon: Star },
                { label: 'Deliveries', value: selected.completedOrders?.toString() || '0', icon: Bike },
                { label: 'Total Earnings', value: formatCurrency(selected.earnings || 0), icon: DollarSign },
                { label: 'Pocket Balance', value: formatCurrency(selected.pocketBalance || 0), icon: Wallet },
                { label: 'Tips', value: formatCurrency((selected as any).tipBalance || 0), icon: DollarSign },
                { label: 'Cash in Hand', value: formatCurrency((selected as any).cashInHand || 0), icon: CreditCard },
                { label: 'Incentive', value: formatCurrency(partnerWeek(selected).amount), icon: Award },
                { label: 'Accept Rate', value: `${selected.acceptRate || 0}%`, icon: TrendingUp },
                { label: 'Cancelled', value: selected.cancelledOrders?.toString() || '0', icon: XCircle },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <s.icon size={13} className="text-gray-400" />
                    <p className="text-xs text-gray-400">{s.label}</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{s.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-4 bg-blue-50 border border-blue-100">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet size={16} className="text-blue-600" />
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Total wallet</p>
                </div>
                <p className="text-2xl font-black text-gray-900">{formatCurrency(selected.pocketBalance || 0)}</p>
                <p className="text-xs text-blue-600 mt-1">Amount available to withdraw</p>
              </div>
              <div className="rounded-xl p-4 bg-amber-50 border border-amber-100">
                <div className="flex items-center gap-2 mb-1">
                  <Award size={16} className="text-amber-600" />
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Weekly incentive</p>
                </div>
                <p className="text-2xl font-black text-gray-900">{formatCurrency(partnerWeek(selected).amount)}</p>
                <p className="text-xs text-amber-700 mt-1">{partnerWeek(selected).trips} delivered trips this week</p>
              </div>
            </div>

            {/* Tip Balance */}
            <div className="rounded-xl p-4 bg-purple-50 border border-purple-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign size={16} className="text-purple-600" />
                  <div>
                    <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider">Tip Balance</p>
                    <p className="text-2xl font-black text-gray-900 mt-0.5">
                      {formatCurrency((selected as any).tipBalance || 0)}
                    </p>
                    <p className="text-xs text-purple-600 mt-0.5">Tips from customers — partner's money</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={syncingTip}
                  onClick={() => handleSyncTip(selected.id)}
                  icon={syncingTip ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                >
                  {syncingTip ? 'Syncing…' : 'Sync'}
                </Button>
              </div>
            </div>

            {/* Cash in Hand — COD Earnings Breakdown */}
            {(() => {
              const cod = partnerCodBreakdown(selected.id)
              const cashInHand = (selected as any).cashInHand || 0
              return (
                <div className="rounded-xl border border-orange-200 bg-orange-50 overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                    <CreditCard size={16} className="text-orange-600" />
                    <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider">COD Cash Breakdown</p>
                  </div>

                  {/* Stacked bar */}
                  {cod.orderCount > 0 && (() => {
                    const grandTotal = cod.deliveryFeeTotal + cod.tipTotal + cod.orderAmtTotal
                    const feePct   = grandTotal > 0 ? (cod.deliveryFeeTotal / grandTotal) * 100 : 0
                    const tipPct   = grandTotal > 0 ? (cod.tipTotal / grandTotal) * 100 : 0
                    const adminPct = grandTotal > 0 ? (cod.orderAmtTotal / grandTotal) * 100 : 0
                    return (
                      <div className="mx-4 mb-3">
                        <div className="flex h-2 rounded-full overflow-hidden bg-gray-200">
                          {feePct > 0   && <div style={{ width: `${feePct}%` }}   className="bg-green-500" />}
                          {tipPct > 0   && <div style={{ width: `${tipPct}%` }}   className="bg-purple-500" />}
                          {adminPct > 0 && <div style={{ width: `${adminPct}%` }} className="bg-orange-500" />}
                        </div>
                        <div className="flex gap-3 mt-1.5">
                          <span className="flex items-center gap-1 text-[10px] text-green-700"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Fee</span>
                          <span className="flex items-center gap-1 text-[10px] text-purple-700"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />Tip</span>
                          <span className="flex items-center gap-1 text-[10px] text-orange-700"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />TastyKart</span>
                        </div>
                      </div>
                    )
                  })()}

                  {/* 3 buckets */}
                  <div className="grid grid-cols-3 divide-x divide-orange-200 border-t border-orange-200">
                    <div className="px-3 py-3">
                      <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wide">Delivery Fee</p>
                      <p className="text-base font-black text-green-800 mt-0.5">{formatCurrency(cod.deliveryFeeTotal)}</p>
                      <p className="text-[10px] text-green-600 mt-0.5">→ Pocket Balance</p>
                    </div>
                    <div className="px-3 py-3">
                      <p className="text-[10px] font-semibold text-purple-700 uppercase tracking-wide">Tips</p>
                      <p className="text-base font-black text-purple-800 mt-0.5">{formatCurrency(cod.tipTotal)}</p>
                      <p className="text-[10px] text-purple-600 mt-0.5">→ Tip Balance</p>
                    </div>
                    <div className="px-3 py-3">
                      <p className="text-[10px] font-semibold text-orange-700 uppercase tracking-wide">Order Amount</p>
                      <p className="text-base font-black text-orange-800 mt-0.5">{formatCurrency(cashInHand)}</p>
                      <p className="text-[10px] text-orange-600 mt-0.5">→ TastyKart (held)</p>
                    </div>
                  </div>

                  {/* Footer note */}
                  <div className="px-4 py-2.5 bg-orange-100 border-t border-orange-200">
                    <p className="text-[11px] text-orange-700">
                      <span className="font-semibold">Cash in Hand ({formatCurrency(cashInHand)})</span> = items + tax + platform fee from COD orders. This is TastyKart's money, not the partner's earnings.
                    </p>
                  </div>
                </div>
              )
            })()}

            {/* Financial Summary */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign size={18} className="text-blue-600" />
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Financial Summary</h4>
              </div>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                  <span className="text-sm text-gray-600">Total Earnings (lifetime)</span>
                  <span className="text-sm font-bold text-gray-900">{formatCurrency(selected.earnings || 0)}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                  <span className="text-sm text-gray-600">Pocket Balance</span>
                  <span className="text-sm font-bold text-blue-600">{formatCurrency(selected.pocketBalance || 0)}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                  <span className="text-sm text-gray-600">Tip Balance</span>
                  <span className="text-sm font-bold text-purple-600">{formatCurrency((selected as any).tipBalance || 0)}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-orange-50 rounded-lg border border-orange-200">
                  <div>
                    <span className="text-sm text-gray-600">Cash in Hand</span>
                    <p className="text-[10px] text-orange-600 leading-none mt-0.5">Order amount only (TastyKart's money — not partner's)</p>
                  </div>
                  <span className="text-sm font-bold text-orange-600">{formatCurrency((selected as any).cashInHand || 0)}</span>
                </div>
                {/* Partner's own withdrawable money = Pocket + Tips only */}
                <div className="flex justify-between items-center p-2 bg-blue-100 rounded-lg border-t-2 border-blue-300 mt-2">
                  <div>
                    <span className="text-sm font-semibold text-gray-900">Partner's Withdrawable</span>
                    <p className="text-[10px] text-blue-600 leading-none mt-0.5">Pocket + Tips (excludes cash in hand)</p>
                  </div>
                  <span className="text-lg font-black text-blue-700">
                    {formatCurrency(
                      (selected.pocketBalance || 0) +
                      ((selected as any).tipBalance || 0)
                    )}
                  </span>
                </div>
              </div>
            </div>
            {selected.currentLat && selected.currentLng && (
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin size={16} className="text-blue-600" />
                  <h4 className="text-xs font-semibold text-blue-900 uppercase tracking-wider">Current Location</h4>
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-600">Latitude</span>
                    <span className="font-mono text-blue-900">{selected.currentLat.toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600">Longitude</span>
                    <span className="font-mono text-blue-900">{selected.currentLng.toFixed(6)}</span>
                  </div>
                  {selected.lastLocationUpdate && (
                    <div className="flex justify-between pt-1 border-t border-blue-200">
                      <span className="text-blue-600">Last Updated</span>
                      <span className="text-blue-900">{formatDate(selected.lastLocationUpdate)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Vehicle */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Bike size={16} className="text-gray-500" />
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Vehicle Info</h4>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-400">Type</span><span className="font-medium">{selected.vehicle}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Number</span><span className="font-medium">{selected.vehicleNumber}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">City</span><span className="font-medium">{selected.city}</span></div>
              </div>
            </div>

            {/* Documents */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText size={16} className="text-gray-500" />
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">KYC Documents</h4>
                {selected.documentsComplete && (
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">Complete</span>
                )}
              </div>
              {selected.documents && Object.keys(selected.documents).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(selected.documents).map(([key, value]) => {
                    // value should be a URL string
                    const isUrl = typeof value === 'string' && value.startsWith('http')
                    const displayName = key
                      .replace(/([A-Z])/g, ' $1')
                      .replace(/Front|Back/g, (match) => ` ${match}`)
                      .trim()
                      .replace(/\b\w/g, (char) => char.toUpperCase())
                    
                    return (
                      <div key={key} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-700 capitalize">{displayName}</p>
                          {isUrl ? (
                            <div className="mt-2">
                              <a
                                href={value}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:text-blue-800 hover:underline break-all"
                              >
                                View Document →
                              </a>
                              <div className="mt-2 rounded-lg overflow-hidden bg-gray-100 max-h-32">
                                <img
                                  src={value}
                                  alt={displayName}
                                  className="w-full h-full object-contain"
                                  onError={(e) => {
                                    e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="gray" stroke-width="2"%3E%3Crect x="3" y="3" width="18" height="18" rx="2" ry="2"/%3E%3Ccircle cx="8.5" cy="8.5" r="1.5"/%3E%3Cpolyline points="21 15 16 10 5 21"/%3E%3C/svg%3E'
                                  }}
                                />
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 italic mt-1">No URL available</p>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          {isUrl ? (
                            <CheckCircle size={16} className="text-green-600" />
                          ) : (
                            <XCircle size={16} className="text-gray-300" />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No documents uploaded</p>
              )}
            </div>

            {/* Bank Details */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard size={16} className="text-gray-500" />
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Bank Details</h4>
                {selected.ifscVerified && (
                  <CheckCircle size={13} className="ml-auto text-green-600" />
                )}
              </div>
              <div className="space-y-2 text-sm">
                {selected.accountHolderName && (
                  <div className="flex justify-between"><span className="text-gray-400">Account Holder</span><span className="font-medium">{selected.accountHolderName}</span></div>
                )}
                {selected.bankAccount && (
                  <div className="flex justify-between"><span className="text-gray-400">Account Number</span><span className="font-mono">{selected.bankAccount}</span></div>
                )}
                {selected.ifsc && (
                  <div className="flex justify-between"><span className="text-gray-400">IFSC Code</span><span className="font-mono">{selected.ifsc}</span></div>
                )}
                {selected.upiId && (
                  <div className="flex justify-between"><span className="text-gray-400">UPI ID</span><span className="font-mono">{selected.upiId}</span></div>
                )}
                {!selected.bankAccount && !selected.ifsc && !selected.upiId && (
                  <p className="text-xs text-gray-400 italic">No bank details provided</p>
                )}
              </div>
            </div>

            {/* Training & Compliance */}
            {(selected.trainingCompleted && selected.trainingCompleted.length > 0) && (
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Award size={16} className="text-gray-500" />
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Training Completed</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(selected.trainingCompleted ?? []).map(training => (
                    <span key={training} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-700 flex items-center gap-1">
                      <CheckCircle size={12} />
                      {training.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Transactions */}
            {transactions.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <DollarSign size={16} className="text-gray-500" />
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recent Transactions</h4>
                  </div>
                  <span className="text-xs text-gray-400">{transactions.length} total</span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {transactions.slice(0, 10).map(txn => (
                    <div key={txn.id} className="flex items-center justify-between p-2 bg-white rounded-lg text-xs">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{txn.title}</p>
                        <p className="text-gray-400 text-[11px]">{formatDate(txn.createdAt)}</p>
                      </div>
                      <span className={`font-bold ${txn.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {txn.amount >= 0 ? '+' : ''}{formatCurrency(txn.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Block Reason if blocked */}
            {selected.status === 'blocked' && selected.blockedReason && (
              <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                <div className="flex items-center gap-2 mb-2">
                  <Ban size={16} className="text-red-600" />
                  <h4 className="text-xs font-semibold text-red-900 uppercase tracking-wider">Block Reason</h4>
                </div>
                <p className="text-sm text-red-800">{selected.blockedReason}</p>
                {selected.blockedAt && (
                  <p className="text-xs text-red-600 mt-2">Blocked on: {formatDate(selected.blockedAt)}</p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {!selected.approved && selected.status !== 'blocked' && (
                <Button 
                  size="sm" 
                  variant="success" 
                  icon={<CheckCircle size={14} />} 
                  className="flex-1" 
                  onClick={() => handleApprove(selected.id)}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Approving...' : 'Approve Partner'}
                </Button>
              )}
              {selected.status === 'blocked' ? (
                <Button 
                  size="sm" 
                  variant="success" 
                  icon={<RefreshCw size={14} />} 
                  className="flex-1" 
                  onClick={() => handleUnblock(selected.id)}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Unblocking...' : 'Unblock Partner'}
                </Button>
              ) : (
                <Button 
                  size="sm" 
                  variant="danger" 
                  icon={<Ban size={14} />} 
                  className={selected.approved ? 'flex-1' : ''} 
                  onClick={() => handleBlock(selected.id, 'Blocked by admin')}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Blocking...' : selected.approved ? 'Block Partner' : 'Reject'}
                </Button>
              )}
              {selected.approved && selected.status !== 'blocked' && (
                <Button size="sm" variant="outline" icon={<AlertTriangle size={14} />} onClick={() => success('Warning notification sent')}>
                  Send Warning
                </Button>
              )}
            </div>

            {/* Metadata */}
            <div className="pt-3 border-t border-gray-200 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Partner ID</span>
                <span className="font-mono text-gray-600">{selected.id}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Joined</span>
                <span className="text-gray-600">{formatDate(selected.joinedDate)}</span>
              </div>
              {selected.updatedAt && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Last Updated</span>
                  <span className="text-gray-600">{formatDate(selected.updatedAt)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}