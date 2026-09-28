import { useState, useEffect } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Edit, Trash2, Plus, Gift, Tag, Clock, Percent } from 'lucide-react'
import { motion } from 'framer-motion'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import {
  subscribeToCollection,
  addDocumentToFirestore,
  updateDocumentInFirestore,
  deleteDocumentFromFirestore,
} from '@/lib/firebaseService'
import { useToast } from '@/components/ui/Toast'
import type { Restaurant } from '@/data/dummy'

type Offer = Record<string, any> & { id: string }

const gradients = [
  'from-red-500 to-orange-400',
  'from-blue-500 to-purple-500',
  'from-green-500 to-teal-400',
  'from-amber-500 to-yellow-400',
]

const colorMap = {
  red:    { bg: 'bg-red-50', icon: 'text-red-600' },
  green:  { bg: 'bg-green-50', icon: 'text-green-600' },
  blue:   { bg: 'bg-blue-50', icon: 'text-blue-600' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-600' },
}

const emptyForm = () => ({
  name: '', type: 'percentage', discount: '', restaurantId: '', validTill: '', status: 'active',
})

export function Offers() {
  const [offersList, setOffersList] = useState<Offer[]>([])
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState<Offer | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Offer | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Record<string, string>>(emptyForm())
  const { success, error: toastError } = useToast()

  const stats = [
    { label: 'Total Offers', value: offersList.length, icon: Gift, color: 'red' as const },
    { label: 'Active', value: offersList.filter(o => o.status === 'active').length, icon: Tag, color: 'green' as const },
    { label: 'Expired', value: offersList.filter(o => o.status === 'expired' || o.status === 'inactive').length, icon: Clock, color: 'blue' as const },
  ]

  useEffect(() => {
    const unsubs = [
      subscribeToCollection<Offer>('offers', setOffersList),
      subscribeToCollection<Restaurant>('restaurants', setRestaurants),
    ]
    return () => unsubs.forEach(unsub => unsub())
  }, [])

  const openAdd = () => { setForm(emptyForm()); setShowAdd(true) }
  const openEdit = (o: Offer) => {
    const matched = restaurants.find(restaurant =>
      restaurant.id === o.restaurantId || restaurant.name === o.restaurantName,
    )
    setForm({
      name: getOfferName(o),
      type: getDiscountType(o),
      discount: String(getDiscount(o)),
      restaurantId: matched?.id || o.restaurantId || '',
      validTill: getExpiry(o),
      status: o.status ?? 'active',
    })
    setEditItem(o)
  }
  const closeModal = () => { setShowAdd(false); setEditItem(null); setForm(emptyForm()) }

  const handleSave = async () => {
    if (!form.name.trim()) { toastError('Validation', 'Offer name is required'); return }
    const restaurant = restaurants.find(item => item.id === form.restaurantId)
    if (!restaurant) { toastError('Validation', 'Select a restaurant'); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        title: form.name,
        type: form.type,
        discount: Number(form.discount) || 0,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        validTill: form.validTill,
        expiry: form.validTill,
        status: form.status,
      }
      if (editItem) {
        const res = await updateDocumentInFirestore('offers', editItem.id, payload)
        if (res.success) success('Offer updated!', form.name)
        else toastError('Update failed', res.error as string)
      } else {
        const res = await addDocumentToFirestore('offers', payload)
        if (res.success) success('Offer created!', form.name)
        else toastError('Create failed', res.error as string)
      }
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const res = await deleteDocumentFromFirestore('offers', deleteTarget.id)
    if (res.success) success('Offer deleted')
    else toastError('Delete failed', res.error as string)
    setDeleteTarget(null)
  }

  const getOfferName = (o: Offer) => o.name || o.title || 'Untitled Offer'
  const getRestaurantName = (o: Offer) => o.restaurantName || o.description || 'All Restaurants'
  const getDiscountType = (o: Offer) => o.type || 'percentage'
  const getDiscount = (o: Offer) => o.discount ?? o.minOrder ?? 0
  const getExpiry = (o: Offer) => o.expiry || o.validTill || ''

  const columns: ColumnDef<Offer, unknown>[] = [
    {
      id: 'offer',
      header: 'Offer',
      accessorFn: (row) => `${row.name || ''} ${row.title || ''} ${row.restaurantName || ''}`.trim(),
      cell: ({ row: { original: o } }) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-red-100 to-orange-100 rounded-xl flex items-center justify-center text-xl">🎁</div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{getOfferName(o)}</p>
            <p className="text-xs text-gray-400">{getRestaurantName(o)}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'discount',
      header: 'Discount',
      cell: ({ row: { original: o } }) => (
        <span className="text-sm font-bold text-[#B32B2C]">
          {getDiscountType(o) === 'percentage' ? `${getDiscount(o)}% OFF` : `₹${getDiscount(o)} OFF`}
        </span>
      ),
    },
    {
      id: 'expiry',
      header: 'Expiry',
      cell: ({ row: { original: o } }) => <span className="text-xs text-gray-500">{getExpiry(o) || '—'}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status ?? 'active'} />,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => openEdit(row.original)} className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"><Edit size={15} /></button>
          <button onClick={() => setDeleteTarget(row.original)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={15} /></button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6 pb-8">

      <div className="flex items-center justify-end gap-2 flex-wrap">
        <Button size="sm" icon={<Plus size={14} />} onClick={openAdd}>Create Offer</Button>
      </div>

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

      {/* Offer Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {offersList.map((o, i) => (
          <motion.div key={o.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className={`relative bg-gradient-to-br ${gradients[i % gradients.length]} rounded-2xl p-5 text-white overflow-hidden shadow-md`}>
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full" />
            <div className="absolute -right-2 top-8 w-16 h-16 bg-white/10 rounded-full" />
            <div className="relative">
              <p className="text-xs font-medium opacity-80 uppercase tracking-wider">{getDiscountType(o) === 'percentage' ? 'Percentage Off' : 'Fixed Discount'}</p>
              <p className="text-3xl font-black mt-1">{getDiscountType(o) === 'percentage' ? `${getDiscount(o)}%` : `₹${getDiscount(o)}`}</p>
              <p className="text-sm font-semibold mt-2">{getOfferName(o)}</p>
              <p className="text-xs opacity-75 mt-0.5">{getRestaurantName(o)}</p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs opacity-75">Expires {getExpiry(o) || '—'}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${o.status === 'active' ? 'bg-white/20' : 'bg-black/20'}`}>{o.status ?? 'active'}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <DataTable data={offersList} columns={columns} searchPlaceholder="Search offers..." />
      </div>

      {/* Create / Edit Modal */}
      <Modal open={showAdd || !!editItem} onClose={closeModal} title={editItem ? 'Edit Offer' : 'Create Offer'} size="md">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input label="Offer Name" placeholder="e.g. Weekend Special" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <Select label="Discount Type" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed (₹)</option>
          </Select>
          <Input label="Discount Value" type="number" placeholder="20" value={form.discount}
            onChange={e => setForm(f => ({ ...f, discount: e.target.value }))} />
          <Select
            label="Restaurant Name"
            value={form.restaurantId}
            onChange={e => setForm(f => ({ ...f, restaurantId: e.target.value }))}
          >
            <option value="">Select restaurant</option>
            {restaurants.map(restaurant => (
              <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>
            ))}
          </Select>
          <Input label="Expiry Date" type="date" value={form.validTill}
            onChange={e => setForm(f => ({ ...f, validTill: e.target.value }))} />
          <Select label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
        <div className="flex gap-3 justify-end mt-5 pt-4 border-t border-gray-100">
          <Button variant="secondary" onClick={closeModal}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : editItem ? 'Save Changes' : 'Create Offer'}</Button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Offer" message={`Delete offer "${deleteTarget ? getOfferName(deleteTarget) : ''}"?`} variant="danger" />
    </div>
  )
}
