import { useState, useEffect, useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, Edit, Trash2, Plus, Star, MapPin, Phone, Upload, Loader2, Store, UtensilsCrossed, Tag, Check, Gift, PlusCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Drawer, ConfirmDialog, Modal } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Input'
import type { Addon, Order, Restaurant } from '@/data/dummy'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import {
  subscribeToCollection,
  subscribeToOrders,
  addDocumentToFirestore,
  updateDocumentInFirestore,
  deleteDocumentFromFirestore,
  uploadImageToStorage,
  deleteUnassignedSeedFoodCategories,
  deleteDuplicateAddons,
  addonCatalogKey,
  syncAddonsForRestaurant,
} from '@/lib/firebaseService'
import { GoogleMapPicker } from '@/components/shared/GoogleMapPicker'

const colorMap = {
  red:    { bg: 'bg-red-50', icon: 'text-red-600' },
  green:  { bg: 'bg-green-50', icon: 'text-green-600' },
  blue:   { bg: 'bg-blue-50', icon: 'text-blue-600' },
  amber:  { bg: 'bg-amber-50', icon: 'text-amber-600' },
}

function restaurantKey(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function isCancelledOrder(status: unknown) {
  const value = String(status ?? '').trim().toLowerCase()
  return value === 'cancelled' || value === 'canceled' || value === 'refunded' || value.includes('cancel')
}

/** Amount collected on an order. Falls back to line items when `total` was never stored. */
function orderAmount(order: Order) {
  const total = Number(order.total) || 0
  if (total > 0) return total
  const items = Array.isArray(order.items) ? order.items : []
  const fromItems = items.reduce((sum, item) => {
    const price = Number(item?.price) || 0
    const qty = Number(item?.qty) || 0
    return sum + price * (qty > 0 ? qty : 1)
  }, 0)
  if (fromItems > 0) return fromItems
  const record = order as Order & Record<string, unknown>
  const computed =
    (Number(record.subtotal) || 0) +
    (Number(record.tax) || 0) +
    (Number(record.deliveryFee) || 0) +
    (Number(record.platformFee) || 0) +
    (Number(record.tip) || 0) -
    (Number(record.discount) || 0)
  return computed > 0 ? computed : 0
}

export function Restaurants() {
  const navigate = useNavigate()
  const [restaurantsList, setRestaurantsList] = useState<Restaurant[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [restaurantCategories, setRestaurantCategories] = useState<any[]>([])
  const [selected, setSelected] = useState<Restaurant | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editTarget, setEditTarget] = useState<Restaurant | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Restaurant | null>(null)
  const [view, setView] = useState<'table' | 'grid'>('table')
  const [restaurantQuery, setRestaurantQuery] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [showAddonModal, setShowAddonModal] = useState(false)
  const [selectedAddonKeys, setSelectedAddonKeys] = useState<string[]>([])
  const [addonsList, setAddonsList] = useState<Addon[]>([])
  const [addonInitForRestaurantId, setAddonInitForRestaurantId] = useState<string | null>(null)
  const [showMapPicker, setShowMapPicker] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number; address: string } | null>(null)
  const { success, error: toastError} = useToast()

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    cuisine: '',
    owner: '',
    phone: '',
    email: '',
    address: '',
    city: 'Bangalore',
    openingHours: '10:00 AM - 11:00 PM',
    deliveryTime: '30-45 min',
    minOrder: '200',
    status: 'active' as 'active' | 'inactive',
    description: '',
    popular: false,
  })
  const [imageFile, setImageFile] = useState<File | null>(null)

  // Real-time Firestore Sync
  useEffect(() => {
    const unsub = subscribeToCollection<Restaurant>('restaurants', (liveData) => {
      setRestaurantsList(liveData)
    })
    return () => unsub()
  }, [])

  useEffect(() => subscribeToOrders(setOrders), [])

  useEffect(() => {
    deleteUnassignedSeedFoodCategories().catch(() => {})
    deleteDuplicateAddons().catch(() => {})
  }, [])

  // Load restaurant categories
  useEffect(() => {
    const unsub = subscribeToCollection<any>('restaurantCategories', (liveData) => {
      setRestaurantCategories(liveData.filter(cat => cat.status === 'active'))
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = subscribeToCollection<Addon>('addons', setAddonsList)
    return () => unsub()
  }, [])

  const catalogAddonOptions = useMemo(() => {
    const liveIds = new Set(restaurantsList.map(restaurant => restaurant.id))
    const map = new Map<string, Addon & { catalogKey: string; usageCount: number }>()
    const seenRestaurants = new Map<string, Set<string>>()
    for (const a of addonsList) {
      if (a.status === 'inactive') continue
      if (liveIds.size > 0 && !liveIds.has(a.restaurantId)) continue
      const key = addonCatalogKey(a)
      const existing = map.get(key)
      const seen = seenRestaurants.get(key) ?? new Set<string>()
      if (!existing) {
        map.set(key, { ...a, catalogKey: key, usageCount: 1 })
        if (a.restaurantId) seen.add(a.restaurantId)
        seenRestaurants.set(key, seen)
      } else if (a.restaurantId && !seen.has(a.restaurantId)) {
        seen.add(a.restaurantId)
        existing.usageCount += 1
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [addonsList, restaurantsList])

  // ── Offers: subscribe to all offers so we can show a live count per
  //    restaurant in the table without navigating into each restaurant.
  const [offersList, setOffersList] = useState<any[]>([])
  useEffect(() => {
    const unsub = subscribeToCollection<any>('offers', setOffersList)
    return () => unsub()
  }, [])

  const restaurants = useMemo(() => {
    const ids = new Set(restaurantsList.map(restaurant => restaurant.id))
    const nameOwners = new Map<string, string[]>()
    for (const restaurant of restaurantsList) {
      const key = restaurantKey(restaurant.name)
      if (!key) continue
      const owners = nameOwners.get(key) ?? []
      owners.push(restaurant.id)
      nameOwners.set(key, owners)
    }

    const totals = new Map<string, { orders: number; revenue: number }>()
    const add = (id: string, amount: number) => {
      const current = totals.get(id) ?? { orders: 0, revenue: 0 }
      current.orders += 1
      current.revenue += amount
      totals.set(id, current)
    }

    for (const order of orders) {
      const amount = isCancelledOrder(order.status) ? 0 : orderAmount(order)
      const restaurantId = String(order.restaurantId || '')
      if (restaurantId && ids.has(restaurantId)) {
        add(restaurantId, amount)
        continue
      }
      const owners = nameOwners.get(restaurantKey(order.restaurantName)) ?? []
      if (owners.length === 1) add(owners[0], amount)
    }

    return restaurantsList.map(restaurant => {
      const live = totals.get(restaurant.id) ?? { orders: 0, revenue: 0 }
      return { ...restaurant, totalOrders: live.orders, revenue: live.revenue }
    })
  }, [restaurantsList, orders])

  const visibleRestaurants = useMemo(() => {
    const query = restaurantQuery.trim().toLowerCase()
    if (!query) return restaurants
    return restaurants.filter(restaurant => {
      const location = restaurant.location?.address || ''
      return [restaurant.name, restaurant.cuisine, restaurant.city, restaurant.owner, restaurant.phone, restaurant.address, location]
        .some(value => String(value || '').toLowerCase().includes(query))
    })
  }, [restaurants, restaurantQuery])

  const categoryRestaurantCount = (category: { id: string; name?: string }) => {
    const name = String(category.name || '').trim().toLowerCase()
    return restaurantsList.filter(restaurant =>
      (restaurant.categories || []).some(value => {
        const token = String(value || '').trim()
        return token === category.id || (name.length > 0 && token.toLowerCase() === name)
      }),
    ).length
  }

  useEffect(() => {
    setSelected(current => {
      if (!current) return current
      const fresh = restaurants.find(restaurant => restaurant.id === current.id)
      if (!fresh) return current
      if (fresh.totalOrders === current.totalOrders && fresh.revenue === current.revenue) return current
      return fresh
    })
  }, [restaurants])

  const stats = [
    { label: 'Total Restaurants', value: restaurants.length, icon: Store, color: 'blue' as const },
    { label: 'Active', value: restaurants.filter(r => r.status === 'active').length, icon: Star, color: 'green' as const },
    { label: 'Total Revenue', value: formatCurrency(restaurants.reduce((s, r) => s + (r.revenue || 0), 0)), icon: Star, color: 'amber' as const },
  ]

  // Map restaurantId → active (non-expired) offer count + best discount label
  const offerInfoByRestaurant = useMemo(() => {
    const today = new Date()
    today.setHours(23, 59, 59, 999) // end of today
    const map: Record<string, { count: number; best: string }> = {}
    for (const o of offersList) {
      if (!o.restaurantId || o.status !== 'active') continue
      const expiry = o.validTill || o.expiry
      if (expiry && new Date(expiry) < today) continue // expired
      if (!map[o.restaurantId]) map[o.restaurantId] = { count: 0, best: '' }
      map[o.restaurantId].count += 1
      // Track best discount label
      const disc = Number(o.discount) || 0
      const label = o.type === 'fixed' ? `₹${disc} OFF` : `${disc}% OFF`
      if (!map[o.restaurantId].best) {
        map[o.restaurantId].best = label
      } else {
        // Keep whichever has a larger numeric discount
        const prev = Number(offersList.find(x => x.restaurantId === o.restaurantId && map[o.restaurantId].best.includes(String(Number(x.discount))))?.discount) || 0
        if (disc > prev) map[o.restaurantId].best = label
      }
    }
    return map
  }, [offersList])

  // Populate form when editing
  useEffect(() => {
    if (editTarget) {
      setFormData({
        name: editTarget.name,
        cuisine: editTarget.cuisine,
        owner: editTarget.owner,
        phone: editTarget.phone,
        email: editTarget.email,
        address: editTarget.address,
        city: editTarget.city,
        openingHours: editTarget.openingHours,
        deliveryTime: editTarget.deliveryTime,
        minOrder: String(editTarget.minOrder),
        status: editTarget.status,
        description: editTarget.description || '',
        popular: editTarget.popular === true,
      })
      setSelectedCategories(editTarget.categories || [])
      setSelectedLocation(editTarget.location || null)
      setImageFile(null)
      setAddonInitForRestaurantId(null)
    }
  }, [editTarget])

  useEffect(() => {
    if (!editTarget) return
    if (addonInitForRestaurantId === editTarget.id) return
    const keys = addonsList
      .filter(a => a.restaurantId === editTarget.id && a.status !== 'inactive')
      .map(a => addonCatalogKey(a))
    setSelectedAddonKeys([...new Set(keys)])
    setAddonInitForRestaurantId(editTarget.id)
  }, [editTarget, addonsList, addonInitForRestaurantId])

  const resetRestaurantForm = () => {
    setFormData({
      name: '', cuisine: '', owner: '', phone: '', email: '',
      address: '', city: 'Bangalore', openingHours: '10:00 AM - 11:00 PM',
      deliveryTime: '30-45 min', minOrder: '200', status: 'active', description: '',
      popular: false,
    })
    setSelectedCategories([])
    setSelectedAddonKeys([])
    setAddonInitForRestaurantId(null)
    setSelectedLocation(null)
    setImageFile(null)
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    // Validate location is selected
    if (!selectedLocation) {
      toastError('Location Required', 'Please select restaurant location on map before saving.')
      return
    }

    setIsSubmitting(true)
    try {
      let logoUrl = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=150'
      if (imageFile) {
        logoUrl = await uploadImageToStorage(imageFile, 'restaurants')
      }

      const newRes: Restaurant = {
        id: `res_${Date.now()}`,
        name: formData.name,
        cuisine: formData.cuisine || 'Multi-Cuisine',
        owner: formData.owner || 'Admin',
        phone: formData.phone || '+91 9876543210',
        email: formData.email || 'kitchen@tastykart.com',
        address: selectedLocation.address,
        city: formData.city,
        openingHours: formData.openingHours,
        deliveryTime: formData.deliveryTime,
        minOrder: Number(formData.minOrder) || 150,
        status: formData.status,
        rating: 4.5,
        totalOrders: 0,
        revenue: 0,
        logo: logoUrl,
        isVeg: false,
        popular: formData.popular,
        categories: selectedCategories,
        location: selectedLocation,
      }

      const res = await addDocumentToFirestore('restaurants', newRes)
      if (res.success && selectedAddonKeys.length > 0) {
          const addonSync = await syncAddonsForRestaurant(
            newRes.id,
            newRes.name,
            selectedAddonKeys,
            addonsList,
          )
          if (!addonSync.success) {
            toastError('Add-ons', addonSync.error || 'Could not assign add-ons for the user app')
          }
      }
      setIsSubmitting(false)

      if (res.success) {
        success(
          'Restaurant Saved!',
          `"${formData.name}" saved with ${selectedCategories.length} categories and ${selectedAddonKeys.length} add-on(s) for the user app`,
        )
        setShowAdd(false)
        resetRestaurantForm()
      } else {
        toastError('Failed to Save', 'Could not save restaurant to Firestore')
      }
    } catch (err: any) {
      setIsSubmitting(false)
      toastError('Save Error', err?.message || 'Failed to save')
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTarget || !formData.name.trim()) return

    // Validate location is selected
    if (!selectedLocation) {
      toastError('Location Required', 'Please select restaurant location on map before updating.')
      return
    }

    setIsSubmitting(true)
    try {
      let logoUrl = editTarget.logo
      if (imageFile) {
        logoUrl = await uploadImageToStorage(imageFile, 'restaurants')
      }

      const updatedData = {
        name: formData.name,
        cuisine: formData.cuisine || 'Multi-Cuisine',
        owner: formData.owner || 'Admin',
        phone: formData.phone || '+91 9876543210',
        email: formData.email || 'kitchen@tastykart.com',
        address: selectedLocation.address,
        city: formData.city,
        openingHours: formData.openingHours,
        deliveryTime: formData.deliveryTime,
        minOrder: Number(formData.minOrder) || 150,
        status: formData.status,
        popular: formData.popular,
        logo: logoUrl,
        categories: selectedCategories,
        location: selectedLocation,
        description: formData.description || '',
      }

      const res = await updateDocumentInFirestore('restaurants', editTarget.id, updatedData)
      if (res.success) {
        const addonSync = await syncAddonsForRestaurant(
          editTarget.id,
          formData.name,
          selectedAddonKeys,
          addonsList,
        )
        if (!addonSync.success) {
          toastError('Add-ons', addonSync.error || 'Could not update add-ons for the user app')
        }
      }
      setIsSubmitting(false)

      if (res.success) {
        success(
          'Restaurant Updated!',
          `"${formData.name}" updated with ${selectedCategories.length} categories and ${selectedAddonKeys.length} add-on(s) for the user app`,
        )
        setEditTarget(null)
        resetRestaurantForm()
      } else {
        toastError('Failed to Update', 'Could not update restaurant in Firestore')
      }
    } catch (err: any) {
      setIsSubmitting(false)
      toastError('Save Error', err?.message || 'Failed to save')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    const res = await deleteDocumentFromFirestore('restaurants', deleteTarget.id)
    if (res.success) {
      success('Restaurant Deleted', `"${deleteTarget.name}" removed from Firestore`)
    }
    setDeleteTarget(null)
  }

  const columns: ColumnDef<Restaurant>[] = [
    {
      id: 'info',
      header: 'Restaurant',
      accessorFn: (row) => `${row.name} ${row.cuisine} ${row.city} ${row.owner} ${row.phone}`,
      cell: ({ row: { original: r } }) => (
        <div className="flex items-center gap-3">
          <img src={r.logo} alt={r.name} className="w-10 h-10 rounded-xl bg-gray-100 object-cover" />
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {r.name}
              {r.popular && (
                <span className="ml-2 align-middle text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                  Popular
                </span>
              )}
            </p>
            <p className="text-xs text-gray-400">{r.cuisine}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'address',
      header: 'Location',
      cell: ({ row }) => {
        const r = row.original as any
        // Prefer city extracted from the Google Maps address string stored in
        // location.address (e.g. "Koramangala, Bengaluru, Karnataka 560034, India")
        // Last meaningful part before "India" is usually City/State.
        const gMapsAddress: string = r.location?.address || ''
        const cityFromAddress = (() => {
          if (!gMapsAddress) return ''
          // Split on commas, trim, drop empty + 'India'
          const parts = gMapsAddress
            .split(',')
            .map((p: string) => p.trim())
            .filter((p: string) => p && p.toLowerCase() !== 'india')
          // City is typically the second-to-last meaningful segment
          // e.g. ["Koramangala", "Bengaluru", "Karnataka 560034"] → "Bengaluru"
          if (parts.length >= 2) return parts[parts.length - 2].replace(/\s?\d{6}/, '').trim()
          return parts[0] || ''
        })()
        const displayCity = cityFromAddress || r.city || '—'
        const hasCoords = r.location?.latitude && r.location?.longitude

        return (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1 text-xs text-gray-700 font-medium">
              <MapPin size={12} className="text-[#B32B2C] shrink-0" />
              {displayCity}
            </div>
            {hasCoords && (
              <span className="text-[10px] text-gray-400 font-mono ml-4">
                {r.location.latitude.toFixed(4)}, {r.location.longitude.toFixed(4)}
              </span>
            )}
            {!hasCoords && (
              <span className="text-[10px] text-amber-500 ml-4">No GPS</span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'rating',
      header: 'Rating',
      cell: ({ row }) => {
        const r = row.original
        // Prefer averageRating (live, user-driven) — falls back to the static
        // seed `rating` field. Both are kept in sync on every review write.
        const displayRating = r.averageRating ?? r.rating
        const reviewCount = r.totalReviews ?? 0
        return (
          <div className="flex items-center gap-1 text-sm">
            <Star size={13} className="text-amber-400 fill-amber-400" />
            <span className="font-medium">
              {displayRating > 0 ? displayRating.toFixed(1) : 'New'}
            </span>
            {reviewCount > 0 && (
              <span className="text-xs text-gray-400">({reviewCount})</span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'totalOrders',
      header: 'Orders',
      cell: ({ row }) => <span className="text-sm">{row.original.totalOrders.toLocaleString()}</span>,
    },
    {
      accessorKey: 'revenue',
      header: 'Revenue',
      cell: ({ row }) => <span className="text-sm font-semibold">{formatCurrency(row.original.revenue)}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'offers',
      header: 'Offers',
      cell: ({ row }) => {
        const info = offerInfoByRestaurant[row.original.id]
        if (!info || info.count === 0) {
          return (
            <button
              title="Add offer"
              onClick={e => { e.stopPropagation(); navigate(`/restaurants/${row.original.id}?tab=offers`) }}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#B32B2C] transition-colors"
            >
              <Gift size={13} />
              <span>None</span>
            </button>
          )
        }
        return (
          <button
            title="Manage offers"
            onClick={e => { e.stopPropagation(); navigate(`/restaurants/${row.original.id}?tab=offers`) }}
            className="flex items-center gap-1.5 group"
          >
            <span className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full group-hover:bg-green-100 transition-colors">
              <Gift size={11} />
              {info.count} active
            </span>
            <span className="text-[10px] text-[#B32B2C] font-semibold hidden sm:inline">{info.best}</span>
          </button>
        )
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            title="Manage Menu"
            onClick={e => { e.stopPropagation(); navigate(`/restaurants/${row.original.id}`) }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-[#B32B2C] hover:bg-red-50 transition-colors"
          >
            <UtensilsCrossed size={15} />
          </button>
          <button onClick={e => { e.stopPropagation(); setSelected(row.original) }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
            <Eye size={15} />
          </button>
          <button onClick={e => { e.stopPropagation(); setEditTarget(row.original) }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors">
            <Edit size={15} />
          </button>
          <button onClick={e => { e.stopPropagation(); setDeleteTarget(row.original) }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6 pb-8">

      <div className="flex items-center justify-end gap-2 flex-wrap">
        <Button size="sm" icon={<Plus size={14} />} onClick={() => { resetRestaurantForm(); setShowAdd(true) }}>Add Restaurant</Button>
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
        <div className="flex flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:w-80">
            <Input
              placeholder="Search restaurants..."
              value={restaurantQuery}
              onChange={e => setRestaurantQuery(e.target.value)}
            />
          </div>
          <div className="flex self-end sm:self-auto rounded-lg border border-gray-200 overflow-hidden">
            {(['table', 'grid'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-2 text-xs font-medium transition-colors capitalize ${view === v ? 'bg-[#B32B2C] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                {v}
              </button>
            ))}
          </div>
        </div>

      {view === 'table' ? (
          <DataTable data={visibleRestaurants} columns={columns} hideSearch onRowClick={setSelected} />
      ) : visibleRestaurants.length === 0 ? (
        <p className="px-4 py-16 text-center text-sm text-gray-400">No data found</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
          {visibleRestaurants.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              onClick={() => setSelected(r)}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all cursor-pointer overflow-hidden">
              <div className="h-24 bg-gradient-to-br from-red-100 to-red-50 relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <img src={r.logo} alt={r.name} className="w-16 h-16 rounded-2xl bg-white shadow-md object-cover" />
                </div>
                <div className="absolute top-2 right-2"><StatusBadge status={r.status} /></div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 text-sm">{r.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{r.cuisine}</p>
                <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Star size={11} className="text-amber-400 fill-amber-400" />
                    {(r.averageRating ?? r.rating) > 0
                      ? (r.averageRating ?? r.rating).toFixed(1)
                      : 'New'}
                    {(r.totalReviews ?? 0) > 0 && (
                      <span className="text-gray-400">({r.totalReviews})</span>
                    )}
                  </span>
                  <span>{r.totalOrders} orders</span>
                  <span>{formatCurrency(r.revenue)}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      </div>

      {/* Detail Drawer */}
      <Drawer open={!!selected} onClose={() => setSelected(null)} title="Restaurant Details" width="w-[560px]">
        {selected && (
          <div className="space-y-5">
            <div className="relative h-32 bg-gradient-to-br from-red-100 to-orange-50 rounded-xl overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <img src={selected.logo} alt={selected.name} className="w-20 h-20 rounded-2xl bg-white shadow-lg object-cover" />
              </div>
              <div className="absolute top-3 right-3"><StatusBadge status={selected.status} /></div>
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-900">{selected.name}</h2>
              <p className="text-sm text-gray-500">{selected.cuisine}</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <Star size={14} className="text-amber-400 fill-amber-400" />
                <span className="text-sm font-medium">
                  {(selected.averageRating ?? selected.rating) > 0
                    ? (selected.averageRating ?? selected.rating).toFixed(1)
                    : 'New'}
                </span>
                {(selected.totalReviews ?? 0) > 0 && (
                  <span className="text-xs text-gray-400">
                    ({selected.totalReviews} review{selected.totalReviews === 1 ? '' : 's'})
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Orders', value: selected.totalOrders.toLocaleString() },
                { label: 'Revenue', value: formatCurrency(selected.revenue) },
                { label: 'Min Order', value: formatCurrency(selected.minOrder) },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400">{s.label}</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{s.value}</p>
                </div>
              ))}
            </div>

            {[
              { title: 'Contact', rows: [['Owner', selected.owner], ['Phone', selected.phone], ['Email', selected.email]] },
              { title: 'Details', rows: [
                ['Address', (selected as any).location?.address || selected.address || '—'],
                ['City', (() => {
                  const addr: string = (selected as any).location?.address || ''
                  if (!addr) return selected.city || '—'
                  const parts = addr.split(',').map((p: string) => p.trim()).filter((p: string) => p && p.toLowerCase() !== 'india')
                  return parts.length >= 2 ? parts[parts.length - 2].replace(/\s?\d{6}/, '').trim() : (selected.city || '—')
                })()],
                ...(((selected as any).location?.latitude && (selected as any).location?.longitude) ? [
                  ['GPS', `${(selected as any).location.latitude.toFixed(6)}, ${(selected as any).location.longitude.toFixed(6)}`],
                ] : [['GPS', 'Not set']]),
                ['Hours', selected.openingHours],
                ['Delivery Time', selected.deliveryTime],
              ]},
            ].map(section => (
              <div key={section.title} className="bg-gray-50 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{section.title}</h4>
                <div className="space-y-2">
                  {section.rows.map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm gap-4">
                      <span className="text-gray-400 shrink-0">{k}</span>
                      <span className="text-gray-700 text-right">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                icon={<UtensilsCrossed size={14} />}
                onClick={() => { navigate(`/restaurants/${selected.id}`); setSelected(null) }}
              >
                Manage Menu
              </Button>
              <Button size="sm" variant="secondary" icon={<Edit size={14} />} onClick={() => { setEditTarget(selected); setSelected(null) }}>Edit Details</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => { setDeleteTarget(selected); setSelected(null) }}>Delete</Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* Add Restaurant Modal */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); resetRestaurantForm() }} title="Add New Restaurant" size="lg">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Restaurant Name *"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Spice Garden"
              required
            />
            <Input
              label="Cuisine Type"
              value={formData.cuisine}
              onChange={e => setFormData({ ...formData, cuisine: e.target.value })}
              placeholder="e.g. North Indian, Chinese"
            />
            <Input
              label="Owner Name"
              value={formData.owner}
              onChange={e => setFormData({ ...formData, owner: e.target.value })}
              placeholder="Full name"
            />
            <Input
              label="Phone"
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+91 XXXXX XXXXX"
            />
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              placeholder="restaurant@mail.com"
            />
            <Input
              label="Address"
              value={selectedLocation?.address || ''}
              readOnly
              placeholder="Filled from the map location"
              className="bg-gray-50 cursor-default"
            />

            {/* Location Picker - Add Form */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Restaurant Location on Map *
              </label>
              <button
                type="button"
                onClick={() => setShowMapPicker(true)}
                className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border-2 border-gray-200 bg-white hover:border-[#B32B2C] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <MapPin size={18} className="text-[#B32B2C]" />
                  <span className="text-sm font-medium text-gray-700">
                    {selectedLocation
                      ? 'Change Location on Map'
                      : 'Select Location on Map'}
                  </span>
                </div>
                <div className="text-xs text-gray-400">Click to open map</div>
              </button>
              {selectedLocation ? (
                <div className="mt-2 p-3 rounded-xl bg-green-50 border border-green-200">
                  <div className="flex items-start gap-2">
                    <MapPin size={16} className="text-green-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-1">Location Selected</p>
                      <p className="text-sm text-gray-900 font-medium break-words">{selectedLocation.address}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Lat: {selectedLocation.latitude.toFixed(6)}, Lng: {selectedLocation.longitude.toFixed(6)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                  <MapPin size={12} /> Location not selected yet — please pick a location on the map before saving
                </p>
              )}
            </div>

            <Input
              label="Opening Hours"
              value={formData.openingHours}
              onChange={e => setFormData({ ...formData, openingHours: e.target.value })}
              placeholder="10:00 AM - 11:00 PM"
            />
            <Input
              label="Delivery Time"
              value={formData.deliveryTime}
              onChange={e => setFormData({ ...formData, deliveryTime: e.target.value })}
              placeholder="30-45 min"
            />
            <Input
              label="Min Order (₹)"
              type="number"
              value={formData.minOrder}
              onChange={e => setFormData({ ...formData, minOrder: e.target.value })}
              placeholder="200"
            />
            <Select
              label="Status"
              value={formData.status}
              onChange={e => setFormData({ ...formData, status: e.target.value as any })}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
            <label className="sm:col-span-2 flex items-start gap-3 p-3 rounded-xl border border-gray-200 bg-white cursor-pointer">
              <input
                type="checkbox"
                checked={formData.popular}
                onChange={e => setFormData({ ...formData, popular: e.target.checked })}
                className="mt-0.5 h-4 w-4 accent-[#B32B2C]"
              />
              <span>
                <span className="block text-sm font-semibold text-gray-900">Popular restaurant</span>
                <span className="block text-xs text-gray-500 mt-0.5">Shown under Popular restaurants when a customer opens search in the app.</span>
              </span>
            </label>

            {/* Restaurant Categories */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Restaurant Categories *
              </label>
              <button
                type="button"
                onClick={() => setShowCategoryModal(true)}
                className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border-2 border-gray-200 bg-white hover:border-[#B32B2C] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Tag size={18} className="text-[#B32B2C]" />
                  <span className="text-sm font-medium text-gray-700">
                    {selectedCategories.length === 0
                      ? 'Select Categories'
                      : `${selectedCategories.length} ${selectedCategories.length === 1 ? 'Category' : 'Categories'} Selected`}
                  </span>
                </div>
                <div className="text-xs text-gray-400">Click to select</div>
              </button>
              {selectedCategories.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {restaurantCategories
                    .filter(cat => selectedCategories.includes(cat.id))
                    .map(cat => (
                      <span key={cat.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-100 text-blue-700">
                        {cat.name}
                      </span>
                    ))}
                </div>
              )}
            </div>

            {/* Menu add-ons (customer app customise sheet) */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Menu Add-ons (User App)
              </label>
              <button
                type="button"
                onClick={() => setShowAddonModal(true)}
                className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border-2 border-gray-200 bg-white hover:border-[#B32B2C] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <PlusCircle size={18} className="text-[#B32B2C]" />
                  <span className="text-sm font-medium text-gray-700">
                    {selectedAddonKeys.length === 0
                      ? 'Select Add-ons (optional)'
                      : `${selectedAddonKeys.length} add-on${selectedAddonKeys.length === 1 ? '' : 's'} selected`}
                  </span>
                </div>
                <div className="text-xs text-gray-400">Click to assign</div>
              </button>
              {selectedAddonKeys.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {catalogAddonOptions
                    .filter(a => selectedAddonKeys.includes(a.catalogKey))
                    .map(a => (
                      <span key={a.catalogKey} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-100 text-amber-800">
                        {a.name} · {formatCurrency(a.price)}
                      </span>
                    ))}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1.5">
                Shown when customers customise items in the TastyKart user app for this restaurant.
              </p>
            </div>

            {/* File Upload to Firebase Storage */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Upload Logo Image (Firebase Storage)
              </label>
              <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-gray-300 bg-gray-50">
                <Upload size={20} className="text-[#B32B2C]" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => setImageFile(e.target.files?.[0] || null)}
                  className="text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#B32B2C] file:text-white hover:file:bg-red-700 cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end mt-5 pt-4 border-t border-gray-100">
            <Button variant="secondary" type="button" onClick={() => { setShowAdd(false); resetRestaurantForm() }}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={15} className="animate-spin" /> Saving to Firestore & Storage...
                </span>
              ) : (
                'Save Restaurant to Firestore'
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Restaurant Modal */}
      <Modal open={!!editTarget} onClose={() => { setEditTarget(null); resetRestaurantForm() }} title="Edit Restaurant" size="lg">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Restaurant Name *"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Spice Garden"
              required
            />
            <Input
              label="Cuisine Type"
              value={formData.cuisine}
              onChange={e => setFormData({ ...formData, cuisine: e.target.value })}
              placeholder="e.g. North Indian, Chinese"
            />
            <Input
              label="Owner Name"
              value={formData.owner}
              onChange={e => setFormData({ ...formData, owner: e.target.value })}
              placeholder="Full name"
            />
            <Input
              label="Phone"
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+91 XXXXX XXXXX"
            />
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              placeholder="restaurant@mail.com"
            />
            <Input
              label="Address"
              value={selectedLocation?.address || ''}
              readOnly
              placeholder="Filled from the map location"
              className="bg-gray-50 cursor-default"
            />

            {/* Location Picker - Edit Form */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Restaurant Location on Map *
              </label>
              <button
                type="button"
                onClick={() => setShowMapPicker(true)}
                className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border-2 border-gray-200 bg-white hover:border-[#B32B2C] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <MapPin size={18} className="text-[#B32B2C]" />
                  <span className="text-sm font-medium text-gray-700">
                    {selectedLocation
                      ? 'Change Location on Map'
                      : 'Select Location on Map'}
                  </span>
                </div>
                <div className="text-xs text-gray-400">Click to open map</div>
              </button>
              {selectedLocation ? (
                <div className="mt-2 p-3 rounded-xl bg-green-50 border border-green-200">
                  <div className="flex items-start gap-2">
                    <MapPin size={16} className="text-green-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-1">Location Selected</p>
                      <p className="text-sm text-gray-900 font-medium break-words">{selectedLocation.address}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Lat: {selectedLocation.latitude.toFixed(6)}, Lng: {selectedLocation.longitude.toFixed(6)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                  <MapPin size={12} /> Location not selected yet — please pick a location on the map before saving
                </p>
              )}
            </div>

            <Input
              label="Opening Hours"
              value={formData.openingHours}
              onChange={e => setFormData({ ...formData, openingHours: e.target.value })}
              placeholder="10:00 AM - 11:00 PM"
            />
            <Input
              label="Delivery Time"
              value={formData.deliveryTime}
              onChange={e => setFormData({ ...formData, deliveryTime: e.target.value })}
              placeholder="30-45 min"
            />
            <Input
              label="Min Order (₹)"
              type="number"
              value={formData.minOrder}
              onChange={e => setFormData({ ...formData, minOrder: e.target.value })}
              placeholder="200"
            />
            <Select
              label="Status"
              value={formData.status}
              onChange={e => setFormData({ ...formData, status: e.target.value as any })}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
            <label className="sm:col-span-2 flex items-start gap-3 p-3 rounded-xl border border-gray-200 bg-white cursor-pointer">
              <input
                type="checkbox"
                checked={formData.popular}
                onChange={e => setFormData({ ...formData, popular: e.target.checked })}
                className="mt-0.5 h-4 w-4 accent-[#B32B2C]"
              />
              <span>
                <span className="block text-sm font-semibold text-gray-900">Popular restaurant</span>
                <span className="block text-xs text-gray-500 mt-0.5">Shown under Popular restaurants when a customer opens search in the app.</span>
              </span>
            </label>

            {/* Restaurant Categories */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Restaurant Categories *
              </label>
              <button
                type="button"
                onClick={() => setShowCategoryModal(true)}
                className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border-2 border-gray-200 bg-white hover:border-[#B32B2C] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Tag size={18} className="text-[#B32B2C]" />
                  <span className="text-sm font-medium text-gray-700">
                    {selectedCategories.length === 0
                      ? 'Select Categories'
                      : `${selectedCategories.length} ${selectedCategories.length === 1 ? 'Category' : 'Categories'} Selected`}
                  </span>
                </div>
                <div className="text-xs text-gray-400">Click to select</div>
              </button>
              {selectedCategories.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {restaurantCategories
                    .filter(cat => selectedCategories.includes(cat.id))
                    .map(cat => (
                      <span key={cat.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-100 text-blue-700">
                        {cat.name}
                      </span>
                    ))}
                </div>
              )}
            </div>

            {/* Menu add-ons (customer app customise sheet) */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Menu Add-ons (User App)
              </label>
              <button
                type="button"
                onClick={() => setShowAddonModal(true)}
                className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border-2 border-gray-200 bg-white hover:border-[#B32B2C] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <PlusCircle size={18} className="text-[#B32B2C]" />
                  <span className="text-sm font-medium text-gray-700">
                    {selectedAddonKeys.length === 0
                      ? 'No add-ons assigned'
                      : `${selectedAddonKeys.length} add-on${selectedAddonKeys.length === 1 ? '' : 's'} assigned`}
                  </span>
                </div>
                <div className="text-xs text-gray-400">Click to manage</div>
              </button>
              {selectedAddonKeys.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {catalogAddonOptions
                    .filter(a => selectedAddonKeys.includes(a.catalogKey))
                    .map(a => (
                      <span key={a.catalogKey} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-100 text-amber-800">
                        {a.name} · {formatCurrency(a.price)}
                      </span>
                    ))}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1.5">
                Customers see these in the add-on sheet when ordering from this restaurant.
              </p>
            </div>

            {/* File Upload to Firebase Storage */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Upload Logo Image (Firebase Storage)
              </label>
              <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-gray-300 bg-gray-50">
                <Upload size={20} className="text-[#B32B2C]" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => setImageFile(e.target.files?.[0] || null)}
                  className="text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#B32B2C] file:text-white hover:file:bg-red-700 cursor-pointer"
                />
              </div>
              {editTarget?.logo && !imageFile && (
                <div className="mt-2 flex items-center gap-2">
                  <img src={editTarget.logo} alt="Current logo" className="w-10 h-10 rounded-lg object-cover" />
                  <span className="text-xs text-gray-500">Current logo (upload new to replace)</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 justify-end mt-5 pt-4 border-t border-gray-100">
            <Button variant="secondary" type="button" onClick={() => { setEditTarget(null); resetRestaurantForm() }}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={15} className="animate-spin" /> Updating in Firestore...
                </span>
              ) : (
                'Update Restaurant'
              )}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Restaurant"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This will delete the document from Firestore.`}
        confirmLabel="Delete Document"
        variant="danger"
      />

      {/* Add-on assignment modal */}
      <Modal
        open={showAddonModal}
        onClose={() => setShowAddonModal(false)}
        title="Assign Menu Add-ons"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Pick extras customers can add when customising food items. Options come from your global{' '}
            <span className="font-semibold text-gray-800">Add-ons</span> catalog; saving the restaurant
            creates active Firestore docs with this restaurant&apos;s ID for the user app.
          </p>

          {catalogAddonOptions.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
              <p className="text-sm text-gray-500">No add-ons in the catalog yet.</p>
              <p className="text-xs text-gray-400 mt-1">Create add-ons under Menu → Add-ons first.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              <p className="text-xs text-gray-400">{catalogAddonOptions.length} add-ons</p>
              {catalogAddonOptions.map(addon => {
                const isSelected = selectedAddonKeys.includes(addon.catalogKey)
                return (
                  <button
                    key={addon.catalogKey}
                    type="button"
                    onClick={() => {
                      setSelectedAddonKeys(prev =>
                        isSelected
                          ? prev.filter(k => k !== addon.catalogKey)
                          : [...prev, addon.catalogKey],
                      )
                    }}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? 'border-[#B32B2C] bg-red-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                      isSelected ? 'border-[#B32B2C] bg-[#B32B2C]' : 'border-gray-300'
                    }`}>
                      {isSelected && <Check size={14} className="text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${isSelected ? 'text-[#B32B2C]' : 'text-gray-900'}`}>
                        {addon.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatCurrency(addon.price)}
                        {addon.category ? ` · ${addon.category}` : ''}
                        {addon.restaurantName ? ` · from ${addon.restaurantName}` : ''}
                      </p>
                    </div>
                    {addon.usageCount > 1 && (
                      <span className="text-[10px] text-gray-400 shrink-0">{addon.usageCount} venues</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <span className="text-sm text-gray-600">
              {selectedAddonKeys.length} selected for user app
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedAddonKeys([])}
                disabled={selectedAddonKeys.length === 0}
              >
                Clear All
              </Button>
              <Button variant="primary" size="sm" onClick={() => setShowAddonModal(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Category Selection Modal */}
      <Modal
        open={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title="Select Restaurant Categories"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Select the categories that best describe this restaurant. Users will be able to discover this restaurant by browsing these categories in the app.
          </p>
          
          {restaurantCategories.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">No restaurant categories available.</p>
              <p className="text-xs text-gray-400 mt-1">Add categories in Restaurant Categories page first.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto">
              {restaurantCategories.map((category) => {
                const isSelected = selectedCategories.includes(category.id)
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedCategories(prev => prev.filter(id => id !== category.id))
                      } else {
                        setSelectedCategories(prev => [...prev, category.id])
                      }
                    }}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-[#B32B2C] bg-red-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'border-[#B32B2C] bg-[#B32B2C]'
                        : 'border-gray-300'
                    }`}>
                      {isSelected && <Check size={14} className="text-white" />}
                    </div>
                    
                    {category.icon && (
                      <span className="text-2xl">{category.icon}</span>
                    )}
                    
                    <div className="flex-1 text-left">
                      <p className={`text-sm font-semibold ${isSelected ? 'text-[#B32B2C]' : 'text-gray-900'}`}>
                        {category.name}
                      </p>
                      {category.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{category.description}</p>
                      )}
                    </div>
                    
                    <span className="text-xs text-gray-400">
                      {categoryRestaurantCount(category)} restaurants
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <span className="text-sm text-gray-600">
              {selectedCategories.length} {selectedCategories.length === 1 ? 'category' : 'categories'} selected
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedCategories([])}
                disabled={selectedCategories.length === 0}
              >
                Clear All
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowCategoryModal(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Map Location Picker Modal */}
      <Modal
        open={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        title="Select Restaurant Location on Map"
        size="xl"
      >
        <GoogleMapPicker
          initialLocation={selectedLocation || undefined}
          onLocationSelect={(location) => {
            setSelectedLocation(location)
            setFormData(current => ({ ...current, address: location.address }))
            setShowMapPicker(false)
          }}
          onCancel={() => setShowMapPicker(false)}
        />
      </Modal>
    </div>
  )
}