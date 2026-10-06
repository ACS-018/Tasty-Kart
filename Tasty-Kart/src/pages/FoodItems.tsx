import { useState, useEffect } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Edit, Trash2, Plus, Eye, Leaf, Flame, Star, Upload, Loader2, Package } from 'lucide-react'
import { motion } from 'framer-motion'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal, Drawer, ConfirmDialog } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Input'

import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'
import type { FoodCategory, FoodItem, Restaurant } from '@/data/dummy'
import {
  subscribeToCollection,
  addDocumentToFirestore,
  updateDocumentInFirestore,
  deleteDocumentFromFirestore,
  uploadImageToStorage
} from '@/lib/firebaseService'
import { normalizeFoodItemVegFields } from '@/lib/foodItemUtils'
import type { FoodType } from '@/lib/foodItemUtils'
import { VegNonVegPicker, VegNonVegBadge } from '@/components/shared/VegNonVegPicker'

const colorMap = {
  red:    { bg: 'bg-red-50', icon: 'text-red-600' },
  green:  { bg: 'bg-green-50', icon: 'text-green-600' },
  blue:   { bg: 'bg-blue-50', icon: 'text-blue-600' },
  amber:  { bg: 'bg-amber-50', icon: 'text-amber-600' },
}

export function FoodItems() {
  const [itemsList, setItemsList] = useState<FoodItem[]>([])
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [categories, setCategories] = useState<FoodCategory[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState<FoodItem | null>(null)
  const [selected, setSelected] = useState<FoodItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FoodItem | null>(null)
  const [view, setView] = useState<'table' | 'grid'>('table')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { success, error: toastError } = useToast()

  const [formData, setFormData] = useState<{
    name: string
    restaurantId: string
    categoryId: string
    price: string
    discountedPrice: string
    preparationTime: string
    foodType: FoodType
    status: 'active' | 'inactive'
    description: string
    ingredients: string
  }>({
    name: '',
    restaurantId: '',
    categoryId: '',
    price: '280',
    discountedPrice: '240',
    preparationTime: '25',
    foodType: 'veg',
    status: 'active',
    description: '',
    ingredients: ''
  })
  const [imageFile, setImageFile] = useState<File | null>(null)

  // Quick stats
  const stats = [
    { label: 'Total Items', value: itemsList.length, icon: Package, color: 'blue' as const },
    { label: 'Active', value: itemsList.filter(i => i.status === 'active').length, icon: Star, color: 'green' as const },
    { label: 'Avg Price', value: formatCurrency(itemsList.reduce((s, i) => s + (i.discountedPrice || i.price || 0), 0) / (itemsList.length || 1)), icon: Star, color: 'amber' as const },
  ]

  const categoriesForRestaurant = categories.filter(c => c.restaurantId === formData.restaurantId)

  useEffect(() => {
    const unsubs = [
      subscribeToCollection<FoodItem>('foodItems', setItemsList),
      subscribeToCollection<Restaurant>('restaurants', setRestaurants),
      subscribeToCollection<FoodCategory>('foodCategories', setCategories),
    ]
    return () => unsubs.forEach(fn => fn())
  }, [])

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.restaurantId || !formData.categoryId) {
      toastError('Validation', 'Name, restaurant, and category are required')
      return
    }

    const restaurant = restaurants.find(r => r.id === formData.restaurantId)
    const category = categories.find(c => c.id === formData.categoryId)
    if (!restaurant || !category) {
      toastError('Validation', 'Select a valid restaurant and category')
      return
    }

    setIsSubmitting(true)
    try {
      let imageUrl = ''
      if (imageFile) {
        imageUrl = await uploadImageToStorage(imageFile, 'foodItems')
      }

      const vegFields = normalizeFoodItemVegFields({
        foodType: formData.foodType,
        isVeg: formData.foodType === 'veg',
        tags: [formData.foodType, category.name.toLowerCase()],
      })

      const newItem: FoodItem = {
        id: `food_${Date.now()}`,
        name: formData.name,
        image: imageUrl,
        imageUrl,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        categoryId: category.id,
        categoryName: category.name,
        price: Number(formData.price) || 200,
        discountedPrice: Number(formData.discountedPrice) || Number(formData.price) || 200,
        preparationTime: Number(formData.preparationTime) || 20,
        ...vegFields,
        status: formData.status,
        description: formData.description || `Fresh & delicious ${formData.name}`,
        ingredients: formData.ingredients || 'Fresh ingredients',
        rating: 0,
        totalRatings: 0,
        available: true,
        inStock: true,
      }

      const res = await addDocumentToFirestore('foodItems', newItem)
      setIsSubmitting(false)

      if (res.success) {
        success('Food Item Saved!', `"${formData.name}" stored under ${restaurant.name} → ${category.name}`)
        setShowAdd(false)
        setFormData({
          name: '', restaurantId: restaurants[0]?.id || '', categoryId: '',
          price: '280', discountedPrice: '240', preparationTime: '25',
          foodType: 'veg', status: 'active', description: '', ingredients: ''
        })
        setImageFile(null)
      } else {
        toastError('Failed to Save', 'Could not save food item to Firestore')
      }
    } catch (err: any) {
      setIsSubmitting(false)
      toastError('Save Error', err?.message || 'Failed to save')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    const res = await deleteDocumentFromFirestore('foodItems', deleteTarget.id)
    if (res.success) {
      success('Food Item Deleted', `"${deleteTarget.name}" removed from Firestore`)
    }
    setDeleteTarget(null)
  }

  const openEdit = (item: FoodItem) => {
    setFormData({
      name: item.name,
      restaurantId: item.restaurantId,
      categoryId: item.categoryId,
      price: String(item.price),
      discountedPrice: String(item.discountedPrice ?? item.price),
      preparationTime: String(item.preparationTime ?? 25),
      foodType: (item.foodType as FoodType) || (item.isVeg ? 'veg' : 'nonveg'),
      status: item.status,
      description: item.description || '',
      ingredients: item.ingredients || '',
    })
    setEditItem(item)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editItem) return
    setIsSubmitting(true)
    try {
      let imageUrl = editItem.image || (editItem as any).imageUrl || ''
      if (imageFile) imageUrl = await uploadImageToStorage(imageFile, 'foodItems')

      const category = categories.find(c => c.id === formData.categoryId)
      const restaurant = restaurants.find(r => r.id === formData.restaurantId)
      const vegFields = normalizeFoodItemVegFields({
        foodType: formData.foodType,
        isVeg: formData.foodType === 'veg',
        tags: [formData.foodType, category?.name.toLowerCase() ?? ''],
      })

      const updated = {
        name: formData.name,
        image: imageUrl,
        imageUrl,
        restaurantId: formData.restaurantId,
        restaurantName: restaurant?.name ?? editItem.restaurantName,
        categoryId: formData.categoryId,
        categoryName: category?.name ?? editItem.categoryName,
        price: Number(formData.price) || 200,
        discountedPrice: Number(formData.discountedPrice) || Number(formData.price) || 200,
        preparationTime: Number(formData.preparationTime) || 20,
        ...vegFields,
        status: formData.status,
        description: formData.description,
        ingredients: formData.ingredients,
      }

      const res = await updateDocumentInFirestore('foodItems', editItem.id, updated)
      setIsSubmitting(false)
      if (res.success) {
        success('Food Item Updated!', `"${formData.name}" saved`)
        setEditItem(null)
        setImageFile(null)
      } else {
        toastError('Update Failed', 'Could not update food item')
      }
    } catch (err: any) {
      setIsSubmitting(false)
      toastError('Update Error', err?.message || 'Failed to update')
    }
  }

  const columns: ColumnDef<FoodItem, unknown>[] = [
    {
      id: 'item',
      accessorFn: (row) => `${row.name ?? ''} ${row.restaurantName ?? ''}`.trim(),
      header: 'Food Item',
      cell: ({ row: { original: f } }) => {
        const itemImg = f.image || (f as any).imageUrl || (f.isVeg
          ? 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=200'
          : 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=200')

        return (
          <div className="flex items-center gap-3">
            <img src={itemImg} alt={f.name} className="w-11 h-11 rounded-xl object-cover bg-gray-100 shrink-0 border border-gray-200 shadow-sm" />
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-gray-900">{f.name}</p>
                {f.isVeg
                  ? <Leaf size={12} className="text-green-500" />
                  : <Flame size={12} className="text-red-500" />}
              </div>
              <p className="text-xs text-gray-400">{f.restaurantName}</p>
            </div>
          </div>
        )
      },
    },
    {
      id: 'foodType',
      header: 'Type',
      cell: ({ row }) => <VegNonVegBadge foodType={row.original.foodType} isVeg={row.original.isVeg} />,
    },
    {
      accessorKey: 'categoryName',
      header: 'Category',
      cell: ({ row }) => <span className="text-xs bg-gray-100 px-2 py-1 rounded-md">{row.original.categoryName}</span>,
    },
    {
      id: 'price',
      header: 'Price',
      cell: ({ row: { original: f } }) => (
        <div>
          <p className="text-sm font-semibold text-gray-900">{formatCurrency(f.discountedPrice ?? f.price)}</p>
          {f.discountedPrice != null && f.price !== f.discountedPrice && (
            <p className="text-xs text-gray-400 line-through">{formatCurrency(f.price)}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button onClick={e => { e.stopPropagation(); setSelected(row.original) }} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Eye size={15} /></button>
          <button onClick={e => { e.stopPropagation(); openEdit(row.original) }} className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"><Edit size={15} /></button>
          <button onClick={e => { e.stopPropagation(); setDeleteTarget(row.original) }} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={15} /></button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6 pb-8">

      <div className="flex items-center justify-end gap-2 flex-wrap">
        <Button size="sm" icon={<Plus size={14} />} onClick={() => {
          setFormData(f => ({ ...f, restaurantId: restaurants[0]?.id || '', categoryId: '' }))
          setShowAdd(true)
        }}>Add Food Item</Button>
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

      {/* View Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {(['table', 'grid'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${view === v ? 'bg-[#B32B2C] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === 'table' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <DataTable data={itemsList} columns={columns} searchPlaceholder="Search food items..." onRowClick={setSelected} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {itemsList.map((f, i) => {
            const cardImg = f.image || (f as any).imageUrl || (f.isVeg
              ? 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=300'
              : 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=300')

            return (
              <motion.div key={f.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                onClick={() => setSelected(f)}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all cursor-pointer overflow-hidden flex flex-col justify-between">
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <img src={cardImg} alt={f.name} className="w-14 h-14 rounded-2xl object-cover bg-gray-100 shrink-0 border border-gray-200 shadow-sm" />
                    <StatusBadge status={f.status} />
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-semibold text-gray-900 text-sm truncate">{f.name}</h3>
                      {f.isVeg ? <Leaf size={12} className="text-green-500 shrink-0" /> : <Flame size={12} className="text-red-500 shrink-0" />}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{f.restaurantName} · {f.categoryName}</p>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      <Drawer open={!!selected} onClose={() => setSelected(null)} title="Food Item Details" width="w-[520px]">
        {selected && (
          <div className="space-y-5">
            <div className="h-44 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl flex items-center justify-center relative overflow-hidden">
              <img
                src={selected.image || (selected as any).imageUrl || (selected.isVeg
                  ? 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600'
                  : 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=600')}
                alt={selected.name}
                className="w-full h-full object-cover rounded-xl"
              />
              <div className="absolute top-3 right-3"><StatusBadge status={selected.status} /></div>
            </div>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selected.name}</h2>
                <p className="text-sm text-gray-500">{selected.restaurantName} · {selected.categoryName}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-gray-900">{formatCurrency(selected.discountedPrice ?? selected.price)}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600">{selected.description}</p>
            {selected.ingredients && (
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Ingredients</h4>
                <p className="text-sm text-gray-600">{selected.ingredients}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              <VegNonVegBadge foodType={selected.foodType} isVeg={selected.isVeg} />
              {(selected.tags || []).filter(t => t !== 'veg' && t !== 'nonveg').map((tag: string) => (
                <span key={tag} className="text-xs bg-red-50 text-[#B32B2C] px-2.5 py-1 rounded-full font-medium capitalize">{tag}</span>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => { setDeleteTarget(selected); setSelected(null) }}>Delete</Button>
            </div>
          </div>
        )}
      </Drawer>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Food Item" size="lg">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Item Name *" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Butter Chicken" required />
            <Select
              label="Restaurant *"
              value={formData.restaurantId}
              onChange={e => setFormData({ ...formData, restaurantId: e.target.value, categoryId: '' })}
              required
            >
              <option value="">Select restaurant</option>
              {restaurants.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </Select>
            <Select
              label="Category *"
              value={formData.categoryId}
              onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
              required
            >
              <option value="">Select category</option>
              {categoriesForRestaurant.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </Select>
            <Input label="Price (₹)" type="number" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} placeholder="280" />
            <Input label="Discounted Price (₹)" type="number" value={formData.discountedPrice} onChange={e => setFormData({ ...formData, discountedPrice: e.target.value })} placeholder="240" />
            <Input label="Preparation Time (min)" type="number" value={formData.preparationTime} onChange={e => setFormData({ ...formData, preparationTime: e.target.value })} placeholder="25" />
            <div className="sm:col-span-2">
              <VegNonVegPicker
                value={formData.foodType}
                onChange={foodType => setFormData({ ...formData, foodType })}
                required
              />
            </div>
            <Select label="Status" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
            <div className="sm:col-span-2">
              <Textarea label="Description" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Describe the dish..." rows={3} />
            </div>
            <div className="sm:col-span-2">
              <Input label="Ingredients" value={formData.ingredients} onChange={e => setFormData({ ...formData, ingredients: e.target.value })} placeholder="Comma separated ingredients" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Upload Dish Image (Firebase Storage)</label>
              <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-gray-300 bg-gray-50">
                <Upload size={20} className="text-[#B32B2C]" />
                <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} className="text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#B32B2C] file:text-white hover:file:bg-red-700 cursor-pointer" />
              </div>
            </div>
          </div>
          <div className="flex gap-3 justify-end mt-5 pt-4 border-t border-gray-100">
            <Button variant="secondary" type="button" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <span className="flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Saving...</span> : 'Save Item to Firestore'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Food Item"
        message={`Are you sure you want to delete "${deleteTarget?.name}"?`}
        confirmLabel="Delete Document"
        variant="danger"
      />

      {/* ── Edit Food Item Modal ─────────────────────────────────────── */}
      <Modal open={!!editItem} onClose={() => { setEditItem(null); setImageFile(null) }} title="Edit Food Item" size="lg">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Item Name *" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Butter Chicken" required />
            <Select label="Restaurant *" value={formData.restaurantId}
              onChange={e => setFormData({ ...formData, restaurantId: e.target.value, categoryId: '' })} required>
              <option value="">Select restaurant</option>
              {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
            <Select label="Category *" value={formData.categoryId}
              onChange={e => setFormData({ ...formData, categoryId: e.target.value })} required>
              <option value="">Select category</option>
              {categories.filter(c => c.restaurantId === formData.restaurantId).map(c =>
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              )}
            </Select>
            <Input label="Price (₹)" type="number" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
            <Input label="Discounted Price (₹)" type="number" value={formData.discountedPrice} onChange={e => setFormData({ ...formData, discountedPrice: e.target.value })} />
            <Input label="Preparation Time (min)" type="number" value={formData.preparationTime} onChange={e => setFormData({ ...formData, preparationTime: e.target.value })} />
            <div className="sm:col-span-2">
              <VegNonVegPicker value={formData.foodType} onChange={foodType => setFormData({ ...formData, foodType })} required />
            </div>
            <Select label="Status" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
            <div className="sm:col-span-2">
              <Textarea label="Description" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} />
            </div>
            <div className="sm:col-span-2">
              <Input label="Ingredients" value={formData.ingredients} onChange={e => setFormData({ ...formData, ingredients: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Replace Image (optional)</label>
              <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-gray-300 bg-gray-50">
                <Upload size={20} className="text-[#B32B2C]" />
                <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} className="text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#B32B2C] file:text-white hover:file:bg-red-700 cursor-pointer" />
              </div>
            </div>
          </div>
          <div className="flex gap-3 justify-end mt-5 pt-4 border-t border-gray-100">
            <Button variant="secondary" type="button" onClick={() => { setEditItem(null); setImageFile(null) }}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <span className="flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Saving...</span> : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}