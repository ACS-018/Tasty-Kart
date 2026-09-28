import { useState, useEffect, useRef } from 'react'
import {
  collection, onSnapshot, addDoc, updateDoc, doc,
  query, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { Loader2, MessageSquare, X, Send, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type TicketStatus = 'open' | 'in_progress' | 'closed'

type Ticket = {
  id: string
  partnerId: string
  partnerName: string
  partnerPhone: string
  category: string
  subject: string
  status: TicketStatus
  unreadByAdmin: boolean
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

type Message = {
  id: string
  senderId: string
  senderType: 'partner' | 'admin'
  message: string
  sentAt: Timestamp | null
}

function formatTs(ts: Timestamp | null | undefined): string {
  if (!ts) return '—'
  const d = ts.toDate()
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const map: Record<TicketStatus, { label: string; cls: string; icon: React.ReactNode }> = {
    open:        { label: 'Open',        cls: 'bg-blue-100 text-blue-700',   icon: <Clock size={11} /> },
    in_progress: { label: 'In Progress', cls: 'bg-amber-100 text-amber-700', icon: <AlertCircle size={11} /> },
    closed:      { label: 'Closed',      cls: 'bg-green-100 text-green-700', icon: <CheckCircle size={11} /> },
  }
  const { label, cls, icon } = map[status] ?? map.open
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {icon} {label}
    </span>
  )
}

export function Support() {
  const { user } = useAuth()
  const { success, error: toastError } = useToast()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | TicketStatus>('all')
  const [search, setSearch] = useState('')
  const msgBottomRef = useRef<HTMLDivElement>(null)

  // Subscribe to all tickets
  useEffect(() => {
    const q = query(collection(db, 'supportTickets'), orderBy('updatedAt', 'desc'))
    return onSnapshot(q, snap => {
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() } as Ticket)))
      setLoading(false)
    }, () => setLoading(false))
  }, [])

  // Subscribe to messages for selected ticket
  useEffect(() => {
    if (!selected) { setMessages([]); return }
    const q = query(
      collection(db, 'supportTickets', selected.id, 'messages'),
      orderBy('sentAt', 'asc'),
    )
    return onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)))
      setTimeout(() => msgBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    })
  }, [selected?.id])

  // Mark ticket read by admin when opened
  useEffect(() => {
    if (selected?.unreadByAdmin) {
      updateDoc(doc(db, 'supportTickets', selected.id), { unreadByAdmin: false }).catch(() => {})
      setTickets(prev => prev.map(t => t.id === selected.id ? { ...t, unreadByAdmin: false } : t))
    }
  }, [selected?.id])

  const filtered = tickets.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return t.partnerName.toLowerCase().includes(q) ||
      t.partnerPhone.includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q)
  })

  const unreadCount = tickets.filter(t => t.unreadByAdmin).length

  const handleSendReply = async () => {
    if (!selected || !reply.trim() || sending) return
    setSending(true)
    try {
      const now = serverTimestamp()
      await addDoc(collection(db, 'supportTickets', selected.id, 'messages'), {
        senderId: user?.uid || 'admin',
        senderType: 'admin',
        message: reply.trim(),
        sentAt: now,
      })
      await updateDoc(doc(db, 'supportTickets', selected.id), {
        updatedAt: now,
        unreadByPartner: true,
        status: selected.status === 'open' ? 'in_progress' : selected.status,
      })
      setSelected(prev => prev ? { ...prev, status: prev.status === 'open' ? 'in_progress' : prev.status } : prev)
      setReply('')
      success('Reply sent')
    } catch {
      toastError('Error', 'Could not send reply')
    } finally {
      setSending(false)
    }
  }

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!selected) return
    try {
      await updateDoc(doc(db, 'supportTickets', selected.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        ...(newStatus === 'closed' ? { closedAt: serverTimestamp() } : {}),
      })
      setSelected(prev => prev ? { ...prev, status: newStatus } : prev)
      setTickets(prev => prev.map(t => t.id === selected.id ? { ...t, status: newStatus } : t))
      success(`Ticket marked as ${newStatus.replace('_', ' ')}`)
    } catch {
      toastError('Error', 'Could not update status')
    }
  }

  return (
    <div className="flex h-[calc(100vh-64px)] gap-0 overflow-hidden">

      {/* ── Ticket list panel ─────────────────────────────────────────────── */}
      <div className={cn(
        'flex flex-col border-r border-gray-200 bg-white',
        selected ? 'hidden lg:flex lg:w-[380px] shrink-0' : 'flex-1',
      )}>
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-bold text-gray-900 text-lg flex-1">Support Tickets</h2>
            {unreadCount > 0 && (
              <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search partner, category…"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#B32B2C] mb-2"
          />
          <div className="flex gap-1.5 flex-wrap">
            {(['all', 'open', 'in_progress', 'closed'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors',
                  filterStatus === s
                    ? 'bg-[#B32B2C] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                )}
              >
                {s === 'all' ? 'All' : s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No tickets</p>
            </div>
          ) : (
            filtered.map(ticket => (
              <button
                key={ticket.id}
                onClick={() => setSelected(ticket)}
                className={cn(
                  'w-full text-left px-4 py-3.5 border-b border-gray-100 hover:bg-gray-50 transition-colors',
                  selected?.id === ticket.id && 'bg-red-50 border-l-2 border-l-[#B32B2C]',
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <StatusBadge status={ticket.status} />
                    {ticket.unreadByAdmin && (
                      <span className="w-2 h-2 bg-[#B32B2C] rounded-full shrink-0" />
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 shrink-0">{formatTs(ticket.updatedAt)}</span>
                </div>
                <p className="text-sm font-semibold text-gray-900 truncate">{ticket.subject}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {ticket.partnerName || 'Partner'} · {ticket.partnerPhone || '—'} · {ticket.category}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Chat panel ───────────────────────────────────────────────────── */}
      {selected ? (
        <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-start gap-3">
            <button
              onClick={() => setSelected(null)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 mt-0.5"
            >
              <X size={18} />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-gray-900 text-sm truncate">{selected.subject}</p>
                <StatusBadge status={selected.status} />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {selected.partnerName} · {selected.partnerPhone} · {selected.category}
              </p>
            </div>
            {/* Status actions */}
            <div className="flex gap-1.5 shrink-0">
              {selected.status !== 'in_progress' && selected.status !== 'closed' && (
                <button
                  onClick={() => handleStatusChange('in_progress')}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                >
                  Mark In Progress
                </button>
              )}
              {selected.status !== 'closed' && (
                <button
                  onClick={() => handleStatusChange('closed')}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                >
                  Close Ticket
                </button>
              )}
              {selected.status === 'closed' && (
                <button
                  onClick={() => handleStatusChange('open')}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                >
                  Reopen
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map(msg => {
              const isAdmin = msg.senderType === 'admin'
              return (
                <div key={msg.id} className={cn('flex', isAdmin ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm',
                    isAdmin
                      ? 'bg-[#B32B2C] text-white rounded-br-sm'
                      : 'bg-white text-gray-900 rounded-bl-sm',
                  )}>
                    {!isAdmin && (
                      <p className="text-[10px] font-semibold text-[#B32B2C] mb-1">
                        {selected.partnerName || 'Partner'}
                      </p>
                    )}
                    <p className="text-sm leading-relaxed">{msg.message}</p>
                    <p className={cn('text-[10px] mt-1', isAdmin ? 'text-white/60' : 'text-gray-400')}>
                      {msg.sentAt ? msg.sentAt.toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                </div>
              )
            })}
            <div ref={msgBottomRef} />
          </div>

          {/* Reply bar */}
          {selected.status !== 'closed' ? (
            <div className="bg-white border-t border-gray-200 p-3 flex gap-2 items-end">
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply() } }}
                rows={2}
                placeholder="Type your reply… (Enter to send)"
                className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-xl resize-none focus:outline-none focus:border-[#B32B2C]"
              />
              <button
                onClick={handleSendReply}
                disabled={sending || !reply.trim()}
                className="w-10 h-10 rounded-xl bg-[#B32B2C] text-white flex items-center justify-center hover:bg-[#9a2324] disabled:opacity-50 transition-colors shrink-0"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          ) : (
            <div className="bg-white border-t border-gray-200 p-3 text-center text-sm text-gray-400">
              Ticket is closed. Reopen to send a reply.
            </div>
          )}
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center text-gray-300 flex-col gap-3">
          <MessageSquare size={48} />
          <p className="font-medium">Select a ticket to view the conversation</p>
        </div>
      )}
    </div>
  )
}
