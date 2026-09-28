import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount?: number | null, currency = '₹') {
  const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0
  return `${currency}${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatDate(date?: string | Date | any | null) {
  if (!date) return '—'
  // Handle Firestore Timestamp objects ({ seconds, nanoseconds })
  const raw = date?.toDate ? date.toDate() : date
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

export function formatDateTime(date: string | Date | any) {
  if (!date) return '—'
  // Handle Firestore Timestamp objects ({ seconds, nanoseconds })
  const raw = date?.toDate ? date.toDate() : date
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export function formatTime(date: string | Date | any) {
  if (!date) return '—'
  const raw = date?.toDate ? date.toDate() : date
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit'
  })
}

export function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

/** Cartoon avatar (DiceBear) — used when a customer has no photo. */
export function getCartoonAvatar(seed?: string | null) {
  const safeSeed = encodeURIComponent((seed || 'tastykart').trim() || 'tastykart')
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${safeSeed}`
}

/** Prefer real avatar URL; otherwise return a consistent cartoon avatar. */
export function getCustomerAvatar(avatar?: string | null, seed?: string | null) {
  const photo = typeof avatar === 'string' ? avatar.trim() : ''
  if (photo && /^https?:\/\//i.test(photo)) return photo
  const safeSeed = typeof seed === 'string' ? seed : ''
  return getCartoonAvatar(safeSeed)
}

export function truncate(str: string, length = 30) {
  return str.length > length ? str.slice(0, length) + '…' : str
}

export function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
