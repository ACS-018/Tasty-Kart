import { useState, useEffect, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { Save, Camera, User, Calendar, Loader2 } from 'lucide-react'
import { updateProfile } from 'firebase/auth'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { subscribeToOrders, watchUserProfile, saveAdminProfile } from '@/lib/firebaseService'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { getRoleInfo } from '@/lib/permissions'
import type { Order } from '@/data/dummy'

const colorMap = {
  red:    { bg: 'bg-red-50', icon: 'text-red-600' },
  green:  { bg: 'bg-green-50', icon: 'text-green-600' },
  blue:   { bg: 'bg-blue-50', icon: 'text-blue-600' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-600' },
}

function countsAsSpend(status: string) {
  const value = status.trim().toLowerCase()
  return value !== 'cancelled' && value !== 'canceled' && value !== 'refunded' && !value.includes('cancel')
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') }
}

const emptyForm = { firstName: '', lastName: '', email: '', phone: '', city: '' }

export function Profile() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [form, setForm] = useState(emptyForm)
  const [createdAt, setCreatedAt] = useState<unknown>(null)
  const [saving, setSaving] = useState(false)
  const hydrated = useRef(false)
  const { success, error: toastError } = useToast()

  useEffect(() => subscribeToOrders(setOrders), [])

  useEffect(() => {
    if (!user?.uid) return
    const uid = user.uid
    const authName = user.name || ''
    const authEmail = user.email || ''
    hydrated.current = false
    return watchUserProfile(uid, (data) => {
      setCreatedAt(data?.createdAt ?? null)
      if (hydrated.current) return
      const fallback = splitName(authName)
      setForm({
        firstName: String(data?.firstName || fallback.firstName),
        lastName: String(data?.lastName || fallback.lastName),
        email: String(data?.email || authEmail),
        phone: String(data?.phone || ''),
        city: String(data?.city || ''),
      })
      hydrated.current = true
    })
  }, [user?.uid, user?.name, user?.email])

  const fullName = `${form.firstName} ${form.lastName}`.trim() || user?.name || 'Admin'
  const roleLabel = user?.adminRole ? getRoleInfo(user.adminRole).name : 'Administrator'
  const memberSince = formatDate(createdAt || auth.currentUser?.metadata.creationTime)
  const lastLogin = formatDateTime(auth.currentUser?.metadata.lastSignInTime)
  const initial = (form.firstName || fullName).trim().charAt(0).toUpperCase() || 'A'

  const saveProfile = async () => {
    if (!user?.uid) {
      toastError('Not signed in', 'Sign in again to save your profile')
      return
    }
    if (!form.firstName.trim()) {
      toastError('Validation', 'First name is required')
      return
    }
    setSaving(true)
    try {
      await saveAdminProfile(user.uid, form)
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: fullName })
      }
      success('Profile saved', 'Your details are stored in Firebase')
    } catch (err) {
      toastError('Save failed', err instanceof Error ? err.message : 'Could not save profile')
    } finally {
      setSaving(false)
    }
  }

  const stats = useMemo(() => {
    const spent = orders.reduce((sum, order) => {
      if (!countsAsSpend(String(order.status || ''))) return sum
      return sum + (Number(order.total) || 0)
    }, 0)
    return [
      { label: 'Total Orders', value: orders.length.toLocaleString('en-IN'), icon: User, color: 'blue' as const },
      { label: 'Total Spend', value: formatCurrency(spent), icon: User, color: 'green' as const },
      { label: 'Member Since', value: memberSince, icon: Calendar, color: 'purple' as const },
    ]
  }, [orders, memberSince])

  return (
    <div className="space-y-6 pb-8">

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Avatar Card */}
          <Card className="flex flex-col items-center text-center p-7 rounded-2xl border border-gray-100 shadow-sm">
            <div className="relative mb-4">
              <div className="w-24 h-24 rounded-2xl bg-[#B32B2C] flex items-center justify-center text-white text-4xl font-bold shadow-lg">
                {initial}
              </div>
              <button className="absolute -bottom-2 -right-2 w-8 h-8 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-md hover:bg-gray-50 transition-colors">
                <Camera size={14} className="text-gray-600" />
              </button>
            </div>
            <h2 className="text-lg font-bold text-gray-900">{fullName}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{form.email || user?.email || '—'}</p>
            <div className="mt-3 px-3 py-1 bg-red-50 text-[#B32B2C] rounded-full text-xs font-semibold">
              {roleLabel}
            </div>
            <div className="mt-5 w-full space-y-2 text-left">
              {[
                { label: 'Member Since', value: memberSince },
                { label: 'Last Login', value: lastLogin },
                { label: 'Location', value: form.city || '—' },
              ].map(s => (
                <div key={s.label} className="flex justify-between text-sm">
                  <span className="text-gray-400">{s.label}</span>
                  <span className="font-medium text-gray-700">{s.value}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Edit Form */}
          <Card className="lg:col-span-2 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 mb-5">Personal Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="First Name" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
              <Input label="Last Name" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
              <Input label="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              <Input label="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              <Input label="Role" value={roleLabel} disabled />
              <Input label="City" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            </div>
            <div className="flex justify-end mt-5">
              <Button icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} onClick={saveProfile} disabled={saving}>
                {saving ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </Card>
        </div>

    </div>
  )
}