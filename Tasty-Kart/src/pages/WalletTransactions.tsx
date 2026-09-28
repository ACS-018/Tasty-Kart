import { useState, useEffect } from 'react'
import { Eye, Filter, Download, CreditCard, TrendingUp, TrendingDown } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { ProtectedAction } from '@/components/shared/ProtectedAction'
import { type WalletTransaction } from '@/data/dummy'
import { formatDateTime } from '@/lib/utils'

function toDate(val: any): Date {
  if (!val) return new Date(0)
  if (val?.toDate) return val.toDate()
  return new Date(val)
}

export function WalletTransactions() {
  const { user } = useAuth()
  const { success } = useToast()
  
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [selected, setSelected] = useState<WalletTransaction | null>(null)
  const [filterType, setFilterType] = useState('ALL')
  const [searchPartner, setSearchPartner] = useState('')

  useEffect(() => {
    // Placeholder - would connect to Firestore listener
    setTransactions([])
  }, [])

  const filtered = transactions.filter(t => {
    if (filterType !== 'ALL' && t.type !== filterType) return false
    if (searchPartner && !t.deliveryBoyId.includes(searchPartner)) return false
    return true
  })

  const stats = {
    totalCredit: filtered.filter(t => t.direction === 'CREDIT').reduce((s, t) => s + t.amount, 0),
    totalDebit: filtered.filter(t => t.direction === 'DEBIT').reduce((s, t) => s + t.amount, 0),
    netFlow: filtered.reduce((s, t) => s + (t.direction === 'CREDIT' ? t.amount : -t.amount), 0),
    count: filtered.length,
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader title="Wallet Transactions" description="View and manage delivery partner wallet activity" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Transactions', value: transactions.length, icon: CreditCard, color: 'bg-blue-100' },
          { label: 'Total Credits', value: `₹${stats.totalCredit.toLocaleString()}`, icon: TrendingUp, color: 'bg-green-100' },
          { label: 'Total Debits', value: `₹${stats.totalDebit.toLocaleString()}`, icon: TrendingDown, color: 'bg-red-100' },
          { label: 'Net Flow', value: `₹${stats.netFlow.toLocaleString()}`, icon: CreditCard, color: 'bg-purple-100' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.color} rounded-xl p-4`}>
            <p className="text-xs text-gray-600">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        <Input placeholder="Search partner ID..." value={searchPartner} onChange={e => setSearchPartner(e.target.value)} className="flex-1 min-w-[200px]" />
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
          <option value="ALL">All Types</option>
          <option value="ORDER_EARNING">Order Earning</option>
          <option value="BONUS">Bonus</option>
          <option value="INCENTIVE">Incentive</option>
          <option value="ADJUSTMENT">Adjustment</option>
          <option value="DEDUCTION">Deduction</option>
          <option value="PAYOUT">Payout</option>
        </select>
        <ProtectedAction permission="VIEW_WALLET_TRANSACTIONS">
          <Button size="sm" variant="secondary" icon={<Download size={14} />}>Export</Button>
        </ProtectedAction>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Partner ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Description</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Date</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No transactions found</td>
                </tr>
              ) : (
                filtered.map(transaction => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{transaction.deliveryBoyId.slice(0, 12)}...</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700">{transaction.type}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{transaction.description}</td>
                    <td className={`px-4 py-3 text-sm font-bold text-right ${transaction.direction === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                      {transaction.direction === 'CREDIT' ? '+' : '-'}₹{transaction.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDateTime(transaction.createdAt)}</td>
                    <td className="px-4 py-3 text-center">
                      <ProtectedAction permission="VIEW_WALLET_TRANSACTIONS">
                        <button onClick={() => setSelected(transaction)} className="p-2 rounded hover:bg-blue-100 text-blue-600">
                          <Eye size={16} />
                        </button>
                      </ProtectedAction>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Transaction Details" size="md">
        {selected && (
          <div className="space-y-4">
            <div className={`${selected.direction === 'CREDIT' ? 'bg-green-50' : 'bg-red-50'} rounded-xl p-4`}>
              <p className="text-xs text-gray-600 uppercase">Amount</p>
              <p className={`text-3xl font-bold mt-2 ${selected.direction === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                {selected.direction === 'CREDIT' ? '+' : '-'}₹{selected.amount.toLocaleString()}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Partner ID', value: selected.deliveryBoyId },
                { label: 'Type', value: selected.type },
                { label: 'Sub Type', value: selected.subType || 'N/A' },
                { label: 'Direction', value: selected.direction },
                { label: 'Date', value: formatDateTime(selected.createdAt) },
                { label: 'Reference', value: selected.orderId || selected.earningId || 'N/A' },
              ].map(item => (
                <div key={item.label as string} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{item.label}</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase mb-2">Description</p>
              <p className="text-sm text-gray-700">{selected.description}</p>
            </div>

            {selected.idempotencyKey && (
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <p className="text-xs text-blue-600 font-mono">ID: {selected.idempotencyKey.slice(0, 16)}...</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
