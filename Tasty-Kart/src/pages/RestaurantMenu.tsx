import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { ArrowLeft, Plus, Edit, Trash2, Loader2, UtensilsCrossed, Gift } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, cn } from '@/lib/utils'
import type { Addon, FoodCategory, FoodItem, Restaurant } from '@/data/dummy'
import {
  subscribeToCollection,
  addDocumentToFirestore,
  updateDocumentInFirestore,
  deleteDocumentFromFirestore,
  uploadImageToStorage,
} from '@/lib/firebaseService'
import { normalizeFoodItemVegFields } from '@/lib/foodItemUtils'
import type { FoodType } from '@/lib/foodItemUtils'
import { VegNonVegPicker, VegNonVegBadge } from '@/components/shared/VegNonVegPicker'

type Tab = 'categories' | 'items' | 'addons' | 'offers'
type Offer = Record<string, any> & { id: string }
type ApplyScope = 'all' | 'categories' | 'items'
type OfferModalMode = 'apply' | 'create'

function offerScopeLabel(offer: Offer): string {
  const itemIds = Array.isArray(offer.foodItemIds) ? offer.foodItemIds : []
  if (itemIds.length > 0) {
    return offer.foodItemNames?.length
      ? offer.foodItemNames.join(', ')
      : `${itemIds.length} menu item(s)`
  }
  const catIds = Array.isArray(offer.categoryIds) ? offer.categoryIds : []
  if (catIds.length > 0) {
    return offer.categoryNames?.join(', ') || `${catIds.length} categories`
  }
  return 'All menu items'
}

function isGlobalPlatformOffer(o: Offer): boolean {
  if (o.restaurantId) return false
  const name = (o.restaurantName || '').trim()
  return !name || name === 'All Restaurants'
}

function itemsMatchingOfferScope(
  menuItems: FoodItem[],
  applyScope: ApplyScope,
  categoryIds: string[],
  foodItemIds: string[],
): FoodItem[] {
  const active = menuItems.filter(i => i.status !== 'inactive')
  if (applyScope === 'all') return active
  if (applyScope === 'items' && foodItemIds.length > 0) {
    return active.filter(i => foodItemIds.includes(i.id))
  }
  if (applyScope === 'categories' && categoryIds.length > 0) {
    return active.filter(i => categoryIds.includes(i.categoryId))
  }
  return []
}

export function RestaurantMenu() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { success, error: toastError } = useToast()

  // Jump to offers tab when navigated from the Restaurants list "Offers" cell.
  const initialTab = (new URLSearchParams(location.search).get('tab') as Tab | null) ?? 'categories'

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [categories, setCategories] = useState<FoodCategory[]>([])  // Start empty - only refilter effect sets this
  const [items, setItems] = useState<FoodItem[]>([])
  const [addons, setAddons] = useState<Addon[]>([])
  const [allOffers, setAllOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>(initialTab)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── Add-category modal: mode toggle ────────────────────────────────────────
  // 'new'      → create a brand-new category for this restaurant
  // 'existing' → pick from globally existing foodCategories (any restaurant)
  const [catModalMode, setCatModalMode] = useState<'new' | 'existing'>('new')
  // All categories across ALL restaurants — populated for the "existing" picker
  const [allCategories, setAllCategories] = useState<FoodCategory[]>([])

  // ── Add-on catalog selection ───────────────────────────────────────────────
  // All catalog add-ons (global add-ons without restaurantId)
  const [catalogAddons, setCatalogAddons] = useState<Addon[]>([])
  const [selectedCatalogAddonIds, setSelectedCatalogAddonIds] = useState<string[]>([])

  // Modals
  const [showCatModal, setShowCatModal] = useState(false)
  const [editCat, setEditCat] = useState<FoodCategory | null>(null)
  const [deleteCat, setDeleteCat] = useState<FoodCategory | null>(null)
  const [catForm, setCatForm] = useState({ name: '', icon: '🥗', description: '', status: 'active' as 'active' | 'inactive' })

  const [showItemModal, setShowItemModal] = useState(false)
  const [editItem, setEditItem] = useState<FoodItem | null>(null)
  const [deleteItem, setDeleteItem] = useState<FoodItem | null>(null)
  const [itemForm, setItemForm] = useState({
    name: '', categoryId: '', price: '200', discountedPrice: '', preparationTime: '20',
    foodType: 'veg', status: 'active' as 'active' | 'inactive', description: '', ingredients: '',
  })
  const [itemImage, setItemImage] = useState<File | null>(null)

  const [showAddonModal, setShowAddonModal] = useState(false)
  const [editAddon, setEditAddon] = useState<Addon | null>(null)
  const [deleteAddon, setDeleteAddon] = useState<Addon | null>(null)
  const [addonForm, setAddonForm] = useState({
    name: '', price: '30', category: 'Extras', status: 'active' as 'active' | 'inactive', description: '',
  })

  // Offer modals
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [editOffer, setEditOffer] = useState<Offer | null>(null)
  const [deleteOffer, setDeleteOffer] = useState<Offer | null>(null)
  const emptyOfferForm = () => ({
    name: '', type: 'percentage', discount: '', validTill: '', status: 'active', applyScope: 'all' as ApplyScope,
  })
  const [offerForm, setOfferForm] = useState<Record<string, string>>(emptyOfferForm())
  const [offerCategoryIds, setOfferCategoryIds] = useState<string[]>([])
  const [offerFoodItemIds, setOfferFoodItemIds] = useState<string[]>([])
  const [offerModalMode, setOfferModalMode] = useState<OfferModalMode>('apply')

  useEffect(() => {
    if (!id) return
    const unsubs = [
      subscribeToCollection<Restaurant>('restaurants', (list) => {
        // Match by doc path id OR body id field (legacy docs)
        const found = list.find(r => r.id === id || (r as any)._bodyId === id) || null
        setRestaurant(found)
        setLoading(false)
      }),
      subscribeToCollection<FoodCategory>('foodCategories', (list) => {
        setAllCategories(list)
        setAllRawCategories(list)
      }),
      subscribeToCollection<FoodItem>('foodItems', (list) => {
        setAllRawItems(list)
        setItems(list.filter(i => i.restaurantId === id))
      }),
      subscribeToCollection<Addon>('addons', (list) => {
        setAddons(list.filter(a => a.restaurantId === id))
        // Catalog add-ons are those without restaurantId (global add-ons)
        setCatalogAddons(list.filter(a => !a.restaurantId).sort((a, b) => a.name.localeCompare(b.name)))
      }),
      subscribeToCollection<Offer>('offers', setAllOffers),
    ]
    return () => unsubs.forEach(fn => fn())
  }, [id])

  // Re-filter categories and items when restaurant doc loads,
  // because if the doc path ID (d.id) differs from the body 'id' field
  // (legacy docs), the subscription may have already fired with the
  // allCategories/allItems list before restaurant was resolved.
  // This effect ensures the filter is re-applied with restaurant.id.
  const [allRawCategories, setAllRawCategories] = useState<FoodCategory[]>([])
  const [allRawItems, setAllRawItems] = useState<FoodItem[]>([])

  // Immediate filter effect - runs as soon as allRawCategories updates
  useEffect(() => {
    if (allRawCategories.length === 0) {
      setCategories([])
      return
    }
    
    // If restaurant hasn't loaded yet, filter by URL id only (best effort)
    if (!restaurant) {
      const mine = allRawCategories
        .filter(c => c.restaurantId === id)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      setCategories(mine)
      return
    }

    // Restaurant loaded - use comprehensive ID matching
    const restaurantIds = new Set([
      id,
      restaurant.id,
      (restaurant as any)._bodyId,
    ].filter(Boolean))
    const mine = allRawCategories
      .filter(c => restaurantIds.has(c.restaurantId))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    
    setCategories(mine)
    
    setSelectedCategoryId(prev => {
      if (prev && mine.some(c => c.id === prev)) return prev
      if (mine.length === 0) return prev
      return mine[0]?.id ?? null
    })
  }, [restaurant, allRawCategories, id])

  useEffect(() => {
    if (!restaurant || allRawItems.length === 0) return
    const restaurantIds = new Set([
      id,
      restaurant.id,
      (restaurant as any)._bodyId,
    ].filter(Boolean))
    setItems(allRawItems.filter(i => restaurantIds.has(i.restaurantId)))
  }, [restaurant, allRawItems, id])

  const offers = useMemo(() => {
    if (!restaurant) return []
    return allOffers.filter(
      o => o.restaurantId === restaurant.id || o.restaurantName === restaurant.name,
    )
  }, [allOffers, restaurant])

  const globalOffers = useMemo(
    () => allOffers.filter(isGlobalPlatformOffer),
    [allOffers],
  )

  const appliedGlobalSourceIds = useMemo(
    () => new Set(offers.map(o => o.sourceOfferId).filter(Boolean) as string[]),
    [offers],
  )

  const globalOffersAvailable = useMemo(
    () => globalOffers.filter(o => !appliedGlobalSourceIds.has(o.id)),
    [globalOffers, appliedGlobalSourceIds],
  )

  const previewItemsForForm = useMemo(() => {
    const scope = (offerForm.applyScope || 'all') as ApplyScope
    return itemsMatchingOfferScope(items, scope, offerCategoryIds, offerFoodItemIds)
  }, [items, offerForm.applyScope, offerCategoryIds, offerFoodItemIds])

  const selectedCategory = useMemo(
    () => categories.find(c => c.id === selectedCategoryId) || null,
    [categories, selectedCategoryId]
  )

  const itemsInCategory = useMemo(
    () => items.filter(i => i.categoryId === selectedCategoryId),
    [items, selectedCategoryId]
  )

  const itemCountByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    items.forEach(i => {
      if (i.categoryId) map[i.categoryId] = (map[i.categoryId] || 0) + 1
    })
    return map
  }, [items])

  // ─── Categories CRUD ───────────────────────────────────────────────────────
  const openAddCat = () => {
    setEditCat(null)
    setCatForm({ name: '', icon: '🥗', description: '', status: 'active' })
    setCatModalMode('new')
    setShowCatModal(true)
  }

  const openEditCat = (cat: FoodCategory) => {
    setEditCat(cat)
    setCatForm({
      name: cat.name,
      icon: cat.icon || '🥗',
      description: cat.description || '',
      status: cat.status,
    })
    setCatModalMode('new')
    setShowCatModal(true)
  }

  // Auto-select first category when switching to the items tab
  // (handles the case where tab is set before subscription fires)
  useEffect(() => {
    if (tab === 'items' && !selectedCategoryId && categories.length > 0) {
      setSelectedCategoryId(categories[0].id)
    }
  }, [tab, selectedCategoryId, categories])
  const [selectedExistingCatId, setSelectedExistingCatId] = useState<string>('')

  const saveCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!restaurant) return

    // ── 'existing' mode: clone a category from another restaurant ─────────
    if (catModalMode === 'existing' && !editCat) {
      const source = allCategories.find(c => c.id === selectedExistingCatId)
      if (!source) { toastError('Select a category', 'Please choose a category to add'); return }
      // Check if this restaurant already has a category with the same name
      const alreadyExists = categories.some(
        c => c.name.toLowerCase() === source.name.toLowerCase()
      )
      if (alreadyExists) {
        toastError('Already exists', `"${source.name}" is already in this restaurant's menu`)
        return
      }
      setIsSubmitting(true)
      try {
        const payload = {
          id: `cat_${restaurant.id}_${source.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          name: source.name,
          icon: source.icon || '🥗',
          description: source.description || '',
          sortOrder: categories.length,
          itemCount: 0,
          status: 'active' as const,
        }
        const res = await addDocumentToFirestore('foodCategories', payload)
        if (res.success) {
          success('Category Added', `"${payload.name}" added to ${restaurant.name}`)
          setShowCatModal(false)
          setSelectedExistingCatId('')
        } else toastError('Save Failed', 'Could not add category')
      } catch (err: any) {
        toastError('Error', err?.message || 'Failed to save')
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    // ── 'new' mode: create or edit ────────────────────────────────────────
    if (!catForm.name.trim()) return
    setIsSubmitting(true)
    try {
      const payload = {
        id: editCat?.id || `cat_${restaurant.id}_${Date.now()}`,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        name: catForm.name.trim(),
        icon: catForm.icon || '🥗',
        description: catForm.description,
        sortOrder: editCat?.sortOrder ?? categories.length,
        itemCount: editCat ? (itemCountByCategory[editCat.id] || 0) : 0,
        status: catForm.status,
      }
      const res = await addDocumentToFirestore('foodCategories', payload)
      if (res.success) {
        success(editCat ? 'Category Updated' : 'Category Added', `"${payload.name}" saved for ${restaurant.name}`)
        setShowCatModal(false)
      } else toastError('Save Failed', 'Could not save category')
    } catch (err: any) {
      toastError('Error', err?.message || 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }

  const confirmDeleteCat = async () => {
    if (!deleteCat) return
    const linked = items.filter(i => i.categoryId === deleteCat.id)
    if (linked.length > 0) {
      toastError('Cannot Delete', `Remove or move ${linked.length} food item(s) first`)
      setDeleteCat(null)
      return
    }
    const res = await deleteDocumentFromFirestore('foodCategories', deleteCat.id)
    if (res.success) success('Deleted', `"${deleteCat.name}" removed`)
    else toastError('Delete Failed', String(res.error))
    setDeleteCat(null)
  }

  // ─── Food Items CRUD ───────────────────────────────────────────────────────
  const openAddItem = () => {
    setEditItem(null)
    setItemForm({
      name: '',
      categoryId: selectedCategoryId || categories[0]?.id || '',
      price: '200',
      discountedPrice: '',
      preparationTime: '20',
      foodType: 'veg',
      status: 'active',
      description: '',
      ingredients: '',
    })
    setItemImage(null)
    setShowItemModal(true)
  }

  const openEditItem = (item: FoodItem) => {
    setEditItem(item)
    setItemForm({
      name: item.name,
      categoryId: item.categoryId,
      price: String(item.price),
      discountedPrice: item.discountedPrice != null ? String(item.discountedPrice) : '',
      preparationTime: String(item.preparationTime ?? 20),
      foodType: item.foodType ?? (item.isVeg ? 'veg' : 'nonveg'),
      status: item.status,
      description: item.description || '',
      ingredients: item.ingredients || '',
    })
    setItemImage(null)
    setShowItemModal(true)
  }

  const saveItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!restaurant || !itemForm.name.trim() || !itemForm.categoryId) {
      toastError('Validation', 'Name and category are required')
      return
    }
    const cat = categories.find(c => c.id === itemForm.categoryId)
    if (!cat) {
      toastError('Validation', 'Select a valid category')
      return
    }
    setIsSubmitting(true)
    try {
      let imageUrl = editItem?.image || editItem?.imageUrl || ''
      if (itemImage) imageUrl = await uploadImageToStorage(itemImage, 'foodItems')

      const vegFields = normalizeFoodItemVegFields({
        foodType: itemForm.foodType as FoodType,
        isVeg: itemForm.foodType === 'veg',
        tags: [itemForm.foodType, cat.name.toLowerCase()],
      })

      const payload: FoodItem = {
        id: editItem?.id || `food_${Date.now()}`,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        categoryId: cat.id,
        categoryName: cat.name,
        name: itemForm.name.trim(),
        image: imageUrl,
        imageUrl,
        price: Number(itemForm.price) || 0,
        discountedPrice: itemForm.discountedPrice ? Number(itemForm.discountedPrice) : undefined,
        preparationTime: Number(itemForm.preparationTime) || 20,
        ...vegFields,
        status: itemForm.status,
        description: itemForm.description,
        ingredients: itemForm.ingredients,
        rating: editItem?.rating ?? 0,
        totalRatings: editItem?.totalRatings ?? 0,
        available: true,
        inStock: true,
      }

      const res = editItem
        ? await updateDocumentInFirestore('foodItems', editItem.id, payload)
        : await addDocumentToFirestore('foodItems', payload)

      if (res.success) {
        await updateDocumentInFirestore('foodCategories', cat.id, {
          itemCount: items.filter(i => i.categoryId === cat.id && i.id !== payload.id).length + 1,
        })
        success(editItem ? 'Item Updated' : 'Item Added', `"${payload.name}" saved`)
        setShowItemModal(false)
        setTab('items')
        setSelectedCategoryId(cat.id)
      } else toastError('Save Failed', 'Could not save food item')
    } catch (err: any) {
      toastError('Error', err?.message || 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }

  const confirmDeleteItem = async () => {
    if (!deleteItem) return
    const res = await deleteDocumentFromFirestore('foodItems', deleteItem.id)
    if (res.success) {
      success('Deleted', `"${deleteItem.name}" removed`)
      if (deleteItem.categoryId) {
        const remaining = items.filter(i => i.categoryId === deleteItem.categoryId && i.id !== deleteItem.id).length
        await updateDocumentInFirestore('foodCategories', deleteItem.categoryId, { itemCount: remaining })
      }
    } else toastError('Delete Failed', String(res.error))
    setDeleteItem(null)
  }

  // ─── Addons CRUD ───────────────────────────────────────────────────────────
  const openAddAddon = () => {
    setEditAddon(null)
    setSelectedCatalogAddonIds([])
    setAddonForm({ name: '', price: '30', category: 'Extras', status: 'active', description: '' })
    setShowAddonModal(true)
  }

  const openEditAddon = (addon: Addon) => {
    setEditAddon(addon)
    setAddonForm({
      name: addon.name,
      price: String(addon.price),
      category: addon.category || 'Extras',
      status: addon.status,
      description: addon.description || '',
    })
    setShowAddonModal(true)
  }

  const saveAddon = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!restaurant) return

    setIsSubmitting(true)
    try {
      // Edit mode - update existing add-on
      if (editAddon) {
        if (!addonForm.name.trim()) {
          toastError('Validation', 'Add-on name is required')
          setIsSubmitting(false)
          return
        }

        const payload = {
          id: editAddon.id,
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          foodItemId: editAddon.foodItemId ?? null,
          name: addonForm.name.trim(),
          price: Number(addonForm.price) || 0,
          category: addonForm.category,
          status: addonForm.status,
          description: addonForm.description,
        }
        const res = await updateDocumentInFirestore('addons', editAddon.id, payload)
        if (res.success) {
          success('Add-on Updated', `"${payload.name}" saved`)
          setShowAddonModal(false)
        } else {
          toastError('Save Failed', 'Could not save add-on')
        }
      }
      // Add mode - copy selected catalog add-ons to this restaurant
      else {
        if (selectedCatalogAddonIds.length === 0) {
          toastError('Validation', 'Please select at least one add-on')
          setIsSubmitting(false)
          return
        }

        const selectedAddons = catalogAddons.filter(a => selectedCatalogAddonIds.includes(a.id))
        const results = await Promise.all(
          selectedAddons.map(async (catalogAddon) => {
            const payload = {
              id: `add_${restaurant.id}_${catalogAddon.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
              restaurantId: restaurant.id,
              restaurantName: restaurant.name,
              foodItemId: null,
              name: catalogAddon.name,
              price: catalogAddon.price,
              category: catalogAddon.category,
              status: 'active' as const,
              description: catalogAddon.description || '',
            }
            return addDocumentToFirestore('addons', payload)
          })
        )

        const failed = results.filter(r => !r.success)
        if (failed.length === 0) {
          success('Add-ons Added', `${selectedAddons.length} add-on(s) added to "${restaurant.name}"`)
          setShowAddonModal(false)
          setSelectedCatalogAddonIds([])
        } else {
          toastError('Some Failed', `${failed.length} add-on(s) could not be added`)
        }
      }
    } catch (err: any) {
      toastError('Error', err?.message || 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }

  const confirmDeleteAddon = async () => {
    if (!deleteAddon) return
    const res = await deleteDocumentFromFirestore('addons', deleteAddon.id)
    if (res.success) success('Deleted', `"${deleteAddon.name}" removed`)
    else toastError('Delete Failed', String(res.error))
    setDeleteAddon(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500 gap-2">
        <Loader2 className="animate-spin" size={20} /> Loading menu…
      </div>
    )
  }

  if (!restaurant) {
    return (
      <div className="text-center py-24 space-y-3">
        <p className="text-gray-600 font-medium">Restaurant not found</p>
        <Button variant="secondary" onClick={() => navigate('/restaurants')}>Back to Restaurants</Button>
      </div>
    )
  }

  // ─── Offers CRUD ──────────────────────────────────────────────────────────
  const openAddOffer = () => {
    setEditOffer(null)
    setOfferForm(emptyOfferForm())
    setOfferCategoryIds([])
    setOfferFoodItemIds([])
    setOfferModalMode(offers.length > 0 || globalOffersAvailable.length > 0 ? 'apply' : 'create')
    setShowOfferModal(true)
  }

  const openEditOffer = (o: Offer) => {
    setEditOffer(o)
    const itemIds = Array.isArray(o.foodItemIds) ? o.foodItemIds : []
    const catIds = Array.isArray(o.categoryIds) ? o.categoryIds : []
    let applyScope: ApplyScope = 'all'
    if (itemIds.length > 0) applyScope = 'items'
    else if (catIds.length > 0) applyScope = 'categories'
    setOfferForm({
      name: o.name || o.title || '',
      type: o.type || 'percentage',
      discount: String(o.discount ?? ''),
      validTill: o.validTill || o.expiry || '',
      status: o.status || 'active',
      applyScope,
    })
    setOfferCategoryIds(catIds)
    setOfferFoodItemIds(itemIds)
    setOfferModalMode('create')
    setShowOfferModal(true)
  }

  const buildOfferPayload = (
    base: {
      name: string
      type: string
      discount: number
      validTill: string
      status: string
      applyScope: ApplyScope
      categoryIds: string[]
      foodItemIds: string[]
      sourceOfferId?: string
    },
  ) => {
    if (!restaurant) return null
    const scope = base.applyScope
    const categoryIds = scope === 'categories' ? base.categoryIds : []
    const foodItemIds = scope === 'items' ? base.foodItemIds : []
    const categoryNames =
      categoryIds.length > 0
        ? categories.filter(c => categoryIds.includes(c.id)).map(c => c.name)
        : []
    const foodItemNames =
      foodItemIds.length > 0
        ? items.filter(i => foodItemIds.includes(i.id)).map(i => i.name)
        : []
    return {
      name: base.name.trim(),
      title: base.name.trim(),
      type: base.type,
      discount: base.discount,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      validTill: base.validTill,
      expiry: base.validTill,
      status: base.status,
      categoryIds,
      categoryNames,
      foodItemIds,
      foodItemNames,
      ...(base.sourceOfferId ? { sourceOfferId: base.sourceOfferId } : {}),
    }
  }

  const applyExistingOffer = async (source: Offer) => {
    if (!restaurant) return
    setIsSubmitting(true)
    try {
      // Platform-wide templates apply to all items at this restaurant (IDs differ per venue).
      const isGlobal = isGlobalPlatformOffer(source)
      const itemIds = isGlobal ? [] : (Array.isArray(source.foodItemIds) ? source.foodItemIds : [])
      const catIds = isGlobal ? [] : (Array.isArray(source.categoryIds) ? source.categoryIds : [])
      let applyScope: ApplyScope = 'all'
      if (itemIds.length > 0) applyScope = 'items'
      else if (catIds.length > 0) applyScope = 'categories'
      const payload = buildOfferPayload({
        name: source.name || source.title || 'Offer',
        type: source.type || 'percentage',
        discount: Number(source.discount) || 0,
        validTill: source.validTill || source.expiry || '',
        status: 'active',
        applyScope,
        categoryIds: catIds,
        foodItemIds: itemIds,
        sourceOfferId: source.id,
      })
      if (!payload) return
      const res = await addDocumentToFirestore('offers', payload)
      if (res.success) {
        success('Offer applied', `"${payload.name}" is live in the user app for ${restaurant.name}`)
        setShowOfferModal(false)
      } else toastError('Apply failed', 'Could not assign offer to this restaurant')
    } catch (err: any) {
      toastError('Error', err?.message || 'Failed to apply offer')
    } finally {
      setIsSubmitting(false)
    }
  }

  const saveOffer = async () => {
    if (!offerForm.name.trim() || !restaurant) return
    const applyScope = (offerForm.applyScope || 'all') as ApplyScope
    if (applyScope === 'categories' && offerCategoryIds.length === 0) {
      toastError('Validation', 'Select at least one category, or choose All menu items')
      return
    }
    if (applyScope === 'items' && offerFoodItemIds.length === 0) {
      toastError('Validation', 'Select at least one food item, or change Apply To scope')
      return
    }
    setIsSubmitting(true)
    try {
      const payload = buildOfferPayload({
        name: offerForm.name.trim(),
        type: offerForm.type,
        discount: Number(offerForm.discount) || 0,
        validTill: offerForm.validTill,
        status: offerForm.status,
        applyScope,
        categoryIds: offerCategoryIds,
        foodItemIds: offerFoodItemIds,
      })
      if (!payload) return
      if (editOffer) {
        const res = await updateDocumentInFirestore('offers', editOffer.id, payload)
        if (res.success) success('Offer Updated', payload.name)
        else toastError('Update Failed', 'Could not update offer')
      } else {
        const res = await addDocumentToFirestore('offers', payload)
        if (res.success) success('Offer Created', payload.name)
        else toastError('Create Failed', 'Could not create offer')
      }
      setShowOfferModal(false)
    } catch (err: any) {
      toastError('Error', err?.message || 'Failed to save offer')
    } finally {
      setIsSubmitting(false)
    }
  }

  const confirmDeleteOffer = async () => {
    if (!deleteOffer) return
    const res = await deleteDocumentFromFirestore('offers', deleteOffer.id)
    if (res.success) success('Offer Deleted', deleteOffer.name || deleteOffer.title || 'Offer removed')
    else toastError('Delete Failed', 'Could not delete offer')
    setDeleteOffer(null)
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'categories', label: 'Categories', count: categories.length },
    { id: 'items', label: 'Food Items', count: items.length },
    { id: 'addons', label: 'Add-ons', count: addons.length },
    { id: 'offers', label: 'Offers', count: offers.length },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/restaurants')}
            className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <img
            src={restaurant.logo || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=100'}
            alt=""
            className="w-12 h-12 rounded-xl object-cover border border-gray-200 shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">{restaurant.name}</h1>
            <p className="text-sm text-gray-500 truncate">
              Menu · {restaurant.cuisine} · Categories → Items → Add-ons
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {tab === 'categories' && (
            <Button size="sm" icon={<Plus size={14} />} onClick={openAddCat}>Add Category</Button>
          )}
          {tab === 'items' && (
            <Button size="sm" icon={<Plus size={14} />} onClick={openAddItem} disabled={!categories.length}>
              Add Food Item
            </Button>
          )}
          {tab === 'addons' && (
            <Button size="sm" icon={<Plus size={14} />} onClick={openAddAddon}>Add Add-on</Button>
          )}
          {tab === 'offers' && (
            <Button size="sm" icon={<Gift size={14} />} onClick={openAddOffer}>Add Offer</Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit flex-wrap">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
              tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
            )}
          >
            {t.label}
            <span className="ml-1.5 text-xs font-bold text-gray-400">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Categories tab */}
      {tab === 'categories' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.length === 0 && (
            <div className="col-span-full text-center py-16 text-gray-500">
              <UtensilsCrossed className="mx-auto mb-3 text-gray-300" size={36} />
              <p className="font-medium">No categories yet</p>
              <p className="text-sm mt-1">Add Starters, Main Course, and more for this restaurant.</p>
              <Button className="mt-4" size="sm" icon={<Plus size={14} />} onClick={openAddCat}>Add Category</Button>
            </div>
          )}
          {categories.map(cat => (
            <div
              key={cat.id}
              className="border border-gray-200 rounded-2xl p-4 bg-white hover:border-[#B32B2C]/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-xl shrink-0">
                    {cat.icon || '🍽️'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{cat.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {itemCountByCategory[cat.id] || 0} items
                    </p>
                  </div>
                </div>
                <StatusBadge status={cat.status} />
              </div>
              {cat.description && (
                <p className="text-xs text-gray-500 mt-3 line-clamp-2">{cat.description}</p>
              )}
              <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setSelectedCategoryId(cat.id)
                    setTab('items')
                  }}
                >
                  View Items
                </Button>
                <button onClick={() => openEditCat(cat)} className="p-2 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50">
                  <Edit size={15} />
                </button>
                <button onClick={() => setDeleteCat(cat)} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Items tab */}
      {tab === 'items' && (
        <div className="flex flex-col lg:flex-row gap-4">
          <aside className="lg:w-56 shrink-0 space-y-1">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2 mb-2">Categories</p>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={cn(
                  'w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2',
                  selectedCategoryId === cat.id
                    ? 'bg-[#B32B2C]/10 text-[#B32B2C]'
                    : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                <span>{cat.icon || '🍽️'}</span>
                <span className="truncate flex-1">{cat.name}</span>
                <span className="text-xs text-gray-400">{itemCountByCategory[cat.id] || 0}</span>
              </button>
            ))}
            {!categories.length && (
              <p className="text-sm text-gray-400 px-2">Add a category first.</p>
            )}
          </aside>

          <div className="flex-1 space-y-3 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-gray-900">
                {selectedCategory ? selectedCategory.name : 'Select a category'}
              </h2>
              {selectedCategory && (
                <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={openAddItem}>
                  Add Item
                </Button>
              )}
            </div>

            {!selectedCategory && (
              <p className="text-sm text-gray-500 py-8 text-center">Choose a category on the left.</p>
            )}

            {selectedCategory && itemsInCategory.length === 0 && (
              <div className="text-center py-12 text-gray-500 border border-dashed border-gray-200 rounded-2xl">
                <p className="font-medium">No items in {selectedCategory.name}</p>
                <Button className="mt-3" size="sm" icon={<Plus size={14} />} onClick={openAddItem}>Add Food Item</Button>
              </div>
            )}

            {itemsInCategory.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 border border-gray-200 rounded-2xl bg-white"
              >
                <img
                  src={item.image || item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200'}
                  alt=""
                  className="w-14 h-14 rounded-xl object-cover shrink-0 border border-gray-100"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-gray-900 truncate">{item.name}</p>
                    <VegNonVegBadge foodType={item.foodType} isVeg={item.isVeg} />
                  </div>
                  <p className="text-sm text-gray-500">
                    {formatCurrency(item.discountedPrice ?? item.price)}
                    {item.discountedPrice != null && item.discountedPrice < item.price && (
                      <span className="ml-2 line-through text-gray-300 text-xs">
                        {formatCurrency(item.price)}
                      </span>
                    )}
                    <span className="mx-1.5 text-gray-300">·</span>
                    {item.preparationTime ?? 20} min
                  </p>
                </div>
                <StatusBadge status={item.status} />
                <button onClick={() => openEditItem(item)} className="p-2 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50">
                  <Edit size={15} />
                </button>
                <button onClick={() => setDeleteItem(item)} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add-ons tab */}
      {tab === 'addons' && (
        <div className="space-y-3">
          {addons.length === 0 && (
            <div className="text-center py-16 text-gray-500 border border-dashed border-gray-200 rounded-2xl">
              <p className="font-medium">No add-ons for this restaurant</p>
              <Button className="mt-3" size="sm" icon={<Plus size={14} />} onClick={openAddAddon}>Add Add-on</Button>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {addons.map(addon => (
              <div key={addon.id} className="border border-gray-200 rounded-2xl p-4 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{addon.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(addon.price)}</p>
                  </div>
                  <StatusBadge status={addon.status} />
                </div>
                <p className="text-lg font-bold text-gray-900 mt-3">{formatCurrency(addon.price)}</p>
                {addon.description && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{addon.description}</p>
                )}
                <div className="flex gap-1 mt-3 pt-3 border-t border-gray-100">
                  <button onClick={() => openEditAddon(addon)} className="p-2 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50">
                    <Edit size={15} />
                  </button>
                  <button onClick={() => setDeleteAddon(addon)} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Offers tab ─────────────────────────────────────────────────────── */}
      {tab === 'offers' && (
        <div className="space-y-3">
          {offers.length === 0 && (
            <div className="text-center py-16 text-gray-500 border border-dashed border-gray-200 rounded-2xl">
              <Gift size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="font-medium">No offers for this restaurant</p>
              <Button className="mt-3" size="sm" icon={<Gift size={14} />} onClick={openAddOffer}>Add Offer</Button>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {offers.map(offer => {
              const isExpired = offer.validTill && new Date(offer.validTill) < new Date()
              const catLabel = offerScopeLabel(offer)
              return (
              <div key={offer.id} className={`border rounded-2xl p-4 bg-white ${isExpired ? 'border-red-200 opacity-70' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">{offer.name || offer.title || 'Offer'}</p>
                    <p className="text-xs text-gray-400 mt-0.5 capitalize">{offer.type || 'percentage'} discount</p>
                  </div>
                  {isExpired
                    ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Expired</span>
                    : <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${offer.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{offer.status}</span>
                  }
                </div>
                <p className="text-2xl font-black text-[#B32B2C]">
                  {offer.type === 'fixed' ? `₹${offer.discount} OFF` : `${offer.discount}% OFF`}
                </p>
                <p className="text-xs text-indigo-600 font-medium mt-1.5">📂 {catLabel}</p>
                {(offer.validTill || offer.expiry) && (
                  <p className={`text-xs mt-0.5 ${isExpired ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                    {isExpired ? '⚠ Expired' : '📅 Valid till'} {offer.validTill || offer.expiry}
                  </p>
                )}
                <div className="flex gap-1 mt-3 pt-3 border-t border-gray-100">
                  <button onClick={() => openEditOffer(offer)} className="p-2 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50">
                    <Edit size={15} />
                  </button>
                  <button onClick={() => setDeleteOffer(offer)} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )})}
          </div>
        </div>
      )}

      {/* Offer Modal */}
      <Modal
        open={showOfferModal}
        onClose={() => setShowOfferModal(false)}
        title={editOffer ? 'Edit Offer' : 'Add Offer'}
        description={
          editOffer
            ? 'Changes apply to discounted prices shown in the customer app.'
            : 'Assign an existing offer or create one for this restaurant’s menu items.'
        }
        size="lg"
      >
        <div className="space-y-4">
          {!editOffer && (
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-full">
              {([
                { id: 'apply' as const, label: 'Existing offers' },
                { id: 'create' as const, label: 'Create new' },
              ]).map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setOfferModalMode(m.id)}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-semibold transition-colors',
                    offerModalMode === m.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {!editOffer && offerModalMode === 'apply' && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Active on this restaurant (customer app)
                </p>
                {offers.length === 0 ? (
                  <p className="text-sm text-gray-500 border border-dashed border-gray-200 rounded-xl p-4 text-center">
                    No offers yet. Create one or apply a platform offer below.
                  </p>
                ) : (
                  <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-52 overflow-y-auto">
                    {offers.map(o => (
                      <div key={o.id} className="flex items-center gap-3 px-4 py-3 bg-white">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{o.name || o.title}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {o.type === 'fixed' ? `₹${o.discount} OFF` : `${o.discount}% OFF`}
                            <span className="mx-1">·</span>
                            {offerScopeLabel(o)}
                          </p>
                        </div>
                        <StatusBadge status={o.status ?? 'active'} />
                        <button
                          type="button"
                          onClick={() => openEditOffer(o)}
                          className="text-xs font-semibold text-[#B32B2C] hover:underline shrink-0"
                        >
                          Edit
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {globalOffersAvailable.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Platform offers (from Offers page)
                  </p>
                  <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-52 overflow-y-auto">
                    {globalOffersAvailable.map(o => (
                      <div key={o.id} className="flex items-center gap-3 px-4 py-3 bg-white">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{o.name || o.title}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {o.type === 'fixed' ? `₹${o.discount} OFF` : `${o.discount}% OFF`}
                            <span className="mx-1">·</span>
                            {offerScopeLabel(o)}
                          </p>
                        </div>
                        <Button size="sm" variant="secondary" disabled={isSubmitting} onClick={() => applyExistingOffer(o)}>
                          Apply here
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <Button variant="secondary" onClick={() => setShowOfferModal(false)}>Close</Button>
                <Button onClick={() => setOfferModalMode('create')}>Create new offer</Button>
              </div>
            </div>
          )}

          {(editOffer || offerModalMode === 'create') && (
            <>
              <Input
                label="Offer Name *"
                value={offerForm.name}
                onChange={e => setOfferForm({ ...offerForm, name: e.target.value })}
                placeholder="e.g. Weekend Special"
              />
              <Select
                label="Discount Type"
                value={offerForm.type}
                onChange={e => setOfferForm({ ...offerForm, type: e.target.value })}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (₹)</option>
              </Select>
              <Input
                label={offerForm.type === 'percentage' ? 'Discount (%)' : 'Discount (₹)'}
                type="number"
                value={offerForm.discount}
                onChange={e => setOfferForm({ ...offerForm, discount: e.target.value })}
                placeholder={offerForm.type === 'percentage' ? 'e.g. 20' : 'e.g. 50'}
              />

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Apply to (user app menu)
                </label>
                <div className="flex gap-2 mb-2 flex-wrap">
                  {([
                    { id: 'all' as const, label: 'All items' },
                    { id: 'categories' as const, label: 'Categories' },
                    { id: 'items' as const, label: 'Specific items' },
                  ]).map(scope => (
                    <button
                      key={scope.id}
                      type="button"
                      onClick={() => {
                        setOfferForm({ ...offerForm, applyScope: scope.id })
                        if (scope.id === 'all') {
                          setOfferCategoryIds([])
                          setOfferFoodItemIds([])
                        } else if (scope.id === 'categories') {
                          setOfferFoodItemIds([])
                        } else {
                          setOfferCategoryIds([])
                        }
                      }}
                      className={cn(
                        'flex-1 min-w-[7rem] py-2 rounded-lg text-sm font-semibold border transition-all',
                        offerForm.applyScope === scope.id
                          ? 'bg-[#B32B2C] text-white border-[#B32B2C]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-[#B32B2C]',
                      )}
                    >
                      {scope.label}
                    </button>
                  ))}
                </div>

                {offerForm.applyScope === 'categories' && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                    {categories.length === 0 ? (
                      <p className="text-xs text-gray-400 p-3 text-center">No categories for this restaurant</p>
                    ) : (
                      categories.map(cat => {
                        const checked = offerCategoryIds.includes(cat.id)
                        return (
                          <label
                            key={cat.id}
                            className={cn(
                              'flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-0',
                              checked && 'bg-red-50',
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setOfferCategoryIds(prev =>
                                  checked ? prev.filter(cid => cid !== cat.id) : [...prev, cat.id],
                                )
                              }
                              className="accent-[#B32B2C]"
                            />
                            <span className="text-sm font-medium text-gray-800">{cat.icon} {cat.name}</span>
                          </label>
                        )
                      })
                    )}
                  </div>
                )}

                {offerForm.applyScope === 'items' && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    {items.length === 0 ? (
                      <p className="text-xs text-gray-400 p-3 text-center">Add food items first</p>
                    ) : (
                      items.map(item => {
                        const checked = offerFoodItemIds.includes(item.id)
                        const cat = categories.find(c => c.id === item.categoryId)
                        return (
                          <label
                            key={item.id}
                            className={cn(
                              'flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-0',
                              checked && 'bg-red-50',
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setOfferFoodItemIds(prev =>
                                  checked ? prev.filter(iid => iid !== item.id) : [...prev, item.id],
                                )
                              }
                              className="accent-[#B32B2C]"
                            />
                            <span className="text-sm font-medium text-gray-800 truncate flex-1">{item.name}</span>
                            <span className="text-xs text-gray-400 shrink-0">{cat?.name ?? '—'}</span>
                          </label>
                        )
                      })
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3">
                <p className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-1">
                  Customer app preview
                </p>
                <p className="text-sm text-indigo-900">
                  {previewItemsForForm.length === 0
                    ? 'No menu items match this scope yet (check status and selections).'
                    : `${previewItemsForForm.length} item(s) will show the offer badge and discounted price:`}
                </p>
                {previewItemsForForm.length > 0 && (
                  <p className="text-xs text-indigo-700 mt-1 line-clamp-3">
                    {previewItemsForForm.slice(0, 8).map(i => i.name).join(', ')}
                    {previewItemsForForm.length > 8 ? ` +${previewItemsForForm.length - 8} more` : ''}
                  </p>
                )}
              </div>

              <Input
                label="Valid Till (expiry date)"
                type="date"
                value={offerForm.validTill}
                onChange={e => setOfferForm({ ...offerForm, validTill: e.target.value })}
              />
              <Select
                label="Status"
                value={offerForm.status}
                onChange={e => setOfferForm({ ...offerForm, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <Button variant="secondary" onClick={() => setShowOfferModal(false)}>Cancel</Button>
                <Button onClick={saveOffer} disabled={isSubmitting || !offerForm.name.trim()}>
                  {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : editOffer ? 'Save Changes' : 'Add Offer'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Offer Delete Confirm */}
      <ConfirmDialog
        open={!!deleteOffer}
        onClose={() => setDeleteOffer(null)}
        onConfirm={confirmDeleteOffer}
        title="Delete Offer"
        message={`Delete "${deleteOffer?.name || deleteOffer?.title || 'this offer'}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Category Modal */}
      <Modal open={showCatModal} onClose={() => setShowCatModal(false)} title={editCat ? 'Edit Category' : 'Add Category'} size="sm">
        <form onSubmit={saveCategory} className="space-y-4">

          {/* Mode toggle — only shown when adding (not editing) */}
          {!editCat && (
            <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
              <button
                type="button"
                onClick={() => { setCatModalMode('new'); setSelectedExistingCatId('') }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  catModalMode === 'new'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Create New
              </button>
              <button
                type="button"
                onClick={() => setCatModalMode('existing')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  catModalMode === 'existing'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Use Existing
              </button>
            </div>
          )}

          {/* ── Existing category picker ── */}
          {catModalMode === 'existing' && !editCat ? (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Pick a category that already exists in any restaurant. It will be added to <strong>{restaurant?.name}</strong>.
              </p>
              <Select
                label="Select Existing Category *"
                value={selectedExistingCatId}
                onChange={e => setSelectedExistingCatId(e.target.value)}
                required
              >
                <option value="">— choose a category —</option>
                {/* Group by unique name, deduplicate, exclude already-in-this-restaurant */}
                {Array.from(
                  new Map(
                    allCategories
                      .filter(c => !categories.some(mine => mine.name.toLowerCase() === c.name.toLowerCase()))
                      .map(c => [c.name.toLowerCase(), c])
                  ).values()
                )
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      {c.icon ? `${c.icon} ` : ''}{c.name}
                    </option>
                  ))
                }
              </Select>
              {selectedExistingCatId && (() => {
                const src = allCategories.find(c => c.id === selectedExistingCatId)
                return src ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-700">
                    <span className="text-base">{src.icon || '🍽️'}</span>
                    <span className="font-semibold">{src.name}</span>
                    {src.description && <span className="text-blue-500">· {src.description}</span>}
                  </div>
                ) : null
              })()}
            </div>
          ) : (
            /* ── New / Edit category form ── */
            <>
              <Input label="Name *" value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} placeholder="e.g. Starters" required />
              <Input label="Icon" value={catForm.icon} onChange={e => setCatForm({ ...catForm, icon: e.target.value })} placeholder="🥗" />
              <Textarea label="Description" value={catForm.description} onChange={e => setCatForm({ ...catForm, description: e.target.value })} rows={2} />
              <Select label="Status" value={catForm.status} onChange={e => setCatForm({ ...catForm, status: e.target.value as 'active' | 'inactive' })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={() => setShowCatModal(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : editCat ? 'Save' : 'Add Category'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Item Modal */}
      <Modal open={showItemModal} onClose={() => setShowItemModal(false)} title={editItem ? 'Edit Food Item' : 'Add Food Item'} size="lg">
        <form onSubmit={saveItem} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Name *" value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} required />
            <Select label="Category *" value={itemForm.categoryId} onChange={e => setItemForm({ ...itemForm, categoryId: e.target.value })} required>
              <option value="">Select category</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </Select>
            <Input label="Price (₹) *" type="number" value={itemForm.price} onChange={e => setItemForm({ ...itemForm, price: e.target.value })} required />
            <Input label="Discounted Price" type="number" value={itemForm.discountedPrice} onChange={e => setItemForm({ ...itemForm, discountedPrice: e.target.value })} />
            <Input label="Prep Time (min)" type="number" value={itemForm.preparationTime} onChange={e => setItemForm({ ...itemForm, preparationTime: e.target.value })} />
            <VegNonVegPicker
              value={itemForm.foodType as FoodType}
              onChange={foodType => setItemForm({ ...itemForm, foodType })}
              required
            />
            <Select label="Status" value={itemForm.status} onChange={e => setItemForm({ ...itemForm, status: e.target.value as 'active' | 'inactive' })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
          <Textarea label="Description" value={itemForm.description} onChange={e => setItemForm({ ...itemForm, description: e.target.value })} rows={2} />
          <Input label="Ingredients" value={itemForm.ingredients} onChange={e => setItemForm({ ...itemForm, ingredients: e.target.value })} />
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Image</label>
            <input type="file" accept="image/*" onChange={e => setItemImage(e.target.files?.[0] || null)} className="text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={() => setShowItemModal(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : editItem ? 'Save' : 'Add Item'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Addon Modal */}
      <Modal open={showAddonModal} onClose={() => setShowAddonModal(false)} title={editAddon ? 'Edit Add-on' : 'Add Add-on'} size="md">
        <form onSubmit={saveAddon} className="space-y-4">
          {editAddon ? (
            <>
              <Input label="Name *" value={addonForm.name} onChange={e => setAddonForm({ ...addonForm, name: e.target.value })} required />
              <Input label="Price (₹) *" type="number" value={addonForm.price} onChange={e => setAddonForm({ ...addonForm, price: e.target.value })} required />
              <Input label="Group" value={addonForm.category} onChange={e => setAddonForm({ ...addonForm, category: e.target.value })} placeholder="Sauces, Sides…" />
              <Textarea label="Description" value={addonForm.description} onChange={e => setAddonForm({ ...addonForm, description: e.target.value })} rows={2} />
              <Select label="Status" value={addonForm.status} onChange={e => setAddonForm({ ...addonForm, status: e.target.value as 'active' | 'inactive' })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">Select add-ons from the global catalog to add to this restaurant:</p>
              {catalogAddons.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border border-dashed border-gray-200 rounded-xl">
                  <p className="text-sm">No catalog add-ons available.</p>
                  <p className="text-xs mt-1">Create add-ons in the <Link to="/addons" className="text-[#B32B2C] hover:underline">Add-ons</Link> page first.</p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50">
                  {catalogAddons.map(addon => {
                    const isSelected = selectedCatalogAddonIds.includes(addon.id)
                    const alreadyExists = addons.some(a => a.name.toLowerCase() === addon.name.toLowerCase())
                    return (
                      <label
                        key={addon.id}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0',
                          alreadyExists ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'cursor-pointer hover:bg-white'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={alreadyExists}
                          onChange={() => {
                            if (alreadyExists) return
                            setSelectedCatalogAddonIds(prev =>
                              prev.includes(addon.id)
                                ? prev.filter(id => id !== addon.id)
                                : [...prev, addon.id]
                            )
                          }}
                          className="accent-[#B32B2C]"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{addon.name}</p>
                          <p className="text-xs text-gray-500">
                            {formatCurrency(addon.price)}
                            {alreadyExists && <span className="ml-2 text-amber-600">(Already added)</span>}
                          </p>
                          {addon.description && <p className="text-xs text-gray-500 mt-0.5">{addon.description}</p>}
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
              {selectedCatalogAddonIds.length > 0 && (
                <p className="text-sm font-medium text-gray-700">
                  {selectedCatalogAddonIds.length} add-on{selectedCatalogAddonIds.length === 1 ? '' : 's'} selected
                </p>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={() => setShowAddonModal(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : editAddon ? 'Save' : 'Add Add-on'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteCat} onClose={() => setDeleteCat(null)} onConfirm={confirmDeleteCat} title="Delete Category" message={`Delete "${deleteCat?.name}"?`} variant="danger" />
      <ConfirmDialog open={!!deleteItem} onClose={() => setDeleteItem(null)} onConfirm={confirmDeleteItem} title="Delete Food Item" message={`Delete "${deleteItem?.name}"?`} variant="danger" />
      <ConfirmDialog open={!!deleteAddon} onClose={() => setDeleteAddon(null)} onConfirm={confirmDeleteAddon} title="Delete Add-on" message={`Delete "${deleteAddon?.name}"?`} variant="danger" />

      <p className="text-xs text-gray-400 text-center pt-2">
        Global lists also available:{' '}
        <Link to="/food-categories" className="text-[#B32B2C] hover:underline">Food Categories</Link>
        {' · '}
        <Link to="/food-items" className="text-[#B32B2C] hover:underline">Food Items</Link>
        {' · '}
        <Link to="/addons" className="text-[#B32B2C] hover:underline">Add-ons</Link>
      </p>
    </div>
  )
}
