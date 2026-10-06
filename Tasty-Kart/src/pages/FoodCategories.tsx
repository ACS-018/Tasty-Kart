import { useState, useEffect, useMemo, useRef } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Edit, Trash2, Plus, Loader2, AlertTriangle, Upload, Eye } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import type { FoodCategory, FoodItem, Restaurant } from '@/data/dummy'
import { formatCurrency } from '@/lib/utils'
import {
  subscribeToCollection,
  addDocumentToFirestore,
  deleteDocumentFromFirestore,
  uploadImageToStorage,
  clearSeedFoodCategories,
} from '@/lib/firebaseService'

function nameKey(name: string) {
  return name.trim().toLowerCase()
}

function errorText(error: unknown) {
  if (!error) return 'Could not save category'
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  const message = (error as { message?: string }).message
  return message || 'Could not save category'
}

type CategoryGroup = {
  key: string
  name: string
  icon: string
  image?: string
  status: 'active' | 'inactive'
  itemCount: number
  entries: FoodCategory[]
  restaurants: { id: string; name: string; categoryId: string; itemCount: number }[]
}

export function FoodCategories() {
  const [categoriesList, setCategoriesList] = useState<FoodCategory[]>([])
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [foodItems, setFoodItems] = useState<FoodItem[]>([])
  const [listsReady, setListsReady] = useState({ categories: false, restaurants: false })
  const [showAdd, setShowAdd] = useState(false)
  const [editGroup, setEditGroup] = useState<CategoryGroup | null>(null)
  const [deleteGroup, setDeleteGroup] = useState<CategoryGroup | null>(null)
  const [viewGroup, setViewGroup] = useState<CategoryGroup | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCleaning, setIsCleaning] = useState(false)
  const [showCleanConfirm, setShowCleanConfirm] = useState(false)
  const cleanupStarted = useRef(false)
  const { success, error: toastError } = useToast()

  const [formData, setFormData] = useState({
    name: '',
    restaurantIds: [] as string[],
    status: 'active' as 'active' | 'inactive',
    icon: '🍲',
  })
  const [imageFile, setImageFile] = useState<File | null>(null)

  useEffect(() => {
    const unsubs = [
      subscribeToCollection<FoodCategory>('foodCategories', (data) => {
        setCategoriesList(data)
        setListsReady(prev => ({ ...prev, categories: true }))
      }),
      subscribeToCollection<Restaurant>('restaurants', (data) => {
        setRestaurants(data)
        setListsReady(prev => ({ ...prev, restaurants: true }))
      }),
      subscribeToCollection<FoodItem>('foodItems', setFoodItems),
    ]
    return () => unsubs.forEach(fn => fn())
  }, [])

  const liveRestaurants = useMemo(
    () => restaurants.filter(restaurant => restaurant.id && restaurant.name),
    [restaurants],
  )
  const liveIds = useMemo(() => new Set(liveRestaurants.map(restaurant => restaurant.id)), [liveRestaurants])

  const itemsFor = (categoryId: string, categoryName: string, restaurantId: string) => {
    const key = nameKey(categoryName)
    return foodItems.filter(item => {
      if (item.restaurantId !== restaurantId) return false
      if (item.categoryId && item.categoryId === categoryId) return true
      return nameKey(item.categoryName || '') === key
    })
  }

  const itemCountFor = (categoryId: string, categoryName: string, restaurantId: string) =>
    itemsFor(categoryId, categoryName, restaurantId).length

  const groups = useMemo(() => {
    const byName = new Map<string, CategoryGroup>()
    for (const category of categoriesList) {
      if (!category.restaurantId || !liveIds.has(category.restaurantId)) continue
      const restaurant = liveRestaurants.find(item => item.id === category.restaurantId)
      if (!restaurant || !category.name?.trim()) continue
      const key = nameKey(category.name)
      const count = itemCountFor(category.id, category.name, category.restaurantId)
      const group = byName.get(key) || {
        key,
        name: category.name.trim(),
        icon: category.icon || '🍲',
        image: category.image,
        status: category.status || 'active',
        itemCount: 0,
        entries: [],
        restaurants: [],
      }
      const already = group.restaurants.some(item => item.id === restaurant.id)
      if (already) continue
      group.entries.push(category)
      group.restaurants.push({
        id: restaurant.id,
        name: restaurant.name,
        categoryId: category.id,
        itemCount: count,
      })
      group.itemCount += count
      if (!group.image && category.image) group.image = category.image
      group.status = group.entries.every(entry => entry.status === 'inactive') ? 'inactive' : 'active'
      byName.set(key, group)
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [categoriesList, liveIds, liveRestaurants, foodItems])

  useEffect(() => {
    if (!listsReady.categories || !listsReady.restaurants || liveRestaurants.length === 0) return
    if (cleanupStarted.current || showAdd || editGroup) return

    const seen = new Map<string, FoodCategory>()
    const toDelete: string[] = []
    for (const category of categoriesList) {
      if (!category.id) continue
      if (!category.restaurantId || !liveIds.has(category.restaurantId)) {
        toDelete.push(category.id)
        continue
      }
      const key = `${category.restaurantId}::${nameKey(category.name || '')}`
      const previous = seen.get(key)
      if (!previous) {
        seen.set(key, category)
        continue
      }
      const previousScore = (previous.itemCount || 0) + (previous.image ? 1000 : 0)
      const nextScore = (category.itemCount || 0) + (category.image ? 1000 : 0)
      if (nextScore > previousScore) {
        toDelete.push(previous.id)
        seen.set(key, category)
      } else {
        toDelete.push(category.id)
      }
    }

    const unique = [...new Set(toDelete)]
    if (unique.length === 0) return
    cleanupStarted.current = true
    Promise.all(unique.map(id => deleteDocumentFromFirestore('foodCategories', id))).then(results => {
      const removed = results.filter(result => result.success).length
      if (removed > 0) {
        success('Categories cleaned', `Removed ${removed} duplicate categories and categories from deleted restaurants`)
      }
    })
  }, [categoriesList, editGroup, liveIds, liveRestaurants.length, listsReady, showAdd, success])

  const toggleRestaurant = (restaurantId: string) => {
    setFormData(current => ({
      ...current,
      restaurantIds: current.restaurantIds.includes(restaurantId)
        ? current.restaurantIds.filter(id => id !== restaurantId)
        : [...current.restaurantIds, restaurantId],
    }))
  }

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      toastError('Validation', 'Category name is required')
      return
    }
    if (formData.restaurantIds.length === 0) {
      toastError('Validation', 'Select at least one restaurant')
      return
    }

    setIsSubmitting(true)
    try {
      let imageUrl = editGroup?.image || ''
      if (imageFile) {
        imageUrl = await uploadImageToStorage(imageFile, 'foodCategories')
      }

      const previousByRestaurant = new Map(
        (editGroup?.restaurants || []).map(restaurant => [restaurant.id, restaurant]),
      )
      const failures: string[] = []

      for (const [index, restaurantId] of formData.restaurantIds.entries()) {
        const restaurant = liveRestaurants.find(item => item.id === restaurantId)
        if (!restaurant) continue
        const previous = previousByRestaurant.get(restaurantId)
        const sameName = categoriesList.find(category =>
          category.restaurantId === restaurantId && nameKey(category.name || '') === nameKey(formData.name),
        )
        const categoryId = previous?.categoryId || sameName?.id || `cat_${restaurantId}_${Date.now()}_${index}`
        const payload: FoodCategory = {
          id: categoryId,
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          name: formData.name.trim(),
          icon: formData.icon || '🍲',
          itemCount: itemCountFor(categoryId, formData.name, restaurant.id),
          sortOrder: sameName?.sortOrder ?? index,
          status: formData.status,
        }
        if (imageUrl) payload.image = imageUrl
        const res = await addDocumentToFirestore('foodCategories', payload)
        if (!res.success) failures.push(`${restaurant.name}: ${errorText(res.error)}`)
      }

      const kept: string[] = []
      for (const restaurant of editGroup?.restaurants || []) {
        if (formData.restaurantIds.includes(restaurant.id)) continue
        if (restaurant.itemCount > 0) {
          kept.push(restaurant.name)
          continue
        }
        const res = await deleteDocumentFromFirestore('foodCategories', restaurant.categoryId)
        if (!res.success) failures.push(`${restaurant.name}: ${errorText(res.error)}`)
      }

      setIsSubmitting(false)
      if (failures.length > 0) {
        toastError('Save Error', failures[0])
        return
      }
      success(
        'Category Saved',
        `"${formData.name.trim()}" is on ${formData.restaurantIds.length} restaurant${formData.restaurantIds.length === 1 ? '' : 's'}`,
      )
      if (kept.length > 0) {
        toastError('Some restaurants kept', `${kept.join(', ')} still have menu items in this category`)
      }
      setShowAdd(false)
      setEditGroup(null)
      setFormData({ name: '', restaurantIds: [], status: 'active', icon: '🍲' })
      setImageFile(null)
    } catch (err: unknown) {
      setIsSubmitting(false)
      toastError('Save Error', errorText(err))
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteGroup) return
    const results = await Promise.all(
      deleteGroup.entries.map(entry => deleteDocumentFromFirestore('foodCategories', entry.id)),
    )
    const failed = results.find(result => !result.success)
    if (failed) {
      toastError('Delete Failed', errorText(failed.error))
    } else {
      success('Category Deleted', `"${deleteGroup.name}" removed from ${deleteGroup.restaurants.length} restaurants`)
    }
    setDeleteGroup(null)
  }

  const handleClearDummyData = async () => {
    setIsCleaning(true)
    setShowCleanConfirm(false)
    try {
      const result = await clearSeedFoodCategories()
      if (result.error) {
        toastError('Cleanup Failed', result.error)
      } else {
        success(
          'Dummy Data Removed',
          result.deleted > 0
            ? `${result.deleted} dummy food categories deleted`
            : 'No dummy categories found — already clean',
        )
      }
    } catch (err: unknown) {
      toastError('Error', errorText(err))
    } finally {
      setIsCleaning(false)
    }
  }

  const columns: ColumnDef<CategoryGroup, unknown>[] = [
    {
      id: 'category',
      header: 'Category',
      accessorFn: (row) => `${row.name} ${row.restaurants.map(restaurant => restaurant.name).join(' ')}`,
      cell: ({ row: { original: category } }) => (
        <div className="flex items-center gap-3">
          {category.image ? (
            <img src={category.image} alt={category.name} className="w-10 h-10 rounded-xl object-cover bg-gray-100 shrink-0 border border-gray-200 shadow-sm" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <span className="text-lg">{category.icon || '🍽️'}</span>
            </div>
          )}
          <span className="text-sm font-semibold text-gray-900">{category.name}</span>
        </div>
      ),
    },
    {
      id: 'restaurants',
      header: 'Restaurants',
      accessorFn: (row) => String(row.restaurants.length),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold text-gray-900">{row.original.restaurants.length}</p>
          {row.original.restaurants.length > 0 && (
            <button
              type="button"
              onClick={() => setViewGroup(row.original)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#B32B2C] bg-red-50 hover:bg-red-100 transition-colors"
            >
              <Eye size={13} /> View
            </button>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status || 'active'} />,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button
            onClick={() => {
              setEditGroup(row.original)
              setFormData({
                name: row.original.name,
                restaurantIds: row.original.restaurants.map(restaurant => restaurant.id),
                status: row.original.status || 'active',
                icon: row.original.icon || '🍲',
              })
              setImageFile(null)
              setShowAdd(false)
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
          >
            <Edit size={15} />
          </button>
          <button onClick={() => setDeleteGroup(row.original)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end gap-2 flex-wrap">
        <Button
          size="sm"
          variant="secondary"
          icon={isCleaning ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
          onClick={() => setShowCleanConfirm(true)}
          disabled={isCleaning}
        >
          {isCleaning ? 'Removing…' : 'Remove Dummy Data'}
        </Button>
        <Button
          size="sm"
          icon={<Plus size={14} />}
          onClick={() => {
            setFormData({ name: '', restaurantIds: [], status: 'active', icon: '🍲' })
            setEditGroup(null)
            setImageFile(null)
            setShowAdd(true)
          }}
        >
          Add Category
        </Button>
      </div>
      <DataTable data={groups} columns={columns} searchPlaceholder="Search food categories..." />

      <Modal
        open={showAdd || !!editGroup}
        onClose={() => { setShowAdd(false); setEditGroup(null) }}
        title={editGroup ? 'Edit Food Category' : 'Add Food Category'}
        size="md"
      >
        <form onSubmit={handleSaveSubmit} className="space-y-4">
          <Input
            label="Category Name *"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Starters"
            required
          />
          <Input
            label="Emoji Icon"
            value={formData.icon}
            onChange={e => setFormData({ ...formData, icon: e.target.value })}
            placeholder="🍲"
          />
          <div>
            <p className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Restaurants *</p>
            <p className="text-xs text-gray-500 mb-2">Tick every restaurant that should have this category. Starters can be added to 2 or 3 restaurants together.</p>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50">
              {liveRestaurants.length === 0 && (
                <p className="px-3 py-4 text-sm text-gray-400">No restaurants yet.</p>
              )}
              {liveRestaurants.map(restaurant => (
                <label key={restaurant.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-white">
                  <input
                    type="checkbox"
                    checked={formData.restaurantIds.includes(restaurant.id)}
                    onChange={() => toggleRestaurant(restaurant.id)}
                    className="accent-[#B32B2C]"
                  />
                  <span className="text-sm text-gray-800">{restaurant.name}</span>
                </label>
              ))}
            </div>
            <p className="text-xs font-medium text-gray-600 mt-1.5">{formData.restaurantIds.length} restaurant{formData.restaurantIds.length === 1 ? '' : 's'} selected</p>
          </div>
          <Select
            label="Status"
            value={formData.status}
            onChange={e => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Upload Category Image
            </label>
            <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-gray-300 bg-gray-50">
              <Upload size={18} className="text-[#B32B2C]" />
              <input
                type="file"
                accept="image/*"
                onChange={e => setImageFile(e.target.files?.[0] || null)}
                className="text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#B32B2C] file:text-white cursor-pointer"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <Button variant="secondary" type="button" onClick={() => { setShowAdd(false); setEditGroup(null) }}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> Saving...
                </span>
              ) : (
                editGroup ? 'Save Changes' : 'Add Category'
              )}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!viewGroup}
        onClose={() => setViewGroup(null)}
        title={viewGroup ? `${viewGroup.name} · Restaurants & Food Items` : ''}
        size="lg"
      >
        {viewGroup && (
          <div className="space-y-4 max-h-[65vh] overflow-y-auto">
            {viewGroup.restaurants.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No restaurants assigned to this category</p>
            ) : (
              viewGroup.restaurants.map(restaurant => {
                const items = itemsFor(restaurant.categoryId, viewGroup.name, restaurant.id)
                return (
                  <div key={restaurant.id} className="rounded-xl border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <p className="text-sm font-bold text-gray-900">{restaurant.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {items.length} food item{items.length === 1 ? '' : 's'} in this category
                      </p>
                    </div>
                    {items.length === 0 ? (
                      <div className="px-4 py-6 text-center">
                        <p className="text-sm text-gray-400">No food items yet</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {items.map(item => {
                          const price = Number(item.price) || 0
                          const discounted = Number(item.discountedPrice) || 0
                          const showDiscount = discounted > 0 && discounted < price
                          return (
                            <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                              {item.image ? (
                                <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover bg-gray-100 shrink-0 border border-gray-200" />
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-amber-50 flex items-center justify-center shrink-0 text-xl border border-gray-200">🍽️</div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                  <span className={`w-2.5 h-2.5 rounded-sm border shrink-0 ${item.isVeg ? 'border-green-600 bg-green-500' : 'border-red-600 bg-red-500'}`} />
                                  {item.name}
                                </p>
                                {item.description && (
                                  <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{item.description}</p>
                                )}
                                {item.status === 'inactive' && (
                                  <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">Inactive</span>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-bold text-gray-900">{formatCurrency(showDiscount ? discounted : price)}</p>
                                {showDiscount && <p className="text-xs text-gray-400 line-through">{formatCurrency(price)}</p>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteGroup}
        onClose={() => setDeleteGroup(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Category"
        message={`Delete "${deleteGroup?.name}" from ${deleteGroup?.restaurants.length || 0} restaurants?`}
        variant="danger"
      />

      <ConfirmDialog
        open={showCleanConfirm}
        onClose={() => setShowCleanConfirm(false)}
        onConfirm={handleClearDummyData}
        title="Remove Dummy Food Categories"
        message="This will permanently delete all food categories that belong to the built-in demo/seed restaurants. Categories you created manually will not be affected. This cannot be undone."
        confirmLabel="Yes, Remove Dummy Data"
        variant="danger"
      />
    </div>
  )
}
