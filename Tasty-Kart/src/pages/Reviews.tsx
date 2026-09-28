import { useState, useEffect } from 'react'
import { Star, Trash2, Loader2 } from 'lucide-react'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Modal'
import { formatDateTime } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import {
  subscribeToCollection,
  deleteDocumentFromFirestore,
} from '@/lib/firebaseService'

type Review = {
  id: string
  customerName?: string
  reviewerName?: string
  partnerName?: string
  userName?: string
  displayName?: string
  customerId?: string
  partnerId?: string
  orderId?: string
  deliveryPartnerId?: string
  deliveryPartnerName?: string
  restaurantName?: string
  rating?: number
  comment?: string
  type?: string
  reviewerRole?: string
  status?: string
  reply?: string | null
  createdAt?: string
}

type NamedDoc = {
  id: string
  name?: string
  uid?: string
  email?: string
  displayName?: string
  fullName?: string
}

type OrderName = {
  id: string
  customerId?: string
  customerName?: string
  userName?: string
}

function textOf(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function timeOf(value: unknown): number {
  if (!value) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Date.parse(value) || 0
  if (value instanceof Date) return value.getTime()
  const ts = value as { toMillis?: () => number; seconds?: number }
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (typeof ts.seconds === 'number') return ts.seconds * 1000
  return 0
}

function isPlaceholderName(name: string) {
  const value = name.trim().toLowerCase()
  return (
    !value ||
    value === 'guest user' ||
    value === 'customer' ||
    value === 'user' ||
    value === 'guest' ||
    value.startsWith('guest_')
  )
}

function personName(doc?: NamedDoc | null) {
  const named = textOf(doc?.name) || textOf(doc?.displayName) || textOf(doc?.fullName)
  if (!isPlaceholderName(named)) return named
  const email = textOf(doc?.email)
  const at = email.indexOf('@')
  return at > 0 ? email.slice(0, at) : ''
}

export function Reviews() {
  const [reviewsList, setReviewsList] = useState<Review[]>([])
  const [customers, setCustomers] = useState<NamedDoc[]>([])
  const [users, setUsers] = useState<NamedDoc[]>([])
  const [partners, setPartners] = useState<NamedDoc[]>([])
  const [orders, setOrders] = useState<OrderName[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null)
  const { success } = useToast()

  useEffect(() => {
    const unsub = subscribeToCollection<Review>('reviews', (data) => {
      setReviewsList(
        data
          .filter(r => textOf(r.type).toLowerCase() !== 'food')
          .sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt)),
      )
      setLoading(false)
    })
    const unsubCustomers = subscribeToCollection<NamedDoc>('customers', setCustomers)
    const unsubUsers = subscribeToCollection<NamedDoc>('users', setUsers)
    const unsubPartners = subscribeToCollection<NamedDoc>('deliveryPartners', setPartners)
    const unsubOrders = subscribeToCollection<OrderName>('orders', setOrders)
    return () => {
      unsub()
      unsubCustomers()
      unsubUsers()
      unsubPartners()
      unsubOrders()
    }
  }, [])

  const lookupName = (id: string | undefined, docs: NamedDoc[]) => {
    if (!id) return ''
    const match = docs.find(d => d.id === id || d.uid === id)
    return personName(match)
  }

  const displayName = (r: Review) => {
    const stored = [r.reviewerName, r.customerName, r.userName, r.displayName, r.partnerName]
      .map(textOf)
      .find(name => !isPlaceholderName(name))
    if (stored) return stored

    const order = orders.find(o => o.id === r.orderId)
    const orderName = textOf(order?.customerName) || textOf(order?.userName)
    if (!isPlaceholderName(orderName)) return orderName

    const fromCustomer =
      lookupName(r.customerId, customers) ||
      lookupName(r.customerId, users) ||
      lookupName(order?.customerId, customers) ||
      lookupName(order?.customerId, users)
    if (fromCustomer) return fromCustomer

    const fromPartner = lookupName(r.partnerId || r.deliveryPartnerId, partners)
    if (fromPartner) return fromPartner

    return r.reviewerRole === 'delivery_partner' ? 'Delivery partner' : 'Customer'
  }

  const filtered = filter === 'all' ? reviewsList : reviewsList.filter(r => r.type === filter)

  return (
    <div className="space-y-5">
      <div className="flex gap-2 flex-wrap">
        {['all', 'restaurant', 'delivery'].map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium capitalize transition-all ${filter === t ? 'bg-[#B32B2C] text-white' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 hover:border-[#B32B2C] hover:text-[#B32B2C]'}`}>
            {t === 'all' ? 'All Reviews' : t === 'delivery' ? 'Delivery Partner Reviews' : 'Restaurant Reviews'}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
            <Loader2 size={22} className="animate-spin text-[#B32B2C]" />
            <span className="text-sm font-medium">Loading reviews from Firebase...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Star size={32} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No reviews yet</p>
            <p className="text-xs mt-1">Restaurant and delivery partner reviews from the apps will show here</p>
          </div>
        ) : filtered.map(r => {
          const name = displayName(r)
          const kind = textOf(r.type).toLowerCase() === 'delivery' ? 'delivery' : 'restaurant'
          const about = kind === 'delivery'
            ? textOf(r.deliveryPartnerName) || lookupName(r.deliveryPartnerId, partners)
            : textOf(r.restaurantName)
          const rating = Number(r.rating) || 0
          return (
          <div key={r.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-700 dark:text-gray-300 shrink-0">
                  {(name || 'C').charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{name}</p>
                    <StatusBadge status={textOf(r.status) || 'published'} />
                    <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full text-gray-500">
                      {kind === 'delivery' ? 'Delivery partner' : 'Restaurant'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(r.createdAt)}</p>
                  {about && <p className="text-xs text-gray-500 mt-0.5">{kind === 'delivery' ? `Delivery partner: ${about}` : about}</p>}
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={14} className={i < rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'} />
                ))}
              </div>
            </div>

            <p className="text-sm text-gray-700 dark:text-gray-300 mt-3 leading-relaxed">{textOf(r.comment) || 'No written comment'}</p>

            {r.reply && (
              <div className="mt-3 pl-4 border-l-2 border-[#B32B2C]/30 bg-red-50/50 dark:bg-red-900/5 rounded-r-lg p-3">
                <p className="text-xs font-semibold text-[#B32B2C] mb-1">Admin Reply</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{r.reply}</p>
              </div>
            )}

            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-50 dark:border-gray-800">
              <Button size="xs" variant="ghost" icon={<Trash2 size={12} />} onClick={() => setDeleteTarget(r)} className="text-red-500 hover:bg-red-50">Delete</Button>
            </div>
          </div>
          )
        })}
      </div>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteDocumentFromFirestore('reviews', deleteTarget.id)
            success('Review deleted')
          }
          setDeleteTarget(null)
        }}
        title="Delete Review" message="Are you sure you want to delete this review? This action cannot be undone." variant="danger" />
    </div>
  )
}
