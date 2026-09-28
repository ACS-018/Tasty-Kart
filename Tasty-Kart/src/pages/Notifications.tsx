import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Bell, Send, Users, Store, Loader2,
  CheckCircle2, XCircle, User, Bike,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { formatDateTime } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { subscribeToCollection, addNotification } from '@/lib/firebaseService'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { app } from '@/lib/firebase'

type Notification = {
  id: string
  title: string
  message: string
  type: string
  read: boolean
  createdAt: string
}

type Recipient = {
  id: string
  name: string
  type: 'customer' | 'partner'
  tokens: string[]
  status?: string
  phone?: string
}

const typeIcons: Record<string, string> = {
  order: '🛍️', restaurant: '🏪', review: '⭐', payment: '💳',
  partner: '🛵', coupon: '🎟️', admin_push: '📢', support: '🎧',
}

const templates = [
  { id: 't1', name: 'Order Update',   preview: 'Your order #{ID} has been {STATUS}' },
  { id: 't2', name: 'New Offer',      preview: 'Special offer! Get {DISCOUNT}% off on {RESTAURANT}' },
  { id: 't3', name: 'Welcome User',   preview: 'Welcome to TastyKart! Enjoy your first order with code FIRST50' },
  { id: 't4', name: 'New Restaurant', preview: '{RESTAURANT} is now available on TastyKart' },
]

export function Notifications() {
  const [activeTab, setActiveTab] = useState<'list' | 'push' | 'templates'>('list')
  const [notificationsList, setNotificationsList] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  // Push form state
  const [audience, setAudience] = useState<'all_customers' | 'all_partners' | 'all' | 'individual'>('all')
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null)
  const [recipientSearch, setRecipientSearch] = useState('')
  const [pushTitle, setPushTitle] = useState('')
  const [pushBody, setPushBody] = useState('')
  const [sending, setSending] = useState(false)
  // Recipients list (customers + partners with tokens)
  const [customers, setCustomers] = useState<any[]>([])
  const [partners, setPartners] = useState<any[]>([])

  const { success: toastSuccess, error: toastError } = useToast()

  useEffect(() => {
    const unsubs = [
      subscribeToCollection<Notification>('notifications', (data) => {
        setNotificationsList(data)
        setLoading(false)
      }),
      subscribeToCollection<any>('customers',        setCustomers),
      subscribeToCollection<any>('deliveryPartners', setPartners),
    ]
    return () => unsubs.forEach(fn => fn())
  }, [])

  // canReceivePush: used only for token collection when sending — does NOT
  // filter the search list so every partner/customer is searchable.
  const canReceivePush = (u: any) =>
    u.notificationsEnabled !== false &&
    (u.fcmTokens ?? []).length > 0

  // All recipients (unfiltered) so admin can find any partner or customer
  // by name or phone. Tokens are checked at send-time, not search-time.
  const allRecipients: Recipient[] = [
    ...customers
      .map((c): Recipient => ({
        id: c.id, name: c.name || c.email || c.id,
        type: 'customer', tokens: c.fcmTokens ?? [],
        status: c.status, phone: c.phone,
      })),
    ...partners
      .map((p): Recipient => ({
        id: p.id,
        // Show name → phone → 'Delivery Partner' — never fall back to ID
        name: (p.name || '').trim() || (p.phone || '').trim() || 'Delivery Partner',
        type: 'partner', tokens: p.fcmTokens ?? [],
        status: p.status, phone: p.phone,
      })),
  ]

  const filteredRecipients = recipientSearch
    ? allRecipients.filter(r =>
        r.name.toLowerCase().includes(recipientSearch.toLowerCase()) ||
        r.phone?.includes(recipientSearch)
      )
    : allRecipients

  // Collect tokens based on audience selection — only logged-in users
  const collectTokens = (): string[] => {
    if (audience === 'individual') {
      return selectedRecipient?.tokens ?? []
    }
    const list =
      audience === 'all_customers' ? customers :
      audience === 'all_partners'  ? partners  :
      [...customers, ...partners]
    const tokens: string[] = []
    list.forEach((u: any) => {
      if (!canReceivePush(u)) return
      if (Array.isArray(u.fcmTokens)) tokens.push(...u.fcmTokens)
    })
    return [...new Set(tokens)] // deduplicate
  }

  const handleSend = async () => {
    if (!pushTitle.trim() || !pushBody.trim()) {
      toastError('Validation', 'Title and message are required')
      return
    }
    if (audience === 'individual' && !selectedRecipient) {
      toastError('Validation', 'Select a recipient first')
      return
    }

    const tokens = collectTokens()
    if (tokens.length === 0) {
      toastError('No tokens', 'Selected recipients have no registered devices')
      return
    }

    setSending(true)

    try {
      // 1. Call Cloud Function to send FCM push
      const functions = getFunctions(app, 'us-central1')
      const sendPush = httpsCallable<
        { tokens: string[]; title: string; body: string },
        { success: boolean; successCount: number; failureCount: number }
      >(functions, 'sendPushNotification')

      const result = await sendPush({
        tokens,
        title: pushTitle.trim(),
        body: pushBody.trim(),
      })

      const { successCount, failureCount } = result.data

      // 2. Also write to notifications collection for the in-app feed
      await addNotification({
        userId: audience === 'individual' && selectedRecipient
          ? selectedRecipient.id
          : 'broadcast',
        userType:
          audience === 'all_customers' ? 'customer' :
          audience === 'all_partners'  ? 'delivery_partner' :
          audience === 'individual' && selectedRecipient
            ? selectedRecipient.type === 'partner' ? 'delivery_partner' : 'customer'
            : 'broadcast',
        type: 'admin_push',
        title: pushTitle.trim(),
        message: pushBody.trim(),
        priority: 'high',
      })

      toastSuccess(
        'Sent!',
        `Delivered to ${successCount} device${successCount !== 1 ? 's' : ''}${failureCount > 0 ? ` · ${failureCount} failed` : ''}`
      )
      setPushTitle('')
      setPushBody('')
      setSelectedRecipient(null)
      setRecipientSearch('')
    } catch (err: any) {
      toastError('Send failed', err?.message || 'Could not send notification')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6 pb-8">

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(['list', 'push', 'templates'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${
              activeTab === tab ? 'border-[#B32B2C] text-[#B32B2C]' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {tab === 'list' ? 'All Notifications' : tab === 'push' ? 'Send Push' : 'Templates'}
          </button>
        ))}
      </div>

      {/* ── Notification list ───────────────────────────────────────────── */}
      {activeTab === 'list' && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
              <Loader2 size={22} className="animate-spin text-[#B32B2C]" />
              <span className="text-sm font-medium">Loading…</span>
            </div>
          ) : notificationsList.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
              <Bell size={32} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No notifications yet</p>
              <p className="text-xs mt-1">Use "Send Push" to create one</p>
            </div>
          ) : (
            notificationsList.map((n, i) => (
              <motion.div key={n.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                className={`flex items-start gap-4 p-4 rounded-xl border ${
                  n.read ? 'bg-white border-gray-100' : 'bg-red-50/60 border-red-100'
                }`}>
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm shrink-0">
                  {typeIcons[n.type] || '📢'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm ${!n.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>{n.title}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-400">{formatDateTime(n.createdAt)}</span>
                      {!n.read && <div className="w-2 h-2 bg-[#B32B2C] rounded-full" />}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{n.message}</p>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* ── Send Push ──────────────────────────────────────────────────── */}
      {activeTab === 'push' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Send size={18} className="text-[#B32B2C]" /> Send Push Notification
          </h3>

          {/* Audience selector */}
          <Select label="Target Audience" value={audience} onChange={e => {
            setAudience(e.target.value as typeof audience)
            setSelectedRecipient(null)
            setRecipientSearch('')
          }}>
            <option value="all">All Users & Partners ({[...customers, ...partners].filter(canReceivePush).length} logged in)</option>
            <option value="all_customers">All Customers ({customers.filter(canReceivePush).length} logged in)</option>
            <option value="all_partners">All Delivery Partners ({partners.filter(canReceivePush).length} logged in)</option>
            <option value="individual">Individual (search by name / phone)</option>
          </Select>

          {/* Individual search */}
          {audience === 'individual' && (
            <div className="space-y-2">
              <Input
                label="Search recipient"
                placeholder="Name or phone…"
                value={recipientSearch}
                onChange={e => { setRecipientSearch(e.target.value); setSelectedRecipient(null) }}
              />
              {recipientSearch && (
                <div className="border border-gray-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  {filteredRecipients.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">No matches with registered devices</p>
                  ) : (
                    filteredRecipients.map(r => (
                      <button key={r.id} onClick={() => { setSelectedRecipient(r); setRecipientSearch(r.name) }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors ${
                          selectedRecipient?.id === r.id ? 'bg-red-50' : ''
                        }`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                          r.type === 'partner' ? 'bg-amber-500' : 'bg-[#B32B2C]'
                        }`}>
                          {r.type === 'partner' ? <Bike size={14} /> : <User size={14} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{r.name}</p>
                          <p className="text-xs text-gray-400">{r.type === 'partner' ? 'Delivery Partner' : 'Customer'}{r.phone ? ` · ${r.phone}` : ''} · {r.tokens.length} device{r.tokens.length !== 1 ? 's' : ''}</p>
                        </div>
                        {selectedRecipient?.id === r.id && <CheckCircle2 size={16} className="text-[#B32B2C] shrink-0" />}
                      </button>
                    ))
                  )}
                </div>
              )}
              {selectedRecipient && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm">
                  <CheckCircle2 size={14} className="text-[#B32B2C]" />
                  <span className="font-medium text-[#B32B2C]">{selectedRecipient.name}</span>
                  <span className="text-gray-500">— {selectedRecipient.tokens.length} device{selectedRecipient.tokens.length !== 1 ? 's' : ''}</span>
                  <button onClick={() => { setSelectedRecipient(null); setRecipientSearch('') }}
                    className="ml-auto text-gray-400 hover:text-red-500"><XCircle size={14} /></button>
                </div>
              )}
            </div>
          )}

          {/* Message fields */}
          <Input label="Notification Title" placeholder="e.g. Special Weekend Offer 🎉"
            value={pushTitle} onChange={e => setPushTitle(e.target.value)} />
          <Textarea label="Message" placeholder="Enter your notification message…" rows={4}
            value={pushBody} onChange={e => setPushBody(e.target.value)} />

          {/* Token count summary */}
          <p className="text-xs text-gray-400">
            {(() => {
              const t = collectTokens()
              return t.length > 0
                ? `Will send to ${t.length} device token${t.length !== 1 ? 's' : ''}`
                : 'No device tokens in selection'
            })()}
          </p>

          <div className="flex gap-3 pt-2">
            <Button icon={sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              onClick={handleSend} disabled={sending}>
              {sending ? 'Sending…' : 'Send Notification'}
            </Button>
          </div>
        </div>
      )}

      {/* ── Templates ──────────────────────────────────────────────────── */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {templates.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-2">{t.name}</h3>
              <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3 font-mono">{t.preview}</p>
              <div className="flex gap-2 mt-4">
                <Button size="sm" className="flex-1" onClick={() => {
                  setActiveTab('push')
                  setPushTitle(t.name)
                  setPushBody(t.preview)
                }}>Use Template</Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
