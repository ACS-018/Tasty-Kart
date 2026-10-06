import { useState, useEffect } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Edit, Trash2, Plus, AlertTriangle, Loader2 } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import type { Addon } from '@/data/dummy'
import {
  subscribeToCollection,
  addDocumentToFirestore,
  updateDocumentInFirestore,
  deleteDocumentFromFirestore,
  deleteDuplicateAddons,
} from '@/lib/firebaseService'

export function Addons() {
  const [addonsList, setAddonsList] = useState<Addon[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState<Addon | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Addon | null>(null)
  const [saving, setSaving] = useState(false)
  const [isCleaning, setIsCleaning] = useState(false)
  const [showCleanConfirm, setShowCleanConfirm] = useState(false)
  const { success, error: toastError } = useToast()

  const [formData, setFormData] = useState({
    name: '',
    price: '',
    category: 'Extras',
    description: '',
    status: 'active' as 'active' | 'inactive',
  })

  useEffect(() => {
    const unsub = subscribeToCollection<Addon>('addons', (data) => {
      // Sort by name alphabetically
      const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name))
      setAddonsList(sorted)
    })
    return () => unsub()
  }, [])

  const openAdd = () => {
    setEditItem(null)
    setFormData({ name: '', price: '', category: 'Extras', description: '', status: 'active' })
    setShowAdd(true)
  }

  const openEdit = (addon: Addon) => {
    setEditItem(addon)
    setFormData({
      name: addon.name || '',
      price: String(addon.price || ''),
      category: addon.category || 'Extras',
      description: addon.description || '',
      status: addon.status || 'active',
    })
    setShowAdd(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) { toastError('Validation', 'Add-on name is required'); return }
    if (!formData.price || parseFloat(formData.price) <= 0) { toastError('Validation', 'Price must be greater than 0'); return }

    const nextName = formData.name.trim()
    const nextPrice = parseFloat(formData.price)

    // Check for duplicates
    const duplicate = addonsList.find(addon =>
      addon.name.toLowerCase() === nextName.toLowerCase() &&
      addon.id !== editItem?.id
    )
    if (duplicate) {
      toastError('Already exists', `"${nextName}" already exists in the add-ons list`)
      return
    }

    setSaving(true)
    try {
      if (editItem) {
        const res = await updateDocumentInFirestore('addons', editItem.id, {
          name: nextName,
          price: nextPrice,
          category: formData.category,
          description: formData.description,
          status: formData.status,
        })
        if (res.success) {
          success('Add-on Updated', `"${nextName}" updated successfully`)
          setShowAdd(false)
        } else {
          toastError('Update Failed', String(res.error))
        }
      } else {
        const id = `addon_${Date.now()}`
        const res = await addDocumentToFirestore('addons', {
          id,
          name: nextName,
          price: nextPrice,
          category: formData.category,
          description: formData.description,
          status: formData.status,
          createdAt: new Date().toISOString(),
        })
        if (res.success) {
          success('Add-on Created', `"${nextName}" added successfully`)
          setShowAdd(false)
        } else {
          toastError('Create Failed', String(res.error))
        }
      }
    } catch (err) {
      toastError('Error', String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const res = await deleteDocumentFromFirestore('addons', deleteTarget.id)
    if (res.success) {
      success('Deleted', `"${deleteTarget.name}" removed successfully`)
    } else {
      toastError('Delete Failed', String(res.error))
    }
    setDeleteTarget(null)
  }

  const handleCleanupDuplicates = async () => {
    setIsCleaning(true)
    setShowCleanConfirm(false)
    try {
      const result = await deleteDuplicateAddons()
      success(
        'Duplicates Removed',
        result.deleted > 0
          ? `${result.deleted} duplicate add-on(s) deleted`
          : 'No duplicates found — already clean'
      )
    } catch (err: unknown) {
      toastError('Error', String(err))
    } finally {
      setIsCleaning(false)
    }
  }

  const setField = (key: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const columns: ColumnDef<Addon, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'Add-on Name',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center text-lg">➕</div>
          <span className="text-sm font-semibold text-gray-900">{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: 'price',
      header: 'Price',
      cell: ({ row }) => <span className="text-sm font-semibold">{formatCurrency(row.original.price || 0)}</span>,
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add-ons</h1>
          <p className="text-sm text-gray-500 mt-1">Manage add-ons catalog</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={isCleaning ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
            onClick={() => setShowCleanConfirm(true)}
            disabled={isCleaning}
          >
            {isCleaning ? 'Removing…' : 'Remove Duplicates'}
          </Button>
          <Button size="sm" icon={<Plus size={14} />} onClick={openAdd}>Add Add-on</Button>
        </div>
      </div>
      
      <DataTable data={addonsList} columns={columns} searchPlaceholder="Search add-ons..." />

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={editItem ? 'Edit Add-on' : 'Add New Add-on'} size="sm">
        <div className="space-y-4">
          <Input
            label="Add-on Name *"
            placeholder="e.g. Extra Cheese"
            value={formData.name}
            onChange={e => setField('name', e.target.value)}
          />
          <Input
            label="Price (₹) *"
            type="number"
            min={1}
            placeholder="30"
            value={formData.price}
            onChange={e => setField('price', e.target.value)}
          />
          <Input
            label="Description"
            placeholder="Optional description"
            value={formData.description}
            onChange={e => setField('description', e.target.value)}
          />
          <Select
            label="Status"
            value={formData.status}
            onChange={e => setField('status', e.target.value)}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <Button variant="secondary" onClick={() => setShowAdd(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} icon={editItem ? <Edit size={14} /> : <Plus size={14} />}>
              {saving ? 'Saving...' : editItem ? 'Save Changes' : 'Add Add-on'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog 
        open={!!deleteTarget} 
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Add-on"
        message={`Permanently delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />

      <ConfirmDialog
        open={showCleanConfirm}
        onClose={() => setShowCleanConfirm(false)}
        onConfirm={handleCleanupDuplicates}
        title="Remove Duplicate Add-ons"
        message="This will permanently delete duplicate add-ons with the same name (case-insensitive). Only the first occurrence will be kept. This cannot be undone."
        confirmLabel="Yes, Remove Duplicates"
        variant="danger"
      />
    </div>
  )
}
