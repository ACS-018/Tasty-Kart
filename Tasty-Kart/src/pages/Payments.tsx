import { useState, useEffect, useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Loader2, DollarSign, Users, TrendingUp, TrendingDown, Bike, CreditCard, Filter, RotateCcw } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import {
  subscribeToTransactions,
  subscribeToWalletTransactions,
  subscribeToOrders,
  subscribeToDeliveryPartners,
} from '@/lib/firebaseService'
import type { Transaction, DeliveryPartner } from '@/data/dummy'

// ── Method icon map ────────────────────────────────────────────────────────────
const methodIcons: Record<string, string> = {
  UPI: '📱',
  Razorpay: '💳',
  Cash: '💵',
  Wallet: '👛',
  auto: '🤖',
  bank_transfer: '🏦',
  upi: '📱',
  online: '💳',
}

// ── Type pill colours ──────────────────────────────────────────────────────────
const typeColors: Record<string, { bg: string; text: string }> = {
  order_earning:  { bg: 'bg-green-50',  text: 'text-green-700'  },
  ORDER_EARNING:  { bg: 'bg-green-50',  text: 'text-green-700'  },
  payout:         { bg: 'bg-blue-50',   text: 'text-blue-700'   },
  withdrawal:     { bg: 'bg-blue-50',   text: 'text-blue-700'   },
  deduction:      { bg: 'bg-red-50',    text: 'text-red-700'    },
  late_delivery:  { bg: 'bg-red-50',    text: 'text-red-700'    },
  tip:            { bg: 'bg-amber-50',  text: 'text-amber-700'  },
  refund:         { bg: 'bg-rose-50',   text: 'text-rose-700'   },
  BONUS:          { bg: 'bg-amber-50',  text: 'text-amber-700'  },
  INCENTIVE:      { bg: 'bg-purple-50', text: 'text-purple-700' },
  ADJUSTMENT:     { bg: 'bg-gray-50',   text: 'text-gray-700'   },
  DEDUCTION:      { bg: 'bg-red-50',    text: 'text-red-700'    },
  PAYOUT:         { bg: 'bg-blue-50',   text: 'text-blue-700'   },
}

// ── Unified row type (normalised from 3 sources) ───────────────────────────────
interface PaymentRow {
  id:          string
  source:      'transaction' | 'wallet' | 'refund'
  type:        string
  title:       string
  description?: string
  orderNumber?: string
  partnerId?:  string
  partnerName?: string
  customerName?: string
  method:      string
  amount:      number
  direction:   'CREDIT' | 'DEBIT'
  status:      string
  createdAt:   any
  raw:         any
}

function normaliseTransaction(t: any): PaymentRow {
  return {
    id:           t.id,
    source:       'transaction',
    type:         t.type || 'payment',
    title:        t.title || 'Payment',
    orderNumber:  t.orderNumber,
    partnerId:    t.partnerId,
    customerName: t.customerName,
    method:       t.method || 'Cash',
    amount:       Number(t.amount) || 0,
    direction:    Number(t.amount) >= 0 ? 'CREDIT' : 'DEBIT',
    status:       t.status || 'pending',
    createdAt:    t.createdAt,
    raw:          t,
  }
}

function normaliseWalletTxn(w: any): PaymentRow {
  return {
    id:          w.id,
    source:      'wallet',
    type:        w.type || 'ORDER_EARNING',
    title:       w.description || `Partner earning`,
    orderNumber: w.orderId,
    partnerId:   w.deliveryBoyId,
    method:      'Wallet',
    amount:      w.direction === 'DEBIT' ? -(Number(w.amount) || 0) : (Number(w.amount) || 0),
    direction:   w.direction || 'CREDIT',
    status:      'completed',
    createdAt:   w.createdAt,
    raw:         w,
  }
}

function normaliseRefund(order: any): PaymentRow {
  const num = order.orderNumber || order.id
  return {
    id:           `refund_${order.id}`,
    source:       'refund',
    type:         'refund',
    title:        `Refund for Order ${num.startsWith('#') ? num : '#' + num}`,
    orderNumber:  num,
    customerName: order.customerName,
    method:       order.paymentMethod || 'Wallet',
    amount:       -(Number(order.refundAmount) || 0),
    direction:    'DEBIT',
    status:       'completed',
    createdAt:    order.refundedAt || order.updatedAt,
    raw:          order,
  }
}

// ── Component ──────────────────────────────────────────────────────────────────
export function Payments() {
  const [transactions,    setTransactions]    = useState<any[]>([])
  const [walletTxns,      setWalletTxns]      = useState<any[]>([])
  const [orders,          setOrders]          = useState<any[]>([])
  const [partners,        setPartners]        = useState<DeliveryPartner[]>([])
  const [loading,         setLoading]         = useState(true)
  const [filterType,      setFilterType]      = useState<'all' | 'customer' | 'partner' | 'refund'>('all')

  useEffect(() => {
    let loaded = 0
    const done = () => { loaded++; if (loaded >= 4) setLoading(false) }

    const u1 = subscribeToTransactions(null, (d) => { setTransactions(d); done() })
    const u2 = subscribeToWalletTransactions((d) => { setWalletTxns(d); done() })
    const u3 = subscribeToOrders((d) => { setOrders(d); done() })
    const u4 = subscribeToDeliveryPartners((d) => { setPartners(d); done() })
    return () => { u1(); u2(); u3(); u4() }
  }, [])

  // ── Build unified rows ───────────────────────────────────────────────────────
  const allRows = useMemo<PaymentRow[]>(() => {
    const txRows   = transactions.map(normaliseTransaction)
    const wtRows   = walletTxns.map(normaliseWalletTxn)
    const refRows  = orders
      .filter(o => Number(o.refundAmount) > 0 && (o.refundedAt || o.refundStatus === 'processed'))
      .map(normaliseRefund)

    // Merge & deduplicate by id, sort newest first
    const map = new Map<string, PaymentRow>()
    ;[...txRows, ...wtRows, ...refRows].forEach(r => {
      if (!map.has(r.id)) map.set(r.id, r)
    })
    return Array.from(map.values()).sort((a, b) => {
      const ta = a.createdAt?.toDate?.()?.getTime?.() ?? new Date(a.createdAt || 0).getTime()
      const tb = b.createdAt?.toDate?.()?.getTime?.() ?? new Date(b.createdAt || 0).getTime()
      return tb - ta
    })
  }, [transactions, walletTxns, orders])

  // ── Filter by tab ─────────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    if (filterType === 'all')      return allRows
    if (filterType === 'refund')   return allRows.filter(r => r.source === 'refund' || r.type === 'refund')
    if (filterType === 'partner')  return allRows.filter(r => r.partnerId || r.source === 'wallet')
    if (filterType === 'customer') return allRows.filter(r => (r.customerName || r.orderNumber) && !r.partnerId && r.source !== 'wallet')
    return allRows
  }, [allRows, filterType])

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    // Customer revenue = sum of all delivered orders' totals
    const customerRevenue = orders
      .filter(o => o.status === 'delivered')
      .reduce((s: number, o: any) => s + (Number(o.total) || 0), 0)

    // Partner earnings — use the `earnings` field on deliveryPartner docs
    // (set by the delivery-boy app after each order). Fall back to
    // totalEarnings / walletBalance if earnings is 0/missing.
    const partnerEarnings = partners
      .reduce((s: number, p: any) => {
        const v = Number(p.earnings) || Number(p.totalEarnings) || Number(p.currentWalletBalance) || Number(p.pocketBalance) || 0
        return s + v
      }, 0)

    // Partner payouts = approved/completed payout requests
    const partnerPayouts = transactions
      .filter((t: any) => ['payout', 'withdrawal', 'PAYOUT'].includes(t.type || '') && t.status === 'completed')
      .reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0)

    // Total refunds issued
    const totalRefunds = orders
      .filter((o: any) => Number(o.refundAmount) > 0)
      .reduce((s: number, o: any) => s + Number(o.refundAmount), 0)

    const pendingCount = filteredRows.filter(r => r.status === 'pending').length

    return { customerRevenue, partnerEarnings, partnerPayouts, totalRefunds, pendingCount }
  }, [transactions, walletTxns, partners, orders, filteredRows])

  // ── Columns ───────────────────────────────────────────────────────────────────
  const columns: ColumnDef<PaymentRow, unknown>[] = [
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => {
        const r = row.original
        const type = r.type || 'payment'
        const colors = typeColors[type] || { bg: 'bg-gray-50', text: 'text-gray-700' }
        const icon = r.source === 'refund'
          ? <RotateCcw size={12} />
          : r.partnerId || r.source === 'wallet'
            ? <Bike size={12} />
            : <CreditCard size={12} />
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${colors.bg} ${colors.text}`}>
            {icon}
            {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </span>
        )
      },
    },
    {
      accessorKey: 'title',
      header: 'Description',
      cell: ({ row }) => {
        const r = row.original
        return (
          <div>
            <p className="text-sm font-medium text-gray-900">{r.title}</p>
            {r.orderNumber && (
              <p className="text-xs text-[#B32B2C] font-semibold">
                {r.orderNumber.startsWith('#') ? r.orderNumber : `#${r.orderNumber}`}
              </p>
            )}
            {r.customerName && (
              <p className="text-xs text-gray-500">{r.customerName}</p>
            )}
            {r.partnerName && (
              <p className="text-xs text-gray-400">{r.partnerName}</p>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'method',
      header: 'Method',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="text-lg">{methodIcons[row.original.method] || '💳'}</span>
          <span className="text-sm font-medium capitalize">
            {String(row.original.method || '—').replace(/_/g, ' ')}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ row }) => {
        const amount = Number(row.original.amount)
        const safe = Number.isFinite(amount) ? amount : 0
        const isPos = safe >= 0
        return (
          <div className="flex items-center gap-1.5">
            {isPos
              ? <TrendingUp  size={14} className="text-green-600" />
              : <TrendingDown size={14} className="text-red-600"   />}
            <span className={`text-sm font-bold ${isPos ? 'text-green-700' : 'text-red-700'}`}>
              {isPos ? '+' : ''}{formatCurrency(safe)}
            </span>
          </div>
        )
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const s = row.original.status || 'pending'
        const c = s === 'completed' || s === 'paid'
          ? 'bg-green-100 text-green-700'
          : s === 'failed' || s === 'rejected'
          ? 'bg-red-100 text-red-700'
          : s === 'approved'
          ? 'bg-blue-100 text-blue-700'
          : 'bg-amber-100 text-amber-700'
        return (
          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${c}`}>
            {s}
          </span>
        )
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Date & Time',
      cell: ({ row }) => (
        <span className="text-xs text-gray-400">{formatDateTime(row.original.createdAt)}</span>
      ),
    },
  ]

  // ── Render ────────────────────────────────────────────────────────────────────
  const refundCount = allRows.filter(r => r.source === 'refund' || r.type === 'refund').length

  return (
    <div className="space-y-5">

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { key: 'all',      label: 'All',              icon: null },
          { key: 'customer', label: 'Customer',          icon: <Users size={14} /> },
          { key: 'partner',  label: 'Delivery Partner',  icon: <Bike size={14} /> },
          { key: 'refund',   label: `Refunds${refundCount > 0 ? ` (${refundCount})` : ''}`, icon: <RotateCcw size={14} /> },
        ] as const).map(({ key, label, icon }) => (
          <Button
            key={key}
            size="sm"
            variant={filterType === key ? 'primary' : 'outline'}
            icon={icon ?? undefined}
            onClick={() => setFilterType(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: 'Customer Revenue',  value: formatCurrency(stats.customerRevenue),  bg: 'bg-green-50',  text: 'text-green-700',  icon: DollarSign  },
          { label: 'Partner Earnings',  value: formatCurrency(stats.partnerEarnings),  bg: 'bg-blue-50',   text: 'text-blue-700',   icon: TrendingUp  },
          { label: 'Partner Payouts',   value: formatCurrency(stats.partnerPayouts),   bg: 'bg-purple-50', text: 'text-purple-700', icon: CreditCard  },
          { label: 'Total Refunds',     value: formatCurrency(stats.totalRefunds),     bg: 'bg-rose-50',   text: 'text-rose-700',   icon: RotateCcw   },
          { label: 'Pending',           value: stats.pendingCount.toString(),           bg: 'bg-amber-50',  text: 'text-amber-700',  icon: Filter      },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <s.icon size={16} className={s.text} />
              <p className="text-xs font-medium text-gray-500">{s.label}</p>
            </div>
            <p className={`text-xl font-bold ${s.text}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
          <Loader2 size={22} className="animate-spin text-[#B32B2C]" />
          <span className="text-sm font-medium">Loading transactions…</span>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <DataTable
            data={filteredRows}
            columns={columns}
            searchPlaceholder="Search transactions…"
          />
        </div>
      )}
    </div>
  )
}
