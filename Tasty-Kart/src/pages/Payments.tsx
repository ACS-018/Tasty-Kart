import { useState, useEffect } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Loader2, DollarSign, Users, TrendingUp, TrendingDown, Bike, CreditCard, Filter } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { subscribeToTransactions } from '@/lib/firebaseService'
import { type Transaction } from '@/data/dummy'

const methodIcons: Record<string, string> = {
  UPI: '📱', 
  Razorpay: '💳', 
  Cash: '💵', 
  Wallet: '👛',
  auto: '🤖',
  bank_transfer: '🏦',
  upi: '📱',
}

const typeColors: Record<string, { bg: string; text: string }> = {
  order_earning: { bg: 'bg-green-50', text: 'text-green-700' },
  payout: { bg: 'bg-blue-50', text: 'text-blue-700' },
  withdrawal: { bg: 'bg-blue-50', text: 'text-blue-700' },
  deduction: { bg: 'bg-red-50', text: 'text-red-700' },
  late_delivery: { bg: 'bg-red-50', text: 'text-red-700' },
  tip: { bg: 'bg-amber-50', text: 'text-amber-700' },
}

export function Payments() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<'all' | 'customer' | 'partner'>('all')
  const { success } = useToast()

  useEffect(() => {
    const unsub = subscribeToTransactions(null, (data) => {
      setTransactions(data)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  // Filter transactions based on type
  const filteredTransactions = transactions.filter(t => {
    if (filterType === 'all') return true
    if (filterType === 'customer') return t.customerName || t.orderNumber
    if (filterType === 'partner') return t.partnerId
    return true
  })

  const columns: ColumnDef<Transaction, unknown>[] = [
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => {
        const type = String(row.original.type || 'payment')
        const colors = typeColors[type] || { bg: 'bg-gray-50', text: 'text-gray-700' }
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${colors.bg} ${colors.text}`}>
            {row.original.partnerId ? <Bike size={12} /> : <CreditCard size={12} />}
            {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </span>
        )
      },
    },
    {
      accessorKey: 'title',
      header: 'Description',
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-medium text-gray-900">{String(row.original.title || 'Payment')}</p>
          {row.original.orderNumber && (
            <p className="text-xs text-[#B32B2C] font-semibold">{row.original.orderNumber}</p>
          )}
          {typeof row.original.customerName === 'string' && row.original.customerName && (
            <p className="text-xs text-gray-500">{row.original.customerName}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'method',
      header: 'Method',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="text-lg">{methodIcons[String(row.original.method || '')] || '💳'}</span>
          <span className="text-sm font-medium capitalize">{String(row.original.method || '—').replace(/_/g, ' ')}</span>
        </div>
      ),
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ row }) => {
        const amount = Number(row.original.amount)
        const safeAmount = Number.isFinite(amount) ? amount : 0
        const isPositive = safeAmount >= 0
        return (
          <div className="flex items-center gap-1.5">
            {isPositive ? (
              <TrendingUp size={14} className="text-green-600" />
            ) : (
              <TrendingDown size={14} className="text-red-600" />
            )}
            <span className={`text-sm font-bold ${isPositive ? 'text-green-700' : 'text-red-700'}`}>
              {isPositive ? '+' : ''}{formatCurrency(safeAmount)}
            </span>
          </div>
        )
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status || 'pending'
        const c = status === 'completed'
          ? 'bg-green-100 text-green-700'
          : status === 'failed'
          ? 'bg-red-100 text-red-700'
          : 'bg-amber-100 text-amber-700'
        return <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${c}`}>{status}</span>
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Date & Time',
      cell: ({ row }) => <span className="text-xs text-gray-400">{formatDateTime(row.original.createdAt)}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        !row.original.refunded && row.original.status === 'completed' && Number(row.original.amount) > 0 ? (
          <button onClick={() => success('Refund initiated')}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors">
            Refund
          </button>
        ) : null
      ),
    },
  ]

  // Calculate stats
  const customerTransactions = transactions.filter(t => t.customerName || t.orderNumber)
  const partnerTransactions = transactions.filter(t => t.partnerId)
  
  const totalRevenue = customerTransactions
    .filter(t => t.status === 'completed' && t.amount > 0)
    .reduce((s, t) => s + t.amount, 0)
  
  const totalPartnerPayouts = partnerTransactions
    .filter(t => ['payout', 'withdrawal'].includes(t.type || '') && t.status === 'completed')
    .reduce((s, t) => s + Math.abs(t.amount), 0)
  
  const totalPartnerEarnings = partnerTransactions
    .filter(t => t.type === 'order_earning' && t.status === 'completed')
    .reduce((s, t) => s + t.amount, 0)
  
  const pendingCount = filteredTransactions.filter(t => t.status === 'pending').length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            variant={filterType === 'all' ? 'primary' : 'outline'}
            onClick={() => setFilterType('all')}
          >
            All
          </Button>
          <Button 
            size="sm" 
            variant={filterType === 'customer' ? 'primary' : 'outline'}
            icon={<Users size={14} />}
            onClick={() => setFilterType('customer')}
          >
            Customer
          </Button>
          <Button 
            size="sm" 
            variant={filterType === 'partner' ? 'primary' : 'outline'}
            icon={<Bike size={14} />}
            onClick={() => setFilterType('partner')}
          >
            Delivery Partner
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: 'Customer Revenue', value: formatCurrency(totalRevenue), bg: 'bg-green-50', text: 'text-green-700', icon: DollarSign },
          { label: 'Partner Earnings', value: formatCurrency(totalPartnerEarnings), bg: 'bg-blue-50', text: 'text-blue-700', icon: TrendingUp },
          { label: 'Partner Payouts', value: formatCurrency(totalPartnerPayouts), bg: 'bg-purple-50', text: 'text-purple-700', icon: CreditCard },
          { label: 'Total Transactions', value: filteredTransactions.length.toString(), bg: 'bg-blue-50', text: 'text-blue-700', icon: Filter },
          { label: 'Pending', value: pendingCount.toString(), bg: 'bg-amber-50', text: 'text-amber-700', icon: Filter },
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

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
          <Loader2 size={22} className="animate-spin text-[#B32B2C]" />
          <span className="text-sm font-medium">Loading transactions from Firebase...</span>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <DataTable data={filteredTransactions} columns={columns} searchPlaceholder="Search transactions..." />
        </div>
      )}
    </div>
  )
}