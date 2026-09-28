import { useState, useEffect, useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Edit, Trash2, Plus, GripVertical, Upload, Loader2, Store, Eye, X } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal, ConfirmDialog, Drawer } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import {
  subscribeToCollection,
  addDocumentToFirestore,
  deleteDocumentFromFirestore,
  uploadImageToStorage,
} from '@/lib/firebaseService'
import type { Restaurant } from '@/data/dummy'

type Category = Record<string, any> & { id: string; name: string; icon?: string }

function sortOrderOf(category: Category) {
  const order = Number(category.sortOrder)
  return Number.isFinite(order) && order > 0 ? order : Number.MAX_SAFE_INTEGER
}

export function RestaurantCategories() {
  const [categoriesList, setCategoriesList] = useState<Category[]>([])
  const [restaurantsList, setRestaurantsList] = useState<Restaurant[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState<Category | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [viewCategory, setViewCategory] = useState<Category | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { success, error: toastError } = useToast()

  const [formData, setFormData] = useState({
    name: '',
    icon: '🍔',
    description: '',
    sortOrder: '1',
    status: 'active' as 'active' | 'inactive',
  })
  const [imageFile, setImageFile] = useState<File | null>(null)

  useEffect(() => {
    const unsubCats = subscribeToCollection<Category>(
      'restaurantCategories',
      setCategoriesList,
    )
    const unsubRests = subscribeToCollection<Restaurant>(
      'restaurants',
      setRestaurantsList,
    )
    return () => { unsubCats(); unsubRests() }
  }, [])

  const sortedCategories = useMemo(() => {
    return [...categoriesList].sort((a, b) => {
      const byOrder = sortOrderOf(a) - sortOrderOf(b)
      if (byOrder !== 0) return byOrder
      return String(a.name || '').localeCompare(String(b.name || ''))
    })
  }, [categoriesList])

  /** Restaurants whose `categories` array contains this category's Firestore doc ID. */
  const restaurantsFor = (catId: string) =>
    restaurantsList.filter(
      r => Array.isArray((r as any).categories) && (r as any).categories.includes(catId),
    )

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    setIsSubmitting(true)
    try {
      let imageUrl = (editItem as any)?.image || ''
      if (imageFile) {
        imageUrl = await uploadImageToStorage(imageFile, 'restaurantCategories')
      }

      const categoryData = {
        id: editItem?.id || `rcat_${Date.now()}`,
        name: formData.name,
        icon: formData.icon || '🍔',
        image:
          imageUrl ||
          'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=300',
        description:
          formData.description || `${formData.name} kitchen category`,
        restaurantCount: (editItem as any)?.restaurantCount || 0,
        sortOrder: Number(formData.sortOrder) || 1,
        status: formData.status,
      }

      const res = await addDocumentToFirestore('restaurantCategories', categoryData)
      setIsSubmitting(false)

      if (res.success) {
        success('Category Saved!', `"${formData.name}" synced`)
        setShowAdd(false)
        setEditItem(null)
        resetForm()
      } else {
        toastError('Save Error', 'Could not save category')
      }
    } catch (err: any) {
      setIsSubmitting(false)
      toastError('Save Error', err?.message || 'Failed to save')
    }
  }

  const resetForm = () => {
    setFormData({ name: '', icon: '🍔', description: '', sortOrder: '1', status: 'active' })
    setImageFile(null)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    const res = await deleteDocumentFromFirestore('restaurantCategories', deleteTarget.id)
    if (res.success) success('Category Deleted', `"${deleteTarget.name}" removed`)
    setDeleteTarget(null)
  }

  const columns: ColumnDef<Category, unknown>[] = [
    {
      id: 'drag',
      header: '',
      enableSorting: false,
      size: 40,
      cell: () => <GripVertical size={16} className="text-gray-300 cursor-grab" />,
    },
    {
      id: 'category',
      header: 'Category',
      enableSorting: false,
      accessorFn: (row) => `${row.name ?? ''} ${row.description ?? ''}`.trim(),
      cell: ({ row: { original: c } }) => {
        const catImg = (c as any).image
        return (
          <div className="flex items-center gap-3">
            {catImg ? (
              <img src={catImg} alt={c.name}
                className="w-10 h-10 rounded-xl object-cover bg-gray-100 shrink-0 border border-gray-200 shadow-sm" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-xl shrink-0">
                {c.icon || '🍛'}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-gray-900">{c.name}</p>
              <p className="text-xs text-gray-400 max-w-[200px] truncate">{c.description}</p>
            </div>
          </div>
        )
      },
    },
    {
      id: 'count_view',
      header: 'Assigned Restaurants',
      enableSorting: false,
      cell: ({ row: { original: c } }) => {
        const count = restaurantsFor(c.id).length
        return (
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${count > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
              {count}
            </span>
            {count > 0 && (
              <button
                onClick={() => setViewCategory(c)}
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
      id: 'sortOrder',
      header: 'Order',
      enableSorting: false,
      accessorFn: (row) => sortOrderOf(row) === Number.MAX_SAFE_INTEGER ? 0 : sortOrderOf(row),
      cell: ({ getValue }) => (
        <span className="text-sm font-semibold text-gray-900">{Number(getValue()) || '—'}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      enableSorting: false,
      cell: ({ row }) => <StatusBadge status={(row.original as any).status || 'active'} />,
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setEditItem(row.original)
              setFormData({
                name: row.original.name,
                icon: row.original.icon || '🍔',
                description: (row.original as any).description || '',
                sortOrder: String((row.original as any).sortOrder || '1'),
                status: (row.original as any).status || 'active',
              })
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
          >
            <Edit size={15} />
          </button>
          <button
            onClick={() => setDeleteTarget(row.original)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ]

  const viewRestaurants = viewCategory ? restaurantsFor(viewCategory.id) : []

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end gap-2 flex-wrap">
        <Button
          size="sm"
          icon={<Plus size={14} />}
          onClick={() => { resetForm(); setEditItem(null); setShowAdd(true) }}
        >
          Add Category
        </Button>
      </div>

      <DataTable data={sortedCategories} columns={columns} searchPlaceholder="Search categories..." />

      {/* ── Add / Edit Modal ─────────────────────────────────────────── */}
      <Modal
        open={showAdd || !!editItem}
        onClose={() => { setShowAdd(false); setEditItem(null) }}
        title={editItem ? 'Edit Category' : 'Add Category'}
        size="sm"
      >
        <form onSubmit={handleSaveSubmit} className="space-y-4">
          <Input label="Category Name *" value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Fast Food" required />
          <Input label="Icon (Emoji)" value={formData.icon}
            onChange={e => setFormData({ ...formData, icon: e.target.value })}
            placeholder="🍔" />
          <Input label="Description" value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            placeholder="Short description" />
          <Input label="Sort Order" type="number" value={formData.sortOrder}
            onChange={e => setFormData({ ...formData, sortOrder: e.target.value })}
            placeholder="1" />
          <Select label="Status" value={formData.status}
            onChange={e => setFormData({ ...formData, status: e.target.value as any })}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Category Image (Firebase Storage)
            </label>
            <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-gray-300 bg-gray-50">
              <Upload size={18} className="text-[#B32B2C]" />
              <input type="file" accept="image/*"
                onChange={e => setImageFile(e.target.files?.[0] || null)}
                className="text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#B32B2C] file:text-white cursor-pointer" />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <Button variant="secondary" type="button"
              onClick={() => { setShowAdd(false); setEditItem(null) }}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Saving...</span>
                : editItem ? 'Save Changes' : 'Add Category'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── View All Restaurants Drawer ───────────────────────────────── */}
      <Drawer
        open={!!viewCategory}
        onClose={() => setViewCategory(null)}
        title={viewCategory ? `${viewCategory.name} — Restaurants (${viewRestaurants.length})` : ''}
        width="w-[480px]"
      >
        {viewCategory && (
          <div className="space-y-3">
            {viewRestaurants.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Store size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No restaurants assigned to this category</p>
              </div>
            ) : (
              viewRestaurants.map(r => (
                <div key={r.id}
                  className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                  {/* Restaurant image */}
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                    {(r as any).cover || (r as any).logo ? (
                      <img
                        src={(r as any).cover || (r as any).logo}
                        alt={r.name}
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-red-50">
                        <Store size={24} className="text-[#B32B2C]" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{r.name}</p>
                    <p className="text-xs text-gray-500 truncate">{r.cuisine || 'Multi-Cuisine'}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-400">{r.city}</span>
                      <span className="text-xs text-amber-500">⭐ {r.rating || 'New'}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        r.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {r.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Category"
        message={`Delete "${deleteTarget?.name}"? This will not remove the restaurants from Firestore.`}
        variant="danger"
      />
    </div>
  )
}
