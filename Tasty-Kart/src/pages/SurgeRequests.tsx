import { useEffect, useMemo, useState } from 'react'
import { CheckCircle, Clock, Eye, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { subscribeToCollection, updateDocumentInFirestore } from '@/lib/firebaseService'

type FirestoreDoc = { id: string; [key: string]: any }

type SurgeStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

type SurgeRow = {
  id: string
  partnerId: string
  partnerName: string
  phone: string
  city: string
  imageUrl: string
  status: SurgeStatus
  amount: number
  hours: number
  startsAt: unknown
  endsAt: unknown
  requestedAt: unknown
  rejectionReason?: string
}

function normalizeStatus(value: unknown): SurgeStatus {
  const status = String(value || '').toUpperCase()
  if (status === 'APPROVED' || status === 'APPROVE') return 'APPROVED'
  if (status === 'REJECTED' || status === 'FAILED') return 'REJECTED'
  return 'PENDING'
}

function statusLabel(status: SurgeStatus) {
  if (status === 'APPROVED') return 'Approved'
  if (status === 'REJECTED') return 'Rejected'
  return 'Pending'
}

function statusStyle(status: SurgeStatus) {
  if (status === 'APPROVED') return 'bg-green-100 text-green-700'
  if (status === 'REJECTED') return 'bg-red-100 text-red-700'
  return 'bg-amber-100 text-amber-700'
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

function isLive(row: SurgeRow) {
  return row.status === 'APPROVED' && toMillis(row.endsAt) > Date.now()
}

function toRow(doc: FirestoreDoc): SurgeRow {
  return {
    id: doc.id,
    partnerId: String(doc.partnerId || ''),
    partnerName: String(doc.partnerName || 'Delivery partner'),
    phone: String(doc.phone || ''),
    city: String(doc.city || ''),
    imageUrl: String(doc.imageUrl || ''),
    status: normalizeStatus(doc.status),
    amount: Number(doc.amount) || 0,
    hours: Number(doc.hours) || 0,
    startsAt: doc.startsAt,
    endsAt: doc.endsAt,
    requestedAt: doc.requestedAt || doc.createdAt,
    rejectionReason: doc.rejectionReason ? String(doc.rejectionReason) : undefined,
  }
}

export function SurgeRequests() {
  const { success, error: toastError } = useToast()
  const [docs, setDocs] = useState<FirestoreDoc[]>([])
  const [selected, setSelected] = useState<SurgeRow | null>(null)
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [approveRow, setApproveRow] = useState<SurgeRow | null>(null)
  const [rejectRow, setRejectRow] = useState<SurgeRow | null>(null)
  const [amount, setAmount] = useState('20')
  const [hours, setHours] = useState('2')
  const [reason, setReason] = useState('')

  useEffect(() => {
    return subscribeToCollection('surgeRequests', setDocs)
  }, [])

  const rows = useMemo(() => {
    return docs
      .map(toRow)
      .sort((a, b) => toMillis(b.requestedAt) - toMillis(a.requestedAt))
  }, [docs])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(row => {
      if (filterStatus !== 'ALL' && row.status !== filterStatus) return false
      if (!q) return true
      return (
        row.partnerName.toLowerCase().includes(q) ||
        row.city.toLowerCase().includes(q) ||
        row.phone.toLowerCase().includes(q)
      )
    })
  }, [rows, filterStatus, search])

  const stats = useMemo(() => ({
    pending: rows.filter(r => r.status === 'PENDING').length,
    live: rows.filter(isLive).length,
    approved: rows.filter(r => r.status === 'APPROVED').length,
    rejected: rows.filter(r => r.status === 'REJECTED').length,
  }), [rows])

  function openApprove(row: SurgeRow) {
    setAmount(row.amount > 0 ? String(row.amount) : '20')
    setHours(row.hours > 0 ? String(row.hours) : '2')
    setApproveRow(row)
  }

  async function handleApprove() {
    if (!approveRow) return
    const rupees = Math.round(Number(amount))
    const duration = Math.round(Number(hours))
    if (!Number.isFinite(rupees) || rupees <= 0) {
      toastError('Enter a surge amount in rupees')
      return
    }
    if (!Number.isFinite(duration) || duration <= 0 || duration > 24) {
      toastError('Hours must be between 1 and 24')
      return
    }
    const starts = new Date()
    const ends = new Date(starts.getTime() + duration * 60 * 60 * 1000)
    setLoading(true)
    const res = await updateDocumentInFirestore('surgeRequests', approveRow.id, {
      status: 'APPROVED',
      amount: rupees,
      hours: duration,
      city: approveRow.city,
      startsAt: starts.toISOString(),
      endsAt: ends.toISOString(),
      reviewedAt: starts.toISOString(),
      rejectionReason: '',
    })
    setLoading(false)
    if (!res.success) {
      toastError(typeof res.error === 'string' ? res.error : 'Could not approve surge')
      return
    }
    success(`₹${rupees} surge is live in ${approveRow.city || 'that city'} for ${duration} hour${duration === 1 ? '' : 's'}`)
    setApproveRow(null)
    setSelected(null)
  }

  async function handleReject() {
    if (!rejectRow) return
    setLoading(true)
    const res = await updateDocumentInFirestore('surgeRequests', rejectRow.id, {
      status: 'REJECTED',
      reviewedAt: new Date().toISOString(),
      rejectionReason: reason.trim(),
    })
    setLoading(false)
    if (!res.success) {
      toastError(typeof res.error === 'string' ? res.error : 'Could not reject surge')
      return
    }
    success('Surge request rejected')
    setRejectRow(null)
    setReason('')
    setSelected(null)
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Surge Requests"
        description="Review a delivery partner’s photo, then set a rupee surge for their city for a limited number of hours."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Pending review', value: stats.pending, color: 'bg-amber-100' },
          { label: 'Live now', value: stats.live, color: 'bg-orange-100' },
          { label: 'Approved', value: stats.approved, color: 'bg-green-100' },
          { label: 'Rejected', value: stats.rejected, color: 'bg-red-100' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.color} rounded-xl p-4`}>
            <p className="text-xs text-gray-600">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        <Input placeholder="Search partner or city..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 min-w-[200px]" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
          <option value="ALL">All</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Photo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Partner</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">City</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Surge</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Requested</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No surge requests yet</td>
                </tr>
              ) : (
                filtered.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {row.imageUrl ? (
                        <img src={row.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover border border-gray-200" />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-gray-100" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-gray-900">{row.partnerName}</p>
                      <p className="text-xs text-gray-400">{row.phone || row.partnerId}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.city || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {row.status === 'APPROVED' ? (
                        <>
                          <p className="font-semibold">₹{row.amount}</p>
                          <p className="text-xs text-gray-400">
                            {row.hours}h · until {formatWhen(row.endsAt)}
                            {isLive(row) ? ' · live' : ''}
                          </p>
                        </>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatWhen(row.requestedAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${statusStyle(row.status)}`}>
                        {row.status === 'PENDING' ? <Clock size={14} /> : row.status === 'APPROVED' ? <CheckCircle size={14} /> : <XCircle size={14} />}
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
                            <button onClick={() => openApprove(row)} className="px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-700 hover:bg-green-200">
                              Approve
                            </button>
                            <button onClick={() => { setReason(''); setRejectRow(row) }} className="px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200">
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

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Surge request" size="md">
        {selected && (
          <div className="space-y-4">
            {selected.imageUrl && (
              <img src={selected.imageUrl} alt="Surge proof" className="w-full max-h-72 object-contain rounded-xl bg-gray-50 border border-gray-200" />
            )}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Partner', value: selected.partnerName },
                { label: 'Phone', value: selected.phone || '—' },
                { label: 'City', value: selected.city || '—' },
                { label: 'Status', value: statusLabel(selected.status) },
                { label: 'Amount', value: selected.amount > 0 ? `₹${selected.amount}` : '—' },
                { label: 'Hours', value: selected.hours > 0 ? String(selected.hours) : '—' },
                { label: 'Starts', value: formatWhen(selected.startsAt) },
                { label: 'Ends', value: formatWhen(selected.endsAt) },
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
                <Button variant="danger" type="button" onClick={() => { setReason(''); setRejectRow(selected) }}>Reject</Button>
                <Button type="button" onClick={() => openApprove(selected)}>Approve</Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!approveRow} onClose={() => setApproveRow(null)} title="Approve city surge" size="sm">
        {approveRow && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              This amount is added to delivery fees in <span className="font-semibold text-gray-900">{approveRow.city || 'this city'}</span> until the hours run out.
            </p>
            <Input label="Surge amount (₹)" type="number" min={1} value={amount} onChange={e => setAmount(e.target.value)} />
            <Input label="Active for (hours)" type="number" min={1} max={24} value={hours} onChange={e => setHours(e.target.value)} />
            <div className="flex gap-2 justify-end pt-3 border-t">
              <Button variant="secondary" type="button" onClick={() => setApproveRow(null)} disabled={loading}>Cancel</Button>
              <Button type="button" onClick={handleApprove} disabled={loading}>{loading ? 'Saving...' : 'Approve surge'}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!rejectRow} onClose={() => setRejectRow(null)} title="Reject surge request" size="sm">
        {rejectRow && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Reject the photo request from {rejectRow.partnerName}. No surge will be applied in {rejectRow.city || 'their city'}.
            </p>
            <textarea placeholder="Reason (optional)" value={reason} onChange={e => setReason(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" rows={3} />
            <div className="flex gap-2 justify-end pt-3 border-t">
              <Button variant="secondary" type="button" onClick={() => setRejectRow(null)} disabled={loading}>Cancel</Button>
              <Button variant="danger" type="button" onClick={handleReject} disabled={loading}>{loading ? 'Saving...' : 'Reject'}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
