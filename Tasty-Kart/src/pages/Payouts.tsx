import { useState, useEffect, useMemo } from 'react'
import { Eye, CheckCircle, XCircle, Clock } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { type DeliveryPartner } from '@/data/dummy'
import { subscribeToCollection, reviewWithdrawalRequest } from '@/lib/firebaseService'

type FirestoreDoc = { id: string; [key: string]: any }

type WithdrawStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED'

type WithdrawRow = {
  id: string
  partnerId: string
  partnerName: string
  phone: string
  amount: number
  method: string
  upiId: string
  status: WithdrawStatus
  requestedAt: unknown
  transactionId: string
  hasPayoutDoc: boolean
  rejectionReason?: string
}

function normalizeStatus(value: unknown): WithdrawStatus {
  const status = String(value || '').toUpperCase()
  if (status === 'APPROVED' || status === 'APPROVE') return 'APPROVED'
  if (status === 'REJECTED' || status === 'FAILED') return 'REJECTED'
  if (status === 'COMPLETED' || status === 'COMPLETE') return 'COMPLETED'
  return 'PENDING'
}

function statusLabel(status: WithdrawStatus) {
  if (status === 'PENDING') return 'Pending'
  if (status === 'APPROVED') return 'Approved'
  if (status === 'REJECTED') return 'Rejected'
  return 'Completed'
}

function toMillis(value: unknown): number {
  if (!value) return 0
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string' || typeof value === 'number') {
    const time = new Date(value).getTime()
    return Number.isNaN(time) ? 0 : time
  }
  if (typeof value === 'object' && value) {
    const record = value as { toDate?: () => Date; seconds?: number }
    if (typeof record.toDate === 'function') return record.toDate().getTime()
    if (typeof record.seconds === 'number') return record.seconds * 1000
  }
  return 0
}

function formatWhen(value: unknown) {
  const time = toMillis(value)
  if (!time) return '—'
  return new Date(time).toLocaleString()
}

export function Payouts() {
  const { user } = useAuth()
  const { success, error: toastError } = useToast()

  const [payoutDocs, setPayoutDocs] = useState<FirestoreDoc[]>([])
  const [txDocs, setTxDocs] = useState<FirestoreDoc[]>([])
  const [partners, setPartners] = useState<DeliveryPartner[]>([])
  const [selected, setSelected] = useState<WithdrawRow | null>(null)
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionModal, setActionModal] = useState<{ type: 'APPROVE' | 'REJECT'; row: WithdrawRow } | null>(null)
  const [reason, setReason] = useState('')

  useEffect(() => {
    const unsubs = [
      subscribeToCollection<FirestoreDoc>('payoutRequests', setPayoutDocs),
      subscribeToCollection<FirestoreDoc>('transactions', setTxDocs),
      subscribeToCollection<DeliveryPartner>('deliveryPartners', setPartners),
    ]
    return () => unsubs.forEach(unsub => unsub())
  }, [])

  const rows = useMemo(() => {
    const partnerById = new Map(partners.map(p => [p.id, p]))
    const covered = new Set<string>()
    const list: WithdrawRow[] = []

    for (const payout of payoutDocs) {
      const partnerId = String(payout.partnerId || payout.deliveryBoyId || '')
      const partner = partnerById.get(partnerId)
      const transactionId = String(payout.transactionId || payout.id)
      covered.add(payout.id)
      covered.add(transactionId)
      list.push({
        id: payout.id,
        partnerId,
        partnerName: payout.partnerName || partner?.name || 'Delivery partner',
        phone: payout.phone || partner?.phone || '',
        amount: Number(payout.requestedAmount ?? payout.amount ?? 0),
        method: payout.processingMethod || 'UPI',
        upiId: payout.upiId || '',
        status: normalizeStatus(payout.status),
        requestedAt: payout.requestedAt || payout.createdAt,
        transactionId,
        hasPayoutDoc: true,
        rejectionReason: payout.rejectionReason,
      })
    }

    for (const tx of txDocs) {
      const type = String(tx.type || '')
      if (type !== 'payout' && type !== 'withdrawal') continue
      if (covered.has(tx.id) || covered.has(String(tx.payoutRequestId || ''))) continue
      const partnerId = String(tx.partnerId || '')
      const partner = partnerById.get(partnerId)
      list.push({
        id: tx.id,
        partnerId,
        partnerName: tx.partnerName || partner?.name || 'Delivery partner',
        phone: partner?.phone || '',
        amount: Number(tx.amount || 0),
        method: String(tx.method || '').toLowerCase() === 'upi' ? 'UPI' : (tx.method || 'UPI'),
        upiId: tx.upiId || '',
        status: normalizeStatus(tx.status),
        requestedAt: tx.createdAt,
        transactionId: tx.id,
        hasPayoutDoc: false,
        rejectionReason: tx.remarks,
      })
    }

    return list.sort((a, b) => toMillis(b.requestedAt) - toMillis(a.requestedAt))
  }, [payoutDocs, txDocs, partners])

  const filtered = rows.filter(row => {
    if (filterStatus !== 'ALL' && row.status !== filterStatus) return false
    const query = search.trim().toLowerCase()
    if (!query) return true
    return (
      row.partnerName.toLowerCase().includes(query) ||
      row.phone.includes(query) ||
      row.upiId.toLowerCase().includes(query) ||
      row.partnerId.toLowerCase().includes(query)
    )
  })

  const stats = {
    pending: rows.filter(row => row.status === 'PENDING').length,
    approved: rows.filter(row => row.status === 'APPROVED').length,
    rejected: rows.filter(row => row.status === 'REJECTED').length,
    completed: rows.filter(row => row.status === 'COMPLETED').length,
  }

  const handleAction = async () => {
    if (!actionModal) return
    setLoading(true)
    const res = await reviewWithdrawalRequest({
      requestId: actionModal.row.id,
      transactionId: actionModal.row.transactionId,
      partnerId: actionModal.row.partnerId,
      amount: actionModal.row.amount,
      action: actionModal.type,
      reason,
      adminId: user?.uid || 'admin',
      hasPayoutDoc: actionModal.row.hasPayoutDoc,
    })
    setLoading(false)
    if (res.success) {
      success(
        actionModal.type === 'APPROVE' ? 'Approved' : 'Rejected',
        `${actionModal.row.partnerName} · ₹${actionModal.row.amount.toLocaleString()}`,
      )
      setActionModal(null)
      setReason('')
      setSelected(null)
    } else {
      toastError('Could not update request', res.error || 'Try again')
    }
  }

  const statusStyle = (status: WithdrawStatus) => {
    if (status === 'PENDING') return 'bg-amber-100 text-amber-700'
    if (status === 'APPROVED') return 'bg-green-100 text-green-700'
    if (status === 'REJECTED') return 'bg-red-100 text-red-700'
    return 'bg-blue-100 text-blue-700'
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Withdraw Requests"
        description="Requests from delivery partners. Pending until you approve them."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Pending', value: stats.pending, color: 'bg-amber-100' },
          { label: 'Approved', value: stats.approved, color: 'bg-green-100' },
          { label: 'Rejected', value: stats.rejected, color: 'bg-red-100' },
          { label: 'Completed', value: stats.completed, color: 'bg-blue-100' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.color} rounded-xl p-4`}>
            <p className="text-xs text-gray-600">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        <Input placeholder="Search name, phone, or UPI..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 min-w-[200px]" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
          <option value="ALL">All</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Delivery partner</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">UPI</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Requested</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No withdraw requests yet</td>
                </tr>
              ) : (
                filtered.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-gray-900">{row.partnerName}</p>
                      <p className="text-xs text-gray-400">{row.phone || row.partnerId}</p>
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">₹{row.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.upiId || row.method}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatWhen(row.requestedAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${statusStyle(row.status)}`}>
                        {row.status === 'PENDING' ? <Clock size={14} /> : row.status === 'APPROVED' ? <CheckCircle size={14} /> : row.status === 'REJECTED' ? <XCircle size={14} /> : <CheckCircle size={14} />}
                        {statusLabel(row.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setSelected(row)} className="p-2 rounded hover:bg-blue-100 text-blue-600" title="View">
                          <Eye size={16} />
                        </button>
                        {row.status === 'PENDING' && (
                          <>
                            <button onClick={() => setActionModal({ type: 'APPROVE', row })} className="px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-700 hover:bg-green-200">
                              Approve
                            </button>
                            <button onClick={() => setActionModal({ type: 'REJECT', row })} className="px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200">
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Withdraw Request" size="md">
        {selected && (
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-xs text-gray-600 uppercase">Amount</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">₹{selected.amount.toLocaleString()}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Partner', value: selected.partnerName },
                { label: 'Phone', value: selected.phone || '—' },
                { label: 'UPI', value: selected.upiId || '—' },
                { label: 'Method', value: selected.method },
                { label: 'Status', value: statusLabel(selected.status) },
                { label: 'Requested', value: formatWhen(selected.requestedAt) },
              ].map(item => (
                <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{item.label}</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1 break-all">{item.value}</p>
                </div>
              ))}
            </div>
            {selected.status === 'REJECTED' && selected.rejectionReason && (
              <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                <p className="text-xs text-red-600 font-semibold mb-1">Rejection reason</p>
                <p className="text-sm text-red-700">{selected.rejectionReason}</p>
              </div>
            )}
            {selected.status === 'PENDING' && (
              <div className="flex gap-2 justify-end pt-3 border-t">
                <Button variant="danger" type="button" onClick={() => setActionModal({ type: 'REJECT', row: selected })}>Reject</Button>
                <Button type="button" onClick={() => setActionModal({ type: 'APPROVE', row: selected })}>Approve</Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!actionModal} onClose={() => { setActionModal(null); setReason('') }} title={actionModal?.type === 'APPROVE' ? 'Approve withdrawal' : 'Reject withdrawal'} size="sm">
        {actionModal && (
          <div className="space-y-4">
            <div className={`${actionModal.type === 'APPROVE' ? 'bg-green-50' : 'bg-red-50'} rounded-xl p-4`}>
              <p className="text-sm font-semibold text-gray-900">
                {actionModal.type === 'APPROVE' ? 'Approve' : 'Reject'} ₹{actionModal.row.amount.toLocaleString()} for {actionModal.row.partnerName}?
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {actionModal.type === 'APPROVE'
                  ? 'The delivery partner will see this request as Approved.'
                  : 'The amount is returned to the partner pocket balance and the request shows as Rejected.'}
              </p>
            </div>
            {actionModal.type === 'REJECT' && (
              <textarea placeholder="Rejection reason..." value={reason} onChange={e => setReason(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" rows={3} />
            )}
            <div className="flex gap-2 justify-end pt-3 border-t">
              <Button variant="secondary" type="button" onClick={() => { setActionModal(null); setReason('') }} disabled={loading}>Cancel</Button>
              <Button type="button" variant={actionModal.type === 'APPROVE' ? 'primary' : 'danger'} onClick={handleAction} disabled={loading}>
                {loading ? 'Saving...' : actionModal.type === 'APPROVE' ? 'Approve' : 'Reject'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
