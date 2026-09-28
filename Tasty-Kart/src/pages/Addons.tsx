import { useState, useEffect, useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Edit, Trash2, Plus, Eye, Store } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal, ConfirmDialog, Drawer } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import type { Addon, Restaurant } from '@/data/dummy'
import {
  subscribeToCollection,
  addDocumentToFirestore,
  updateDocumentInFirestore,
  deleteDocumentFromFirestore,
  deleteDuplicateAddons,
  addonCatalogKey,
} from '@/lib/firebaseService'

type AddonGroup = {
  key: string
  name: string
  price: number
  status: 'active' | 'inactive'
  category: string
  description: string
  foodItemId: string | null
  docs: Addon[]
  restaurantNames: string[]
}

export function Addons() {
  const [addonsList, setAddonsList] = useState<Addon[]>([])
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState<AddonGroup | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AddonGroup | null>(null)
  const [viewAddon, setViewAddon] = useState<AddonGroup | null>(null)
  const [saving, setSaving] = useState(false)
  const { success, error: toastError } = useToast()

  const [formData, setFormData] = useState({
    name: '',
    price: '',
    restaurantId: '',
    status: 'active' as 'active' | 'inactive',
  })

  useEffect(() => {
    const unsubs = [
      subscribeToCollection<Addon>('addons', setAddonsList),
      subscribeToCollection<Restaurant>('restaurants', setRestaurants),
    ]
    deleteDuplicateAddons().catch(() => {})
    return () => unsubs.forEach(fn => fn())
  }, [])

  const liveRestaurantIds = useMemo(() => new Set(restaurants.map(restaurant => restaurant.id)), [restaurants])

  const catalog = useMemo(() => {
    const liveNames = new Set(restaurants.map(restaurant => restaurant.name.trim().toLowerCase()))
    return addonsList
      .filter(addon => {
        if (addon.restaurantId && liveRestaurantIds.has(addon.restaurantId)) return true
        const name = (addon.restaurantName || '').trim().toLowerCase()
        return name.length > 0 && liveNames.has(name)
      })
      .map(addon => {
        const live = restaurants.find(restaurant => restaurant.id === addon.restaurantId)
        const restaurantName = live?.name || addon.restaurantName || ''
        return {
          key: addon.id,
          name: addon.name,
          price: Number(addon.price) || 0,
          status: addon.status === 'inactive' ? 'inactive' as const : 'active' as const,
          category: addon.category || 'General',
          description: addon.description || '',
          foodItemId: addon.foodItemId ?? null,
          docs: [addon],
          restaurantNames: restaurantName ? [restaurantName] : [],
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name) || (a.restaurantNames[0] || '').localeCompare(b.restaurantNames[0] || ''))
  }, [addonsList, restaurants, liveRestaurantIds])

  const servingRestaurants = (group: AddonGroup) => {
    const key = addonCatalogKey({ name: group.name, price: group.price })
    const seen = new Set<string>()
    return catalog.flatMap(row => {
      if (addonCatalogKey({ name: row.name, price: row.price }) !== key) return []
      const doc = row.docs[0]
      if (!doc?.restaurantId || seen.has(doc.restaurantId)) return []
      seen.add(doc.restaurantId)
      const live = restaurants.find(restaurant => restaurant.id === doc.restaurantId)
      return [{
        id: doc.restaurantId,
        name: live?.name || row.restaurantNames[0] || 'Restaurant',
        cuisine: live?.cuisine || '',
        city: live?.city || '',
        logo: live?.logo,
        status: live?.status || 'active',
      }]
    })
  }

  const openAdd = () => {
    setEditItem(null)
    setFormData({ name: '', price: '', restaurantId: restaurants[0]?.id || '', status: 'active' })
    setShowAdd(true)
  }

  const openEdit = (addon: AddonGroup) => {
    setEditItem(addon)
    setFormData({
      name: addon.name || '',
      price: String(addon.price || ''),
      restaurantId: addon.docs[0]?.restaurantId || '',
      status: addon.status || 'active',
    })
    setShowAdd(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) { toastError('Validation', 'Add-on name is required'); return }
    if (!formData.price || parseFloat(formData.price) <= 0) { toastError('Validation', 'Price must be greater than 0'); return }
    if (!formData.restaurantId) { toastError('Validation', 'Select a restaurant'); return }

    const restaurant = restaurants.find(r => r.id === formData.restaurantId)
    if (!editItem && !restaurant) { toastError('Validation', 'Select a valid restaurant'); return }

    const nextName = formData.name.trim()
    const nextPrice = parseFloat(formData.price)
    const already = addonsList.find(addon =>
      addon.restaurantId === (editItem?.docs[0]?.restaurantId || formData.restaurantId) &&
      addonCatalogKey(addon) === addonCatalogKey({ name: nextName, price: nextPrice }) &&
      addon.id !== editItem?.docs[0]?.id
    )
    if (already) {
      toastError('Already exists', `"${nextName}" at this price is already in the add-on list`)
      return
    }

    setSaving(true)
    try {
      if (editItem) {
        const results = await Promise.all(editItem.docs.map(doc => updateDocumentInFirestore('addons', doc.id, {
          name: nextName,
          price: nextPrice,
          status: formData.status,
          category: editItem.category || 'General',
          description: editItem.description || '',
        })))
        if (results.every(res => res.success)) {
          success('Add-on Updated', `"${nextName}" updated`)
          setShowAdd(false)
        } else {
          toastError('Update Failed', 'Could not update every copy of this add-on')
        }
      } else {
        const id = `add_${restaurant!.id}_${Date.now()}`
        const res = await addDocumentToFirestore('addons', {
          id,
          name: nextName,
          price: nextPrice,
          restaurantId: restaurant!.id,
          restaurantName: restaurant!.name,
          foodItemId: null,
          category: 'General',
          status: formData.status,
          description: '',
        })
        if (res.success) {
          success('Add-on Created', `"${nextName}" added for ${restaurant!.name}`)
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
    const results = await Promise.all(
      deleteTarget.docs.map(doc => deleteDocumentFromFirestore('addons', doc.id)),
    )
    if (results.every(res => res.success)) {
      success('Deleted', `"${deleteTarget.name}" removed`)
    } else {
      toastError('Delete Failed', 'Could not remove every copy of this add-on')
    }
    setDeleteTarget(null)
  }

  const setField = (key: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const columns: ColumnDef<AddonGroup, unknown>[] = [
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
      id: 'restaurants',
      header: 'Restaurants',
      accessorFn: (row) => servingRestaurants(row).length,
      cell: ({ row }) => {
        const count = servingRestaurants(row.original).length
        return (
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${count > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
              {count}
            </span>
            {count > 0 && (
              <button
                type="button"
                onClick={() => setViewAddon(row.original)}
                className="flex items-center gap-1 text-xs font-semibold text-[#B32B2C] hover:text-[#8B1F20] transition-colors"
              >
                <Eye size={13} /> View All
              </button>
            )}
          </div>
        )
      },
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
      <div className="flex items-center justify-end gap-2 flex-wrap">
        <Button size="sm" icon={<Plus size={14} />} onClick={openAdd}>Add Add-on</Button>
      </div>
      <DataTable data={catalog} columns={columns} searchPlaceholder="Search add-ons..." />

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
          <Select
            label="Restaurant *"
            value={formData.restaurantId}
            onChange={e => setField('restaurantId', e.target.value)}
            disabled={!!editItem && editItem.docs.length > 1}
          >
            <option value="">Select restaurant</option>
            {restaurants.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </Select>
          {editItem && editItem.restaurantNames.length > 1 && (
            <p className="text-xs text-gray-500 -mt-2">
              This add-on is on {editItem.restaurantNames.length} restaurants. Saving updates the name, price, and status on all of them.
            </p>
          )}
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

      <Drawer
        open={!!viewAddon}
        onClose={() => setViewAddon(null)}
        title={viewAddon ? `${viewAddon.name} — Restaurants` : ''}
        width="w-[480px]"
      >
        {viewAddon && (() => {
          const serving = servingRestaurants(viewAddon)
          return (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">{serving.length} restaurant{serving.length === 1 ? '' : 's'} serving this add-on</p>
              {serving.map(restaurant => (
                <div key={restaurant.id} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                    {restaurant.logo ? (
                      <img src={restaurant.logo} alt={restaurant.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-red-50">
                        <Store size={24} className="text-[#B32B2C]" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{restaurant.name}</p>
                    <p className="text-xs text-gray-500 truncate">{restaurant.cuisine || 'Multi-Cuisine'}</p>
                    <div className="flex items-center gap-3 mt-1">
                      {restaurant.city && <span className="text-xs text-gray-400">{restaurant.city}</span>}
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        restaurant.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {restaurant.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        })()}
      </Drawer>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Add-on"
        message={
          deleteTarget && deleteTarget.docs.length > 1
            ? `Permanently delete "${deleteTarget.name}" from ${deleteTarget.docs.length} restaurants? This cannot be undone.`
            : `Permanently delete "${deleteTarget?.name}"? This cannot be undone.`
        }
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  )
}
