import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  CheckCircle, Users, Plus, Pencil, Trash2, Crown,
  CalendarClock, AlertTriangle, ToggleLeft, ToggleRight,
  Wallet, TrendingUp, Star, X
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { subscribeToCollection, addDocumentToFirestore, updateDocumentInFirestore, deleteDocumentFromFirestore } from '@/lib/firebaseService'
import { formatCurrency } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────
interface SubscriptionPlan {
  id: string
  name: string
  price: number
  duration: 'monthly' | 'quarterly' | 'yearly'
  status: 'active' | 'inactive'
  benefits: string[]
  subscriberCount: number
  color: string
  expiryDate?: string   // ISO date string  e.g. "2026-12-31"
  description?: string
}

const EMPTY_FORM: Omit<SubscriptionPlan, 'id'> = {
  name: '', price: 0, duration: 'monthly', status: 'active',
  benefits: [], subscriberCount: 0, color: '#6366f1', expiryDate: '', description: '',
}

const DURATION_LABELS: Record<string, string> = {
  monthly: 'per month', quarterly: 'per 3 months', yearly: 'per year',
}

const CARD_GRADIENTS = [
  'from-indigo-500 to-purple-600',
  'from-[#B32B2C] to-orange-500',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-yellow-600',
  'from-blue-500 to-cyan-600',
  'from-pink-500 to-rose-600',
]

// ─── Expiry helpers ───────────────────────────────────────────────────────────
function expiryStatus(dateStr?: string): 'expired' | 'expiring' | 'valid' | 'none' {
  if (!dateStr) return 'none'
  const expiry = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / 86400000)
  if (diffDays < 0) return 'expired'
  if (diffDays <= 30) return 'expiring'
  return 'valid'
}

function ExpiryBadge({ date }: { date?: string }) {
  const status = expiryStatus(date)
  if (status === 'none') return null
  const expiry = new Date(date!)
  const label = expiry.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  if (status === 'expired')
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200"><AlertTriangle size={10} /> Expired {label}</span>
  if (status === 'expiring')
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200"><CalendarClock size={10} /> Expires {label}</span>
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-200"><CheckCircle size={10} /> Valid till {label}</span>
}

// ─── Benefits input helper ────────────────────────────────────────────────────
function BenefitsEditor({ benefits, onChange }: { benefits: string[]; onChange: (b: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const trimmed = draft.trim()
    if (trimmed && !benefits.includes(trimmed)) { onChange([...benefits, trimmed]); setDraft('') }
  }
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Benefits</label>
      <div className="flex gap-2">
        <input
          value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="Type a benefit and press Enter or Add"
          className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#B32B2C]/30 focus:border-[#B32B2C]"
        />
        <button type="button" onClick={add} className="px-3 py-2 rounded-lg bg-[#B32B2C] text-white text-sm font-medium hover:bg-red-700 transition-colors">Add</button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {benefits.map((b, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-medium border border-indigo-200 dark:border-indigo-800">
            {b}
            <button type="button" onClick={() => onChange(benefits.filter((_, j) => j !== i))} className="hover:text-red-600 transition-colors"><X size={12} /></button>
          </span>
        ))}
        {benefits.length === 0 && <span className="text-xs text-gray-400 italic">No benefits added yet</span>}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function Subscriptions() {
  const toast = useToast()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(false)

  // Modal state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null)
  const [deletingPlan, setDeletingPlan] = useState<SubscriptionPlan | null>(null)
  const [form, setForm] = useState<Omit<SubscriptionPlan, 'id'>>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Subscribe to Firestore
  useEffect(() => {
    const unsub = subscribeToCollection<SubscriptionPlan>('subscriptions', setPlans)
    return () => unsub()
  }, [])

  // Stats
  const stats = useMemo(() => {
    const totalSubscribers = plans.reduce((s, p) => s + (p.subscriberCount || 0), 0)
    const monthlyRevenue = plans.reduce((s, p) => {
      const subs = p.subscriberCount || 0
      const mult = p.duration === 'monthly' ? 1 : p.duration === 'quarterly' ? 1/3 : 1/12
      return s + p.price * subs * mult
    }, 0)
    const activePlans = plans.filter(p => p.status === 'active').length
    const expiredPlans = plans.filter(p => expiryStatus(p.expiryDate) === 'expired').length
    return { totalSubscribers, monthlyRevenue, activePlans, expiredPlans }
  }, [plans])

  // Open create form
  const openCreate = () => {
    setEditingPlan(null)
    setForm({ ...EMPTY_FORM })
    setFormErrors({})
    setIsFormOpen(true)
  }

  // Open edit form
  const openEdit = (plan: SubscriptionPlan) => {
    setEditingPlan(plan)
    setForm({
      name: plan.name, price: plan.price, duration: plan.duration,
      status: plan.status, benefits: [...plan.benefits],
      subscriberCount: plan.subscriberCount || 0, color: plan.color || '#6366f1',
      expiryDate: plan.expiryDate || '', description: plan.description || '',
    })
    setFormErrors({})
    setIsFormOpen(true)
  }

  // Validate
  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Plan name is required'
    if (!form.price || form.price <= 0) errs.price = 'Price must be greater than 0'
    if (form.benefits.length === 0) errs.benefits = 'Add at least one benefit'
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  // Save (create or update)
  const handleSave = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      if (editingPlan) {
        await updateDocumentInFirestore('subscriptions', editingPlan.id, { ...form })
        toast.success('Plan Updated', `"${form.name}" has been updated successfully`)
      } else {
        const id = `sub_${Date.now()}`
        await addDocumentToFirestore('subscriptions', { id, ...form })
        toast.success('Plan Created', `"${form.name}" is now live on Firebase`)
      }
      setIsFormOpen(false)
    } catch {
      toast.error('Save Failed', 'Could not save subscription plan. Try again.')
    } finally {
      setLoading(false)
    }
  }

  // Delete
  const handleDelete = async () => {
    if (!deletingPlan) return
    setLoading(true)
    try {
      await deleteDocumentFromFirestore('subscriptions', deletingPlan.id)
      toast.success('Plan Deleted', `"${deletingPlan.name}" has been removed`)
      setDeletingPlan(null)
    } catch {
      toast.error('Delete Failed', 'Could not delete the plan. Try again.')
    } finally {
      setLoading(false)
    }
  }

  // Toggle active / inactive
  const handleToggleStatus = async (plan: SubscriptionPlan) => {
    const newStatus = plan.status === 'active' ? 'inactive' : 'active'
    try {
      await updateDocumentInFirestore('subscriptions', plan.id, { status: newStatus })
      toast.success('Status Updated', `"${plan.name}" is now ${newStatus}`)
    } catch {
      toast.error('Update Failed', 'Could not toggle plan status.')
    }
  }

  const setField = <K extends keyof typeof form>(key: K, value: typeof form[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
    if (formErrors[key]) setFormErrors(prev => ({ ...prev, [key]: '' }))
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-end gap-2 flex-wrap">
        <Button icon={<Plus size={16} />} onClick={openCreate}>
          Create Plan
        </Button>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Subscribers', value: stats.totalSubscribers.toLocaleString(), icon: Users, color: 'text-indigo-600 bg-indigo-50' },
          { label: 'Est. Monthly Revenue', value: formatCurrency(Math.round(stats.monthlyRevenue)), icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Active Plans', value: stats.activePlans, icon: Star, color: 'text-[#B32B2C] bg-red-50' },
          { label: 'Expired Plans', value: stats.expiredPlans, icon: AlertTriangle, color: 'text-amber-600 bg-amber-50' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>
              <s.icon size={18} />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{s.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Plan Cards ── */}
      {plans.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-16 text-center">
          <Wallet size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-base font-semibold text-gray-500">No subscription plans yet</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">Create your first plan to get started</p>
          <Button icon={<Plus size={15} />} onClick={openCreate} size="sm">Create Plan</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {plans.map((plan, i) => {
            const gradient = CARD_GRADIENTS[i % CARD_GRADIENTS.length]
            const expStatus = expiryStatus(plan.expiryDate)
            return (
              <motion.div key={plan.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col">

                {/* Card header */}
                <div className={`bg-gradient-to-br ${gradient} p-6 text-white relative overflow-hidden`}>
                  {expStatus === 'expired' && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                      <span className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">EXPIRED</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/20 capitalize">{plan.duration}</span>
                    <div className="flex items-center gap-1.5">
                      {plan.status === 'active'
                        ? <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/80">Active</span>
                        : <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-black/30">Inactive</span>
                      }
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <Crown size={18} className="opacity-80" />
                    <h3 className="text-xl font-bold leading-tight">{plan.name}</h3>
                  </div>
                  <div className="flex items-end gap-1 mt-2">
                    <span className="text-3xl font-black">{formatCurrency(plan.price)}</span>
                    <span className="text-sm opacity-70 pb-0.5">{DURATION_LABELS[plan.duration] ?? plan.duration}</span>
                  </div>
                  {plan.description && <p className="text-xs opacity-75 mt-2 line-clamp-2">{plan.description}</p>}
                </div>

                {/* Benefits */}
                <div className="p-5 flex-1 flex flex-col gap-4">
                  <ul className="space-y-2.5">
                    {plan.benefits.map((b, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <CheckCircle size={15} className="text-green-500 shrink-0 mt-0.5" />
                        {b}
                      </li>
                    ))}
                  </ul>

                  {/* Subscriber count */}
                  <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <Users size={15} className="text-gray-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-bold text-gray-900 dark:text-white">{(plan.subscriberCount || 0).toLocaleString()}</span> subscribers
                    </span>
                  </div>

                  {/* Expiry badge */}
                  <ExpiryBadge date={plan.expiryDate} />

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-1 mt-auto border-t border-gray-100 dark:border-gray-800">
                    <button onClick={() => openEdit(plan)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 transition-colors border border-indigo-200 dark:border-indigo-800">
                      <Pencil size={13} /> Edit
                    </button>
                    <button onClick={() => handleToggleStatus(plan)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors border ${
                        plan.status === 'active'
                          ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 border-amber-200'
                          : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 border-emerald-200'
                      }`}>
                      {plan.status === 'active' ? <><ToggleLeft size={13} /> Deactivate</> : <><ToggleRight size={13} /> Activate</>}
                    </button>
                    <button onClick={() => setDeletingPlan(plan)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 transition-colors border border-red-200 dark:border-red-900">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* ── Summary Table ── */}
      {plans.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp size={16} className="text-[#B32B2C]" /> Subscription Revenue Summary
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  {['Plan', 'Duration', 'Price', 'Subscribers', 'Monthly Revenue', 'Expiry', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {plans.map(plan => {
                  const subs = plan.subscriberCount || 0
                  const mult = plan.duration === 'monthly' ? 1 : plan.duration === 'quarterly' ? 1/3 : 1/12
                  const monthlyRev = plan.price * subs * mult
                  const expStatus = expiryStatus(plan.expiryDate)
                  return (
                    <tr key={plan.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Crown size={14} className="text-amber-500 shrink-0" /> {plan.name}
                      </td>
                      <td className="px-5 py-3.5 capitalize text-gray-600 dark:text-gray-400">{plan.duration}</td>
                      <td className="px-5 py-3.5 font-bold text-[#B32B2C]">{formatCurrency(plan.price)}</td>
                      <td className="px-5 py-3.5 font-medium">{subs.toLocaleString()}</td>
                      <td className="px-5 py-3.5 font-semibold text-emerald-600">{formatCurrency(Math.round(monthlyRev))}</td>
                      <td className="px-5 py-3.5"><ExpiryBadge date={plan.expiryDate} /></td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          expStatus === 'expired' ? 'bg-red-100 text-red-700' :
                          plan.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {expStatus === 'expired' ? '⚠ Expired' : plan.status === 'active' ? '● Active' : '○ Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => openEdit(plan)} className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors" title="Edit"><Pencil size={14} /></button>
                          <button onClick={() => handleToggleStatus(plan)} className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors" title="Toggle status">
                            {plan.status === 'active' ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                          </button>
                          <button onClick={() => setDeletingPlan(plan)} className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors" title="Delete"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      <Modal
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingPlan ? `Edit Plan: ${editingPlan.name}` : 'Create Subscription Plan'}
        description={editingPlan ? 'Update plan details — changes sync to Firebase instantly' : 'Define a new subscription tier for your customers'}
        size="lg"
      >
        <div className="space-y-5">
          {/* Row 1: Name + Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Plan Name *"
              placeholder="e.g. TastyKart Gold"
              value={form.name}
              onChange={e => setField('name', e.target.value)}
              error={formErrors.name}
            />
            <Input
              label="Price (₹) *"
              type="number"
              min={1}
              placeholder="e.g. 199"
              value={form.price || ''}
              onChange={e => setField('price', parseFloat(e.target.value) || 0)}
              error={formErrors.price}
            />
          </div>

          {/* Row 2: Duration + Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Duration *"
              value={form.duration}
              onChange={e => setField('duration', e.target.value as SubscriptionPlan['duration'])}
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly (3 months)</option>
              <option value="yearly">Yearly</option>
            </Select>
            <Select
              label="Status *"
              value={form.status}
              onChange={e => setField('status', e.target.value as 'active' | 'inactive')}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>

          {/* Row 3: Expiry date + Subscriber count */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Expiry Date"
              type="date"
              value={form.expiryDate || ''}
              onChange={e => setField('expiryDate', e.target.value)}
            />
            <Input
              label="Subscriber Count"
              type="number"
              min={0}
              placeholder="0"
              value={form.subscriberCount || ''}
              onChange={e => setField('subscriberCount', parseInt(e.target.value) || 0)}
            />
          </div>

          {/* Description */}
          <Textarea
            label="Description (optional)"
            placeholder="Brief description shown on the plan card..."
            value={form.description || ''}
            onChange={e => setField('description', e.target.value)}
            rows={2}
          />

          {/* Benefits */}
          <BenefitsEditor benefits={form.benefits} onChange={b => setField('benefits', b)} />
          {formErrors.benefits && <p className="text-xs text-red-600 -mt-2">{formErrors.benefits}</p>}

          {/* Preview of expiry */}
          {form.expiryDate && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
              <CalendarClock size={15} className="text-gray-400 shrink-0" />
              <span className="text-xs text-gray-600 dark:text-gray-400 mr-2">Expiry preview:</span>
              <ExpiryBadge date={form.expiryDate} />
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" onClick={() => setIsFormOpen(false)} disabled={loading}>Cancel</Button>
            <Button onClick={handleSave} loading={loading} icon={editingPlan ? <Pencil size={15} /> : <Plus size={15} />}>
              {editingPlan ? 'Save Changes' : 'Create Plan'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete Confirm ── */}
      <ConfirmDialog
        open={!!deletingPlan}
        onClose={() => setDeletingPlan(null)}
        onConfirm={handleDelete}
        title="Delete Subscription Plan"
        message={`Are you sure you want to permanently delete "${deletingPlan?.name}"? This cannot be undone and will affect ${deletingPlan?.subscriberCount || 0} subscribers.`}
        confirmLabel="Delete Plan"
        variant="danger"
        loading={loading}
      />
    </div>
  )
}
