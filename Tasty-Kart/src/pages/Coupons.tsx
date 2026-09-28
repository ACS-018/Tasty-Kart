import { useState, useEffect } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { motion } from 'framer-motion'
import { Edit, Trash2, Plus, Copy, Loader2, Tag, Percent, Clock } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/Button'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'

import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import {
  subscribeToCollection,
  addDocumentToFirestore,
  deleteDocumentFromFirestore
} from '@/lib/firebaseService'

type Coupon = Record<string, any> & { id: string }

const colorMap = {
  red:    { bg: 'bg-red-50', icon: 'text-red-600' },
  green:  { bg: 'bg-green-50', icon: 'text-green-600' },
  blue:   { bg: 'bg-blue-50', icon: 'text-blue-600' },
  amber:  { bg: 'bg-amber-50', icon: 'text-amber-600' },
}

export function Coupons() {
  const [couponsList, setCouponsList] = useState<Coupon[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState<Coupon | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { success, error: toastError } = useToast()

  const [formData, setFormData] = useState({
    code: '',
    type: 'percentage' as 'percentage' | 'fixed',
    discount: '20',
    minOrder: '299',
    maxDiscount: '100',
    expiry: '2026-12-31',
    usageLimit: '500',
    status: 'active'
  })

  // Quick stats
  const stats = [
    { label: 'Total Coupons', value: couponsList.length, icon: Tag, color: 'blue' as const },
    { label: 'Active', value: couponsList.filter(c => c.status === 'active').length, icon: Percent, color: 'green' as const },
    { label: 'Total Uses', value: couponsList.reduce((s, c) => s + (c.usageCount || 0), 0), icon: Clock, color: 'amber' as const },
  ]

  useEffect(() => {
    const unsub = subscribeToCollection<Coupon>('coupons', (liveData) => {
      setCouponsList(liveData)
    })
    return () => unsub()
  }, [])

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.code.trim()) return

    setIsSubmitting(true)
    try {
      const couponData = {
        id: editItem?.id || `c_${Date.now()}`,
        code: formData.code.toUpperCase().trim(),
        type: formData.type,
        discount: Number(formData.discount) || 10,
        minOrder: Number(formData.minOrder) || 199,
        maxDiscount: Number(formData.maxDiscount) || 100,
        expiry: formData.expiry || '2026-12-31',
        usageCount: editItem?.usageCount || 0,
        usageLimit: Number(formData.usageLimit) || 500,
        active: formData.status === 'active',
        status: formData.status,
        description: `${formData.discount}${formData.type === 'percentage' ? '%' : '₹'} off on orders above ₹${formData.minOrder}`
      }

      const res = await addDocumentToFirestore('coupons', couponData)
      setIsSubmitting(false)

      if (res.success) {
        success('Coupon Saved!', `"${formData.code}" saved to Firestore`)
        setShowAdd(false)
        setEditItem(null)
        setFormData({
          code: '', type: 'percentage', discount: '20', minOrder: '299',
          maxDiscount: '100', expiry: '2026-12-31', usageLimit: '500', status: 'active'
        })
      } else {
        toastError('Save Error', 'Could not save coupon')
      }
    } catch (err: any) {
      setIsSubmitting(false)
      toastError('Save Error', err?.message || 'Failed to save')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    const res = await deleteDocumentFromFirestore('coupons', deleteTarget.id)
    if (res.success) {
      success('Coupon Deleted', `"${deleteTarget.code}" removed`)
    }
    setDeleteTarget(null)
  }

  const columns: ColumnDef<Coupon, unknown>[] = [
    {
      accessorKey: 'code',
      header: 'Coupon Code',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-[#B32B2C] bg-red-50 px-3 py-1.5 rounded-lg tracking-wider">
            {row.original.code || 'COUPON'}
          </span>
          <button onClick={() => { navigator.clipboard.writeText(row.original.code || ''); success('Copied!') }}
            className="p-1 rounded text-gray-400 hover:text-gray-600 transition-colors">
            <Copy size={13} />
          </button>
        </div>
      ),
    },
    {
      id: 'discount',
      header: 'Discount',
      cell: ({ row: { original: c } }) => (
        <span className="text-sm font-semibold">
          {typeof c.discount === 'number'
            ? (c.type === 'percentage' ? `${c.discount}% OFF` : `₹${c.discount} OFF`)
            : (c.discount || 'Special Offer')}
        </span>
      ),
    },
    {
      accessorKey: 'minOrder',
      header: 'Min Order',
      cell: ({ row }) => <span className="text-sm">{formatCurrency(row.original.minOrder ?? 0)}</span>,
    },
    {
      accessorKey: 'maxDiscount',
      header: 'Max Discount',
      cell: ({ row }) => <span className="text-sm">{formatCurrency(row.original.maxDiscount ?? 0)}</span>,
    },
    {
      accessorKey: 'expiry',
      header: 'Expiry',
      cell: ({ row }) => <span className="text-xs text-gray-500">{row.original.expiry || 'No Expiry'}</span>,
    },
    {
      id: 'usage',
      header: 'Usage',
      cell: ({ row: { original: c } }) => {
        const count = c.usageCount || 0
        const limit = c.usageLimit || 1
        const pct = Math.min(100, Math.round((count / limit) * 100))

        return (
          <div>
            <div className="flex items-center gap-2 text-xs mb-1">
              <span className="font-medium">{count}</span>
              <span className="text-gray-400">/ {limit}</span>
            </div>
            <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-[#B32B2C] rounded-full" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'active',
      header: 'Status',
      cell: ({ row: { original: c } }) => {
        const isActive = c.active ?? (c.status === 'active')
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {isActive ? 'Active' : 'Inactive'}
          </span>
        )
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => {
            setEditItem(row.original)
            setFormData({
              code: row.original.code || '',
              type: (row.original.type as any) || 'percentage',
              discount: String(row.original.discount ?? '20'),
              minOrder: String(row.original.minOrder ?? '199'),
              maxDiscount: String(row.original.maxDiscount ?? '100'),
              expiry: row.original.expiry || '2026-12-31',
              usageLimit: String(row.original.usageLimit ?? '500'),
              status: row.original.active ? 'active' : 'inactive'
            })
          }} className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"><Edit size={15} /></button>
          <button onClick={() => setDeleteTarget(row.original)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={15} /></button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6 pb-8">

      <div className="flex items-center justify-end gap-2 flex-wrap">
        <Button size="sm" icon={<Plus size={14} />} onClick={() => {
                setFormData({
                  code: '', type: 'percentage', discount: '20', minOrder: '299',
                  maxDiscount: '100', expiry: '2026-12-31', usageLimit: '500', status: 'active'
                })
                setEditItem(null)
                setShowAdd(true)
              }}>Create Coupon</Button>
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

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <DataTable data={couponsList} columns={columns} searchPlaceholder="Search coupons..." />
      </div>

      <Modal open={showAdd || !!editItem} onClose={() => { setShowAdd(false); setEditItem(null) }} title={editItem ? 'Edit Coupon' : 'Create Coupon'} size="md">
        <form onSubmit={handleSaveSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input
                label="Coupon Code *"
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g. SAVE20"
                className="uppercase font-mono tracking-wider"
                required
              />
            </div>
            <Select
              label="Discount Type"
              value={formData.type}
              onChange={e => setFormData({ ...formData, type: e.target.value as any })}
            >
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed (₹)</option>
            </Select>
            <Input
              label="Discount Value"
              type="number"
              value={formData.discount}
              onChange={e => setFormData({ ...formData, discount: e.target.value })}
              placeholder="20"
            />
            <Input
              label="Min Order (₹)"
              type="number"
              value={formData.minOrder}
              onChange={e => setFormData({ ...formData, minOrder: e.target.value })}
              placeholder="300"
            />
            <Input
              label="Max Discount (₹)"
              type="number"
              value={formData.maxDiscount}
              onChange={e => setFormData({ ...formData, maxDiscount: e.target.value })}
              placeholder="100"
            />
            <Input
              label="Expiry Date"
              type="date"
              value={formData.expiry}
              onChange={e => setFormData({ ...formData, expiry: e.target.value })}
            />
            <Input
              label="Usage Limit"
              type="number"
              value={formData.usageLimit}
              onChange={e => setFormData({ ...formData, usageLimit: e.target.value })}
              placeholder="500"
            />
            <Select
              label="Status"
              value={formData.status}
              onChange={e => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
          <div className="flex gap-3 justify-end mt-5 pt-4 border-t border-gray-100">
            <Button variant="secondary" type="button" onClick={() => { setShowAdd(false); setEditItem(null) }}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> Saving...
                </span>
              ) : (
                editItem ? 'Save Changes' : 'Create Coupon'
              )}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Coupon"
        message={`Delete coupon "${deleteTarget?.code}"?`}
        variant="danger"
      />
    </div>
  )
}