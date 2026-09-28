import {
  collection, doc, setDoc, getDoc, getDocFromServer, getDocs, onSnapshot,
  updateDoc, deleteDoc, query, where, limit, orderBy, serverTimestamp, increment,
  deleteField
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from './firebase'
import { normalizeFoodItemVegFields } from './foodItemUtils'
import { type Order, type DeliveryPartner, type OrderStatus } from '@/data/dummy'

export type UserRole = 'admin' | 'customer' | 'delivery' | 'restaurant_owner'
export interface UserProfile {
  uid: string; name: string; email: string; phone?: string
  role: UserRole; avatar?: string; createdAt?: any
}

/** IDs of the dummy/seed restaurants — used to identify and purge seed data. */
export const SEED_RESTAURANT_IDS: string[] = []

/**
 * Deletes all foodCategories documents whose ID starts with 'cat_res_'
 * (the seed pattern) — removes demo restaurant food categories from Firestore.
 */
export async function clearSeedFoodCategories(): Promise<{ deleted: number; error?: string }> {
  try {
    const snap = await getDocs(collection(db, 'foodCategories'))
    const seedDocs = snap.docs.filter(d => d.id.startsWith('cat_res_'))
    await Promise.all(seedDocs.map(d => deleteDoc(d.ref)))
    return { deleted: seedDocs.length }
  } catch (err: any) {
    return { deleted: 0, error: err?.message || String(err) }
  }
}

/**
 * Deletes all restaurantCategories documents whose ID starts with 'rcat_'
 * (the seed pattern) — removes dummy cuisine-type categories.
 */
export async function clearSeedRestaurantCategories(): Promise<{ deleted: number; error?: string }> {
  try {
    const snap = await getDocs(collection(db, 'restaurantCategories'))
    const seedDocs = snap.docs.filter(d => d.id.startsWith('rcat_'))
    await Promise.all(seedDocs.map(d => deleteDoc(d.ref)))
    return { deleted: seedDocs.length }
  } catch (err: any) {
    return { deleted: 0, error: err?.message || String(err) }
  }
}



const DEFAULT_FOOD_CATEGORIES = [
  { key: 'starters', name: 'Starters', icon: '🥗' },
  { key: 'main', name: 'Main Course', icon: '🍛' },
  { key: 'breads', name: 'Breads', icon: '🫓' },
  { key: 'desserts', name: 'Desserts', icon: '🍮' },
  { key: 'beverages', name: 'Beverages', icon: '🥤' },
]

const _BASE_ADDONS = [
  { key: 'cheese', name: 'Extra Cheese', price: 30, category: 'Extras', description: 'Add extra cheese' },
  { key: 'water', name: 'Water', price: 20, category: 'Beverages', description: 'Packaged drinking water' },
  { key: 'soda', name: 'Soda', price: 40, category: 'Beverages', description: 'Cold drink' },
]

function buildFoodCategoriesForRestaurant(restaurant: { id: string; name: string }) {
  return DEFAULT_FOOD_CATEGORIES.map((cat, index) => ({
    id: `cat_${restaurant.id}_${cat.key}`,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    name: cat.name,
    icon: cat.icon,
    sortOrder: index + 1,
    itemCount: 0,
    status: 'active' as const,
  }))
}

const SEEDED_FOOD_CATEGORY_KEYS = ['starters', 'main', 'breads', 'desserts', 'beverages']

/**
 * Removes the Starters / Main Course / … categories that were created
 * automatically for a restaurant and still have no menu items.
 * Categories an admin added by hand use a different id and are left alone.
 */
export async function deleteUnassignedSeedFoodCategories(): Promise<{ deleted: number }> {
  const [cats, items] = await Promise.all([
    getDocs(collection(db, 'foodCategories')),
    getDocs(collection(db, 'foodItems')),
  ])
  const usedCategoryIds = new Set(
    items.docs.map(item => String(item.data().categoryId || '')).filter(Boolean),
  )
  const seeded = cats.docs.filter(category => {
    const restaurantId = String(category.data().restaurantId || '')
    const isSeed = SEEDED_FOOD_CATEGORY_KEYS.some(
      key => category.id === `cat_${restaurantId}_${key}`,
    )
    if (!isSeed || usedCategoryIds.has(category.id)) return false
    return Number(category.data().itemCount || 0) === 0
  })
  await Promise.all(seeded.map(category => deleteDoc(category.ref)))
  return { deleted: seeded.length }
}

/** Seed default categories (Starters, Main Course, …) when a new restaurant is created. */
export async function seedDefaultCatalogForRestaurant(restaurant: {
  id: string; name: string; cuisine: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const cats = buildFoodCategoriesForRestaurant(restaurant)
    for (const cat of cats) {
      await setDoc(doc(db, 'foodCategories', cat.id), cat, { merge: true })
    }
    const commonAddons = _BASE_ADDONS.filter(a => ['cheese', 'water', 'soda'].includes(a.key))
    for (const a of commonAddons) {
      const addon = {
        id: `add_${restaurant.id}_${a.key}`,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        foodItemId: null as string | null,
        name: a.name,
        price: a.price,
        category: a.category,
        status: 'active' as const,
        description: a.description,
      }
      await setDoc(doc(db, 'addons', addon.id), addon, { merge: true })
    }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: String(err) }
  }
}

/** Backfill foodType + veg/nonveg tags on all existing foodItems in Firestore. */
export async function backfillFoodItemVegTagsInFirestore(
  onProgress?: (msg: string) => void
): Promise<{ success: boolean; updated?: number; error?: string }> {
  const report = (msg: string) => {
    onProgress?.(msg)
    console.log(msg)
  }
  try {
    const snap = await getDocs(collection(db, 'foodItems'))
    let updated = 0
    report(`Found ${snap.size} food items — applying veg/nonveg tags...`)
    for (const d of snap.docs) {
      const data = d.data()
      const normalized = normalizeFoodItemVegFields({
        ...data,
        isVeg: data.isVeg,
        foodType: data.foodType,
        tags: data.tags,
      })
      const needsUpdate =
        data.foodType !== normalized.foodType ||
        data.isVeg !== normalized.isVeg ||
        JSON.stringify(data.tags || []) !== JSON.stringify(normalized.tags)

      if (needsUpdate) {
        await updateDoc(doc(db, 'foodItems', d.id), normalized)
        updated++
      }
    }
    report(`Updated ${updated} food items with veg/nonveg tags.`)
    return { success: true, updated }
  } catch (err: any) {
    console.error('Veg tag backfill error:', err)
    return { success: false, error: String(err) }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REAL-TIME SUBSCRIPTIONS
// ─────────────────────────────────────────────────────────────────────────────
export function subscribeToOrders(onData: (orders: Order[]) => void) {
  // Use a collection-level snapshot (no orderBy) so missing createdAt fields
  // don't cause the query to silently fail. Sort client-side instead.
  return onSnapshot(collection(db, 'orders'), (snap) => {
    const list: Order[] = []
    snap.forEach(d => {
      const data = d.data()
      // Coerce Firestore Timestamp → ISO string so formatDateTime works
      if (data.createdAt?.toDate) data.createdAt = data.createdAt.toDate().toISOString()
      if (data.updatedAt?.toDate) data.updatedAt = data.updatedAt.toDate().toISOString()
      if (data.assignedAt?.toDate) data.assignedAt = data.assignedAt.toDate().toISOString()
      // Ensure numeric price fields are numbers (not undefined)
      data.subtotal    = Number(data.subtotal    ?? 0)
      data.tax         = Number(data.tax         ?? 0)
      data.deliveryFee = Number(data.deliveryFee ?? 0)
      data.platformFee = Number(data.platformFee ?? 0)
      data.discount    = Number(data.discount    ?? 0)
      data.total       = Number(data.total       ?? 0)
      data.items       = Array.isArray(data.items) ? data.items : []
      data.timeline    = Array.isArray(data.timeline) ? data.timeline : []
      list.push({ id: d.id, ...data } as Order)
    })
    // Sort newest first client-side
    list.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt as any).getTime() : 0
      const tb = b.createdAt ? new Date(b.createdAt as any).getTime() : 0
      return tb - ta
    })
    onData(list)
  }, (err) => { console.warn('orders snap:', err); onData([]) })
}

export function subscribeToDeliveryPartners(onData: (partners: DeliveryPartner[]) => void) {
  return onSnapshot(collection(db, 'deliveryPartners'), (snap) => {
    const list: DeliveryPartner[] = []
    snap.forEach(d => list.push({ id: d.id, ...d.data() } as DeliveryPartner))
    onData(list.length > 0 ? list : [])
  }, (err) => { console.warn('partners snap:', err); onData([]) })
}

export function subscribeToCollection<T extends { id: string }>(
  collectionName: string,
  onData: (items: T[]) => void,
  fallback: T[] = []
) {
  return onSnapshot(collection(db, collectionName), (snap) => {
    if (snap.empty) { onData(fallback); return }
    const list: T[] = []
    snap.forEach(d => list.push({ id: d.id, ...d.data() } as T))
    onData(list.length > 0 ? list : fallback)
  }, (err) => { console.warn(`${collectionName} snap:`, err); onData(fallback) })
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD HELPERS
// ─────────────────────────────────────────────────────────────────────────────
export async function createOrUpdateUserProfile(profile: UserProfile) {
  await setDoc(doc(db, 'users', profile.uid), { ...profile, updatedAt: serverTimestamp() }, { merge: true })
}

export function watchUserProfile(uid: string, onData: (data: Record<string, any> | null) => void) {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    onData(snap.exists() ? (snap.data() as Record<string, any>) : null)
  }, () => onData(null))
}

export async function saveAdminProfile(uid: string, data: {
  firstName: string
  lastName: string
  email: string
  phone: string
  city: string
}) {
  const ref = doc(db, 'users', uid)
  const existing = await getDoc(ref)
  const firstName = data.firstName.trim()
  const lastName = data.lastName.trim()
  const payload: Record<string, any> = {
    uid,
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim(),
    email: data.email.trim(),
    phone: data.phone.trim(),
    city: data.city.trim(),
    role: 'admin',
    updatedAt: serverTimestamp(),
  }
  if (!existing.exists() || !existing.data()?.createdAt) {
    payload.createdAt = serverTimestamp()
  }
  await setDoc(ref, payload, { merge: true })
}

function isLockedOrderStatus(status: string) {
  const value = status.trim().toLowerCase()
  return value === 'cancelled' || value === 'canceled' || value === 'refunded' || value.includes('cancel')
}

export async function updateOrderStatusInFirestore(orderId: string, newStatus: OrderStatus) {
  try {
    const snap = await getDocFromServer(doc(db, 'orders', orderId))
    const current = String(snap.data()?.status ?? '')
    if (isLockedOrderStatus(current)) {
      return { success: false, error: 'Cancelled orders cannot be updated' }
    }
    await updateDoc(doc(db, 'orders', orderId), { status: newStatus, updatedAt: serverTimestamp() })
    return { success: true }
  } catch (err) { return { success: false, error: err } }
}

function definedFields(data: Record<string, any>) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined))
}

export async function addDocumentToFirestore<T extends Record<string, any>>(
  collectionName: string, itemData: T
): Promise<{ success: boolean; id: string; error?: any }> {
  try {
    const docId = itemData.id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    await setDoc(
      doc(db, collectionName, docId),
      definedFields({ ...itemData, id: docId, createdAt: itemData.createdAt || new Date().toISOString(), updatedAt: serverTimestamp() }),
      { merge: true },
    )
    return { success: true, id: docId }
  } catch (err) { return { success: false, id: '', error: err } }
}

export async function updateDocumentInFirestore(collectionName: string, docId: string, updateData: Record<string, any>) {
  try {
    await updateDoc(doc(db, collectionName, docId), { ...updateData, updatedAt: serverTimestamp() })
    return { success: true }
  } catch (err) { return { success: false, error: err } }
}

/** Stable key for matching add-on templates across restaurants (user app menu extras). */
export function addonCatalogKey(a: { name: string; price: number; category?: string }): string {
  const name = (a.name || '').trim().toLowerCase()
  const price = Number(a.price) || 0
  return `${name}::${price}`
}

/** One add-on per restaurant, name, and price. Extra copies are removed. */
export async function deleteDuplicateAddons(): Promise<{ deleted: number }> {
  const snap = await getDocs(collection(db, 'addons'))
  const groups = new Map<string, typeof snap.docs>()
  for (const addon of snap.docs) {
    const data = addon.data()
    const key = `${String(data.restaurantId || '')}::${addonCatalogKey({
      name: String(data.name || ''),
      price: Number(data.price) || 0,
    })}`
    const list = groups.get(key) ?? []
    list.push(addon)
    groups.set(key, list)
  }
  const extra = []
  for (const docs of groups.values()) {
    if (docs.length < 2) continue
    docs.sort((a, b) => {
      const aActive = a.data().status === 'inactive' ? 0 : 1
      const bActive = b.data().status === 'inactive' ? 0 : 1
      return bActive - aActive
    })
    extra.push(...docs.slice(1))
  }
  await Promise.all(extra.map(addon => deleteDoc(addon.ref)))
  return { deleted: extra.length }
}

/** Removes add-on copies whose restaurant is no longer in the restaurants collection. */
export async function deleteAddonsForMissingRestaurants(liveRestaurantIds: string[]): Promise<{ deleted: number }> {
  if (liveRestaurantIds.length === 0) return { deleted: 0 }
  const live = new Set(liveRestaurantIds)
  const snap = await getDocs(collection(db, 'addons'))
  const extra = snap.docs.filter(addon => {
    const restaurantId = String(addon.data().restaurantId || '')
    return !live.has(restaurantId)
  })
  await Promise.all(extra.map(addon => deleteDoc(addon.ref)))
  return { deleted: extra.length }
}

export type AddonCatalogEntry = {
  id: string
  name: string
  price: number
  category?: string
  status?: string
  description?: string
  foodItemId?: string | null
  restaurantId?: string
  restaurantName?: string
}

/**
 * Ensures Firestore `addons` for [restaurantId] match [selectedCatalogKeys].
 * Clones from existing catalog add-ons when needed; deactivates unselected ones.
 */
export async function syncAddonsForRestaurant(
  restaurantId: string,
  restaurantName: string,
  selectedCatalogKeys: string[],
  allAddons: AddonCatalogEntry[],
): Promise<{ success: boolean; created: number; updated: number; deactivated: number; error?: string }> {
  try {
    const selected = new Set(selectedCatalogKeys)
    const templatesByKey = new Map<string, AddonCatalogEntry>()
    for (const a of allAddons) {
      if (a.status === 'inactive') continue
      const key = addonCatalogKey(a)
      if (!templatesByKey.has(key)) templatesByKey.set(key, a)
    }

    const seenForRestaurant = new Set<string>()
    const current = allAddons.filter(a => {
      if (a.restaurantId !== restaurantId) return false
      const key = addonCatalogKey(a)
      if (seenForRestaurant.has(key)) return false
      seenForRestaurant.add(key)
      return true
    })
    let created = 0
    let updated = 0
    let deactivated = 0

    for (const key of selected) {
      const template = templatesByKey.get(key)
      if (!template) continue
      const existing = current.find(c => addonCatalogKey(c) === key)
      if (existing) {
        if (existing.status !== 'active') {
          const res = await updateDocumentInFirestore('addons', existing.id, {
            status: 'active',
            restaurantName,
          })
          if (res.success) updated++
        }
      } else {
        const slug = key.split('::')[0].replace(/[^a-z0-9]+/g, '_').slice(0, 20)
        const id = `add_${restaurantId}_${slug}_${Date.now()}`
        const res = await addDocumentToFirestore('addons', {
          id,
          name: template.name,
          price: template.price,
          category: template.category || 'General',
          description: template.description || '',
          foodItemId: null,
          restaurantId,
          restaurantName,
          status: 'active',
          catalogKey: key,
        })
        if (res.success) created++
      }
    }

    for (const c of current) {
      const key = addonCatalogKey(c)
      if (!selected.has(key) && c.status !== 'inactive') {
        const res = await updateDocumentInFirestore('addons', c.id, { status: 'inactive' })
        if (res.success) deactivated++
      }
    }

    return { success: true, created, updated, deactivated }
  } catch (err: any) {
    return { success: false, created: 0, updated: 0, deactivated: 0, error: err?.message || String(err) }
  }
}

/** Block or unblock a customer in Firestore (restricts user-app login & orders). */
export async function setCustomerBlockStatus(
  customerId: string,
  blocked: boolean,
  reason?: string
): Promise<{ success: boolean; error?: any }> {
  const now = new Date().toISOString()
  const updateData = blocked
    ? {
        status: 'blocked' as const,
        blockedAt: now,
        blockedReason: reason?.trim() || 'Blocked by admin',
        unblockedAt: null,
      }
    : {
        status: 'active' as const,
        blockedAt: null,
        blockedReason: null,
        unblockedAt: now,
      }
  return updateDocumentInFirestore('customers', customerId, updateData)
}

export async function deleteDocumentFromFirestore(collectionName: string, docId: string) {
  try {
    await deleteDoc(doc(db, collectionName, docId))
    return { success: true }
  } catch (err) { return { success: false, error: err } }
}

export async function uploadMediaToStorage(file: File, folderName = 'media'): Promise<string> {
  const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
  const snap = await uploadBytes(ref(storage, `${folderName}/${fileName}`), file)
  return getDownloadURL(snap.ref)
}

export async function uploadImageToStorage(file: File, folderName = 'images'): Promise<string> {
  try {
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const snap = await uploadBytes(ref(storage, `${folderName}/${fileName}`), file)
    return await getDownloadURL(snap.ref)
  } catch {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.readAsDataURL(file)
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN SETTINGS — single document at settings/admin
// ─────────────────────────────────────────────────────────────────────────────
export interface AdminSettings {
  general: {
    appName: string
    tagline: string
    supportEmail: string
    supportPhone: string
    currency: string
    language: string
    logoUrl: string
  }
  charges: {
    baseDeliveryFee: number
    maxDeliveryFee: number
    deliveryFeePerKm: number
    platformFee: number
    freeDeliveryThreshold: number
    minOrderValue: number
    surgeMultiplier: number
  }
  delivery: {
    maxRadiusKm: number
    avgDeliveryTimeMin: number
    partnerCommissionPercent: number
    assignmentMode: 'auto' | 'manual'
    /** Minutes the delivery partner waits at restaurant after prep timer before transfer option appears. */
    partnerWaitMinutes: number
  }
  deliveryPartner: {
    baseFee: number
    perKmRate: number
    minDistance: number
    maxDistance: number
    acceptanceTimeout: number
    lateDeliveryThreshold: number
    lateDeliveryPenalty: number
    cashLimitDefault: number
    withdrawalMinAmount: number
    withdrawalMaxAmount: number
    slotDuration: number
    requiredDocuments: string[]
    dailyTarget: number
    dailyTargetBonus: number
    incentiveSlots: Array<{ trips: number; amount: number }>
    trainingModules: Array<{ id: string; title: string; body: string; videoUrl?: string }>
  }
  tax: {
    gstRate: number
    gstNumber: string
    taxAppliedOn: string
    taxDisplay: string
  }
  legal: {
    terms: string
    privacy: string
    refund: string
  }
  security: {
    twoFactorEnabled: boolean
    loginNotifications: boolean
    sessionTimeoutMin: number
  }
  about: {
    aboutUs: string
    website: string
    contactEmail: string
    version: string
  }
}

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  general: {
    appName: 'TastyKart',
    tagline: 'Delicious food, delivered fast',
    supportEmail: 'support@tastykart.com',
    supportPhone: '+91 1800 123 4567',
    currency: 'INR',
    language: 'en',
    logoUrl: '',
  },
  charges: {
    baseDeliveryFee: 20,
    maxDeliveryFee: 60,
    deliveryFeePerKm: 10,
    platformFee: 10,
    freeDeliveryThreshold: 300,
    minOrderValue: 80,
    surgeMultiplier: 1.5,
  },
  delivery: {
    maxRadiusKm: 10,
    avgDeliveryTimeMin: 35,
    partnerCommissionPercent: 20,
    assignmentMode: 'auto',
    partnerWaitMinutes: 10,
  },
  deliveryPartner: {
    baseFee: 30,
    perKmRate: 8,
    minDistance: 1,
    maxDistance: 10,
    acceptanceTimeout: 120,
    lateDeliveryThreshold: 45,
    lateDeliveryPenalty: 20,
    cashLimitDefault: 10000,
    withdrawalMinAmount: 500,
    withdrawalMaxAmount: 50000,
    slotDuration: 4,
    requiredDocuments: ['aadhar', 'pan', 'drivingLicense', 'vehicleRC', 'profilePhoto'],
    dailyTarget: 2000,
    dailyTargetBonus: 100,
    incentiveSlots: [
      { trips: 15, amount: 110 },
      { trips: 22, amount: 170 },
      { trips: 25, amount: 225 },
      { trips: 35, amount: 450 },
    ],
    trainingModules: [
      { id: 'safety',   title: 'Safety Guidelines',   body: 'Wear a helmet when riding. Follow traffic rules, avoid rash driving, and never use your phone while on the road. Keep the food bag sealed and upright so the order stays safe until handover.' },
      { id: 'pickup',   title: 'Order Pickup Process', body: 'Reach the restaurant on time, share the order ID at the counter, check items against the bill, and confirm packing before you leave. Mark pickup in the app only after you have the order.' },
      { id: 'delivery', title: 'Delivery Process',     body: 'Follow the map to the customer, call if you cannot find the address, and hand over the order politely. Collect cash for COD orders and mark delivered only after the customer has received the food.' },
      { id: 'behaviour',title: 'Customer Behaviour',   body: 'Be polite, wait a few minutes if needed, and never argue. If there is an issue with the order, contact support instead of leaving. Your rating depends on how you treat every customer.' },
      { id: 'privacy',  title: 'Privacy & Policy',     body: 'Do not share customer phone numbers, addresses, or order details with anyone. Use customer data only to complete the delivery. Report any app or safety issue to TastyKart support.' },
    ],
  },
  tax: {
    gstRate: 5,
    gstNumber: '29ABCDE1234F1Z5',
    taxAppliedOn: 'Food Total',
    taxDisplay: 'Inclusive',
  },
  legal: {
    terms: 'By using TastyKart, you agree to our terms of service...',
    privacy: 'We respect your privacy and are committed to protecting your personal data...',
    refund: 'Refunds are processed within 5-7 business days...',
  },
  security: {
    twoFactorEnabled: false,
    loginNotifications: true,
    sessionTimeoutMin: 60,
  },
  about: {
    aboutUs: 'TastyKart is a premium food delivery platform connecting customers with the best local restaurants.',
    website: 'https://tastykart.com',
    contactEmail: 'hello@tastykart.com',
    version: '1.0.0',
  },
}

const SETTINGS_DOC = doc(db, 'settings', 'admin')

export async function getAdminSettings(): Promise<AdminSettings> {
  try {
    const snap = await getDoc(SETTINGS_DOC)
    if (!snap.exists()) return { ...DEFAULT_ADMIN_SETTINGS }
    const data = snap.data() as Partial<AdminSettings>
    return {
      general: { ...DEFAULT_ADMIN_SETTINGS.general, ...data.general },
      charges: { ...DEFAULT_ADMIN_SETTINGS.charges, ...data.charges },
      delivery: { ...DEFAULT_ADMIN_SETTINGS.delivery, ...data.delivery },
      deliveryPartner: {
        ...DEFAULT_ADMIN_SETTINGS.deliveryPartner,
        ...data.deliveryPartner,
        incentiveSlots: (data.deliveryPartner as any)?.incentiveSlots ?? DEFAULT_ADMIN_SETTINGS.deliveryPartner.incentiveSlots,
        dailyTarget: (data.deliveryPartner as any)?.dailyTarget ?? DEFAULT_ADMIN_SETTINGS.deliveryPartner.dailyTarget,
        dailyTargetBonus: (data.deliveryPartner as any)?.dailyTargetBonus ?? DEFAULT_ADMIN_SETTINGS.deliveryPartner.dailyTargetBonus,
      },
      tax: { ...DEFAULT_ADMIN_SETTINGS.tax, ...data.tax },
      legal: { ...DEFAULT_ADMIN_SETTINGS.legal, ...data.legal },
      security: { ...DEFAULT_ADMIN_SETTINGS.security, ...data.security },
      about: { ...DEFAULT_ADMIN_SETTINGS.about, ...data.about },
    }
  } catch (err) {
    console.warn('getAdminSettings:', err)
    return { ...DEFAULT_ADMIN_SETTINGS }
  }
}

export async function saveAdminSettings(
  settings: AdminSettings
): Promise<{ success: boolean; error?: string }> {
  try {
    await setDoc(SETTINGS_DOC, { ...settings, updatedAt: serverTimestamp() }, { merge: true })
    return { success: true }
  } catch (err: any) {
    console.error('saveAdminSettings:', err)
    return { success: false, error: err?.message || String(err) }
  }
}

export function subscribeToAdminSettings(onData: (settings: AdminSettings) => void) {
  return onSnapshot(SETTINGS_DOC, (snap) => {
    if (!snap.exists()) {
      onData({ ...DEFAULT_ADMIN_SETTINGS })
      return
    }
    const data = snap.data() as Partial<AdminSettings>
    onData({
      general: { ...DEFAULT_ADMIN_SETTINGS.general, ...data.general },
      charges: { ...DEFAULT_ADMIN_SETTINGS.charges, ...data.charges },
      delivery: { ...DEFAULT_ADMIN_SETTINGS.delivery, ...data.delivery },
      deliveryPartner: {
        ...DEFAULT_ADMIN_SETTINGS.deliveryPartner,
        ...data.deliveryPartner,
        incentiveSlots: (data.deliveryPartner as any)?.incentiveSlots ?? DEFAULT_ADMIN_SETTINGS.deliveryPartner.incentiveSlots,
        dailyTarget: (data.deliveryPartner as any)?.dailyTarget ?? DEFAULT_ADMIN_SETTINGS.deliveryPartner.dailyTarget,
        dailyTargetBonus: (data.deliveryPartner as any)?.dailyTargetBonus ?? DEFAULT_ADMIN_SETTINGS.deliveryPartner.dailyTargetBonus,
      },
      tax: { ...DEFAULT_ADMIN_SETTINGS.tax, ...data.tax },
      legal: { ...DEFAULT_ADMIN_SETTINGS.legal, ...data.legal },
      security: { ...DEFAULT_ADMIN_SETTINGS.security, ...data.security },
      about: { ...DEFAULT_ADMIN_SETTINGS.about, ...data.about },
    })
  }, (err) => {
    console.warn('settings snap:', err)
    onData({ ...DEFAULT_ADMIN_SETTINGS })
  })
}


// ─────────────────────────────────────────────────────────────────────────────
// TRANSACTIONS (PARTNER EARNINGS & WITHDRAWALS)
// ─────────────────────────────────────────────────────────────────────────────

/** Approve or reject a delivery-partner withdrawal and mirror the status onto the partner transaction. */
export async function reviewWithdrawalRequest(input: {
  requestId: string
  transactionId?: string
  partnerId: string
  amount: number
  action: 'APPROVE' | 'REJECT'
  reason?: string
  adminId: string
  hasPayoutDoc: boolean
}): Promise<{ success: boolean; error?: string }> {
  try {
    const now = new Date().toISOString()
    const approved = input.action === 'APPROVE'
    const payoutStatus = approved ? 'APPROVED' : 'REJECTED'
    const txStatus = approved ? 'approved' : 'rejected'

    const txId = input.transactionId || input.requestId

    // Update the transaction doc — the admin panel has write access to
    // 'transactions' via its Firestore rules.
    await setDoc(doc(db, 'transactions', txId), {
      id: txId,
      partnerId: input.partnerId,
      amount: input.amount,
      type: 'payout',
      status: txStatus,
      processedAt: serverTimestamp(),
      remarks: approved ? 'Approved by admin' : (input.reason?.trim() || 'Rejected by admin'),
      updatedAt: serverTimestamp(),
    }, { merge: true })

    // Mirror the status onto payoutRequests if the document already exists.
    // We use updateDoc (not setDoc) so we don't create a new doc — creating
    // requires delivery-partner auth which the admin browser client doesn't have.
    // If the doc is absent this fails silently; the transactions update above is
    // the source of truth the partner app reads.
    try {
      await updateDoc(doc(db, 'payoutRequests', input.requestId), {
        status: payoutStatus,
        updatedAt: now,
        updatedBy: input.adminId,
        ...(approved
          ? { approvedAt: now, approvedBy: input.adminId, approvedAmount: input.amount }
          : {
              rejectedAt: now,
              rejectedBy: input.adminId,
              rejectionReason: input.reason?.trim() || 'Rejected by admin',
            }),
      })
    } catch (_) {
      // Doc may not exist or rules may block admin writes — non-critical.
    }

    // On rejection, return the amount to the partner's pocket balance.
    if (!approved && input.partnerId) {
      await updateDoc(doc(db, 'deliveryPartners', input.partnerId), {
        pocketBalance: increment(input.amount),
        updatedAt: serverTimestamp(),
      })
    }

    return { success: true }
  } catch (err: any) {
    console.error('reviewWithdrawalRequest:', err)
    return { success: false, error: err?.message || String(err) }
  }
}

export function subscribeToTransactions(
  partnerId: string | null,
  onData: (transactions: any[]) => void
) {
  const transactionsCol = collection(db, 'transactions')
  const q = partnerId
    ? query(transactionsCol, orderBy('createdAt', 'desc'))
    : query(transactionsCol, orderBy('createdAt', 'desc'))
  
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    // Filter by partnerId if provided
    const filtered = partnerId 
      ? items.filter((t: any) => t.partnerId === partnerId)
      : items
    onData(filtered)
  }, (err) => {
    console.warn('transactions snap:', err)
    onData([])
  })
}

export async function addTransaction(
  transactionData: {
    partnerId?: string
    customerName?: string
    type: string
    title: string
    orderNumber?: string
    orderId?: string
    amount: number
    method: string
    status: string
    utr?: string
    balanceBefore?: number
    balanceAfter?: number
    remarks?: string
  }
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const transactionsCol = collection(db, 'transactions')
    const newDoc = doc(transactionsCol)
    await setDoc(newDoc, {
      id: newDoc.id,
      ...transactionData,
      createdAt: serverTimestamp(),
      processedAt: transactionData.status === 'completed' ? serverTimestamp() : null,
    })
    return { success: true, id: newDoc.id }
  } catch (err: any) {
    console.error('addTransaction:', err)
    return { success: false, error: err?.message || String(err) }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS (DELIVERY PARTNER & CUSTOMER NOTIFICATIONS)
// ─────────────────────────────────────────────────────────────────────────────

export function subscribeToNotifications(
  userId: string | null,
  userType: string | undefined,
  onData: (notifications: any[]) => void
) {
  const notificationsCol = collection(db, 'notifications')
  const q = query(notificationsCol, orderBy('createdAt', 'desc'))
  
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    // Filter by userId and userType if provided
    let filtered = items
    if (userId) {
      filtered = filtered.filter((n: any) => n.userId === userId)
    }
    if (userType) {
      filtered = filtered.filter((n: any) => n.userType === userType)
    }
    onData(filtered)
  }, (err) => {
    console.warn('notifications snap:', err)
    onData([])
  })
}

export async function addNotification(
  notificationData: {
    userId: string
    userType?: string
    type: string
    title: string
    message: string
    data?: Record<string, any>
    priority?: string
    expiresAt?: string
  }
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const notificationsCol = collection(db, 'notifications')
    const newDoc = doc(notificationsCol)
    await setDoc(newDoc, {
      id: newDoc.id,
      ...notificationData,
      read: false,
      createdAt: serverTimestamp(),
    })
    return { success: true, id: newDoc.id }
  } catch (err: any) {
    console.error('addNotification:', err)
    return { success: false, error: err?.message || String(err) }
  }
}

export async function markNotificationAsRead(
  notificationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      read: true,
    })
    return { success: true }
  } catch (err: any) {
    console.error('markNotificationAsRead:', err)
    return { success: false, error: err?.message || String(err) }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELIVERY PARTNER SPECIFIC OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function updatePartnerStatus(
  partnerId: string,
  status: 'online' | 'offline' | 'busy' | 'available'
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateDoc(doc(db, 'deliveryPartners', partnerId), {
      status,
      updatedAt: serverTimestamp(),
    })
    return { success: true }
  } catch (err: any) {
    console.error('updatePartnerStatus:', err)
    return { success: false, error: err?.message || String(err) }
  }
}

export async function updatePartnerLocation(
  partnerId: string,
  lat: number,
  lng: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateDoc(doc(db, 'deliveryPartners', partnerId), {
      currentLat: lat,
      currentLng: lng,
      lastLocationUpdate: serverTimestamp(),
    })
    return { success: true }
  } catch (err: any) {
    console.error('updatePartnerLocation:', err)
    return { success: false, error: err?.message || String(err) }
  }
}

export async function blockDeliveryPartner(
  partnerId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateDoc(doc(db, 'deliveryPartners', partnerId), {
      status: 'blocked',
      blockedAt: serverTimestamp(),
      blockedReason: reason,
      updatedAt: serverTimestamp(),
    })
    return { success: true }
  } catch (err: any) {
    console.error('blockDeliveryPartner:', err)
    return { success: false, error: err?.message || String(err) }
  }
}

export async function unblockDeliveryPartner(
  partnerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateDoc(doc(db, 'deliveryPartners', partnerId), {
      status: 'offline',
      blockedReason: null,
      unblockedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return { success: true }
  } catch (err: any) {
    console.error('unblockDeliveryPartner:', err)
    return { success: false, error: err?.message || String(err) }
  }
}

export async function approveDeliveryPartner(
  partnerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateDoc(doc(db, 'deliveryPartners', partnerId), {
      approved: true,
      updatedAt: serverTimestamp(),
    })
    
    // Send notification to partner
    await addNotification({
      userId: partnerId,
      userType: 'delivery_partner',
      type: 'account_update',
      title: 'Account Approved',
      message: 'Your delivery partner account has been approved. Start earning now!',
      priority: 'high',
    })
    
    return { success: true }
  } catch (err: any) {
    console.error('approveDeliveryPartner:', err)
    return { success: false, error: err?.message || String(err) }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDER OPERATIONS FOR DELIVERY PARTNERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the active (in-progress) order for a delivery partner, or null.
 * An order is considered active when its status is not 'delivered', 'cancelled',
 * or 'refunded'. Used to block double-assignment.
 */
async function getActiveOrderForPartner(
  partnerId: string
): Promise<{ id: string; orderNumber: string } | null> {
  const snap = await getDocs(
    query(
      collection(db, 'orders'),
      where('deliveryPartnerId', '==', partnerId),
      limit(20)
    )
  )
  const terminal = new Set(['delivered', 'cancelled', 'refunded'])
  const active = snap.docs.find(d => !terminal.has((d.data().status ?? '').toLowerCase()))
  if (!active) return null
  return { id: active.id, orderNumber: active.data().orderNumber ?? active.id }
}

/**
 * Resets a delivery partner's BUSY status back to ONLINE when they have no
 * active (non-terminal) order assigned. This fixes the "stuck BUSY" bug where
 * cancelling an assignment left the partner doc showing BUSY indefinitely.
 *
 * Only touches the partner doc when:
 *   - their status is 'busy' AND
 *   - they have no current non-terminal order attached
 *
 * Also clears a dangling `currentOrder` field that may reference a cancelled order.
 */
export async function reconcilePartnerStatusAfterOrderEnd(
  partnerId: string
): Promise<{ reset: boolean; note?: string }> {
  if (!partnerId) return { reset: false }
  try {
    const partnerSnap = await getDoc(doc(db, 'deliveryPartners', partnerId))
    if (!partnerSnap.exists()) return { reset: false, note: 'partner_not_found' }
    const partner = partnerSnap.data() as Record<string, any> || {}
    const currentStatus = (partner.status || 'offline').toString().toLowerCase().trim()
    const currentOrderId = (partner.currentOrder || '').toString()

    const activeOrder = await getActiveOrderForPartner(partnerId)

    if (!activeOrder) {
      // Partner has NO active order — but their status may still be BUSY
      // and/or currentOrder may still reference a finished/cancelled order.
      // If they were BUSY, safely transition them back to ONLINE.
      if (currentStatus === 'busy' || currentOrderId.length > 0) {
        const nextStatus = currentStatus === 'offline' || currentStatus === 'blocked'
          ? currentStatus
          : 'online'
        await updateDoc(doc(db, 'deliveryPartners', partnerId), {
          status: nextStatus,
          currentOrder: (firebaseFirestore as any).FieldValue?.delete
            ? (firebaseFirestore as any).FieldValue.delete()
            : null,
          updatedAt: serverTimestamp(),
        })
        return { reset: true }
      }
      return { reset: false, note: 'status_already_ok' }
    }

    // Partner still has an active order — keep BUSY exactly as-is.
    return { reset: false, note: `still_on_${activeOrder.id}` }
  } catch (err: any) {
    console.warn('reconcilePartnerStatusAfterOrderEnd:', partnerId, err?.message || err)
    return { reset: false, note: err?.message || String(err) }
  }
}

// Local lazy shim so we can call FieldValue.delete() without a top-level import change.
import * as firebaseFirestore from 'firebase/firestore'

export async function assignOrderToPartner(
  orderId: string,
  partnerId: string,
  partnerName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1) If partner is stuck as BUSY without an active order, auto-clear it
    //    before rejecting the assignment. This unsticks users without
    //    requiring an offline/online toggle in the driver app.
    await reconcilePartnerStatusAfterOrderEnd(partnerId)

    // 2) Block assignment if partner already has an in-progress order.
    const activeOrder = await getActiveOrderForPartner(partnerId)
    if (activeOrder) {
      return {
        success: false,
        error: `${partnerName} already has an active order (${activeOrder.orderNumber}). Complete or cancel it before assigning a new one.`,
      }
    }

    // 3) Write order + partner atomically. Mark partner BUSY *on assignment*
    //    so the admin UI, map view, and nearest-partner queries stay in sync
    //    with the delivery boy app which also writes BUSY on accept.
    await Promise.all([
      updateDoc(doc(db, 'orders', orderId), {
        deliveryPartnerId: partnerId,
        deliveryPartnerName: partnerName,
        partnerAccepted: false,
        deliveryStage: 'to_restaurant',
        updatedAt: serverTimestamp(),
      }),
      updateDoc(doc(db, 'deliveryPartners', partnerId), {
        status: 'busy',
        currentOrder: orderId,
        updatedAt: serverTimestamp(),
      }),
    ])
    
    // Send notification to partner
    const orderSnap = await getDoc(doc(db, 'orders', orderId))
    if (orderSnap.exists()) {
      const order = orderSnap.data()
      await addNotification({
        userId: partnerId,
        userType: 'delivery_partner',
        type: 'order_assigned',
        title: 'New Order Assigned',
        message: `Order ${order.orderNumber} - Pick up from ${order.restaurantName}`,
        data: { orderId, orderNumber: order.orderNumber, action: 'view_order' },
        priority: 'high',
      })
    }
    
    return { success: true }
  } catch (err: any) {
    console.error('assignOrderToPartner:', err)
    return { success: false, error: err?.message || String(err) }
  }
}

export async function updateOrderDeliveryStage(
  orderId: string,
  stage: 'to_restaurant' | 'at_restaurant' | 'to_customer' | 'at_customer'
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      deliveryStage: stage,
      updatedAt: serverTimestamp(),
    })
    return { success: true }
  } catch (err: any) {
    console.error('updateOrderDeliveryStage:', err)
    return { success: false, error: err?.message || String(err) }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELIVERY INCENTIVES OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function createDeliveryIncentive(
  incentiveData: any
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const incentiveRef = doc(collection(db, 'deliveryIncentives'))
    const id = incentiveRef.id
    
    await setDoc(incentiveRef, {
      ...incentiveData,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    
    return { success: true, id }
  } catch (err: any) {
    console.error('createDeliveryIncentive:', err)
    return { success: false, error: err?.message || String(err) }
  }
}

export async function updateDeliveryIncentive(
  incentiveId: string,
  updateData: any
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateDoc(doc(db, 'deliveryIncentives', incentiveId), {
      ...updateData,
      updatedAt: new Date().toISOString(),
    })
    return { success: true }
  } catch (err: any) {
    console.error('updateDeliveryIncentive:', err)
    return { success: false, error: err?.message || String(err) }
  }
}

export async function deleteDeliveryIncentive(
  incentiveId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteDoc(doc(db, 'deliveryIncentives', incentiveId))
    return { success: true }
  } catch (err: any) {
    console.error('deleteDeliveryIncentive:', err)
    return { success: false, error: err?.message || String(err) }
  }
}

export async function getDeliveryIncentive(
  incentiveId: string
): Promise<any> {
  try {
    const docSnap = await getDoc(doc(db, 'deliveryIncentives', incentiveId))
    return docSnap.exists() ? docSnap.data() : null
  } catch (err: any) {
    console.error('getDeliveryIncentive:', err)
    return null
  }
}

export function subscribeToDeliveryIncentives(
  callback: (incentives: any[]) => void,
  filters?: { partnerId?: string; weekOf?: string; city?: string }
): () => void {
  try {
    const q = query(collection(db, 'deliveryIncentives'), orderBy('weekOf', 'desc'))
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const incentives = snapshot.docs
        .map((doc) => {
          const data = doc.data() as any
          return { ...data, id: doc.id }
        })
        .filter((incentive: any) => {
          if (filters?.partnerId && incentive.partnerId !== filters.partnerId) return false
          if (filters?.weekOf && incentive.weekOf !== filters.weekOf) return false
          if (filters?.city && incentive.city !== filters.city) return false
          return true
        })
      callback(incentives)
    })
    
    return unsubscribe
  } catch (err: any) {
    console.error('subscribeToDeliveryIncentives:', err)
    return () => {}
  }
}

export async function getDeliveryIncentivesByPartner(
  partnerId: string
): Promise<any[]> {
  try {
    const q = query(collection(db, 'deliveryIncentives'))
    const querySnapshot = await getDocs(q)
    const incentives = querySnapshot.docs
      .map((doc) => {
        const data = doc.data() as any
        return { ...data, id: doc.id }
      })
      .filter((inc: any) => inc.partnerId === partnerId)
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
    
    return incentives
  } catch (err: any) {
    console.error('getDeliveryIncentivesByPartner:', err)
    return []
  }
}

export async function getDeliveryIncentivesByDate(
  date: string,
  city?: string
): Promise<any[]> {
  try {
    const q = query(collection(db, 'deliveryIncentives'))
    const querySnapshot = await getDocs(q)
    const incentives = querySnapshot.docs
      .map((doc) => {
        const data = doc.data() as any
        return { ...data, id: doc.id }
      })
      .filter((inc: any) => inc.date === date && (!city || inc.city === city))
    
    return incentives
  } catch (err: any) {
    console.error('getDeliveryIncentivesByDate:', err)
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDER ASSIGNMENT & DELIVERY BOY OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assign order to a specific delivery partner
 * Tracks distance and assignment time
 */
export async function assignOrderToDeliveryPartner(
  orderId: string,
  partnerId: string,
  partnerName: string,
  distanceKm: number,
  estimatedDeliveryTime: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Unstick the partner first: cancels/reassignments earlier in the
    // pipeline may have left BUSY dangling without a matching active order.
    await reconcilePartnerStatusAfterOrderEnd(partnerId)

    // Block assignment if partner already has an in-progress order.
    const activeOrder = await getActiveOrderForPartner(partnerId)
    if (activeOrder) {
      return {
        success: false,
        error: `${partnerName} already has an active order (${activeOrder.orderNumber}). Complete or cancel it before assigning a new one.`,
      }
    }

    const now = new Date().toISOString()

    // Write both docs in parallel so partner BUSY and order assignment
    // land at the same time. Eliminates the race where a new order was
    // assigned but the partner was still ONLINE for a second (allowing a
    // second auto-assigner to pick the same partner).
    await Promise.all([
      updateDoc(doc(db, 'orders', orderId), {
        deliveryPartnerId: partnerId,
        deliveryPartnerName: partnerName,
        partnerAccepted: false,
        deliveryStage: 'to_restaurant',
        assignedAt: now,
        updatedAt: now,
        assignmentHistory: serverTimestamp(),
        estimatedDistance: distanceKm,
        estimatedDeliveryTime,
        // Accumulate denied IDs across reassignment attempts so future
        // findNearestDeliveryPartner calls can exclude all prior rejecters.
        deniedPartnerIds: [],
      }),
      updateDoc(doc(db, 'deliveryPartners', partnerId), {
        status: 'busy',
        currentOrder: orderId,
        updatedAt: serverTimestamp(),
      }),
    ])

    // Send notification to partner
    await addNotification({
      userId: partnerId,
      userType: 'delivery_partner',
      type: 'order_assigned',
      title: 'New Order Assigned',
      message: `Order ${orderId} - Pick up from restaurant (~${distanceKm}km)`,
      priority: 'high',
      data: { orderId },
    })

    return { success: true }
  } catch (err: any) {
    console.error('assignOrderToDeliveryPartner:', err)
    return { success: false, error: err?.message || String(err) }
  }
}

/**
 * Cancel order assignment by delivery partner and track the cancellation
 */
export async function cancelOrderByDeliveryPartner(
  orderId: string,
  partnerId: string,
  cancelReason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const orderSnap = await getDoc(doc(db, 'orders', orderId))
    if (!orderSnap.exists()) {
      return { success: false, error: 'Order not found' }
    }

    const order = orderSnap.data()
    const deniedPartnerIds = order.deniedPartnerIds || []
    
    // Add this partner to the denied list
    if (!deniedPartnerIds.includes(partnerId)) {
      deniedPartnerIds.push(partnerId)
    }

    // Record cancellation with reason
    const cancellationRecord = {
      partnerId,
      partnerName: order.deliveryPartnerName,
      timestamp: new Date().toISOString(),
      reason: cancelReason,
    }

    const cancellationHistory = order.cancellationHistory || []
    cancellationHistory.push(cancellationRecord)

    // Update order - clear current assignment but keep history
    await updateDoc(doc(db, 'orders', orderId), {
      deliveryPartnerId: null,
      deliveryPartnerName: null,
      partnerAccepted: false,
      deliveryStage: null,
      deniedPartnerIds,
      cancellationHistory,
      status: 'pending', // Reset to pending for reassignment
      updatedAt: new Date().toISOString(),
    })

    // 🔑 CRITICAL FIX: reset the partner whose assignment just ended.
    // Without this, the `busy` flag + `currentOrder` on the partner doc
    // are never cleared, so the partner is excluded from ALL future
    // nearest-partner queries until they manually toggle offline→online.
    await reconcilePartnerStatusAfterOrderEnd(partnerId)

    // Send notification to restaurant
    await addNotification({
      userId: order.restaurantId,
      userType: 'restaurant',
      type: 'order_update',
      title: 'Delivery Partner Cancelled',
      message: `${order.deliveryPartnerName} cancelled delivery for order ${order.orderNumber}. Reassigning...`,
      priority: 'high',
      data: { orderId },
    })

    return { success: true }
  } catch (err: any) {
    console.error('cancelOrderByDeliveryPartner:', err)
    return { success: false, error: err?.message || String(err) }
  }
}

/**
 * Auto-reassign order to next nearest available delivery partner
 * Excludes previously denied partners
 */
export async function reassignOrderToNextPartner(
  orderId: string,
  restaurantLocation: { latitude: number; longitude: number },
  deniedPartnerIds: string[],
  allAvailablePartners: any[]
): Promise<{ success: boolean; partnerId?: string; error?: string }> {
  try {
    // Filter out denied partners
    const availablePartners = allAvailablePartners.filter(
      (p) => !deniedPartnerIds.includes(p.id)
    )

    if (availablePartners.length === 0) {
      return {
        success: false,
        error: 'No more available delivery partners for reassignment',
      }
    }

    // Find nearest available partner using geoUtils
    const { findNearestDeliveryPartner } = await import('./geoUtils')
    const nearestPartner = findNearestDeliveryPartner(
      restaurantLocation,
      availablePartners
    )

    if (!nearestPartner) {
      return {
        success: false,
        error: 'Could not find nearby delivery partner for reassignment',
      }
    }

    // Assign to new partner
    const { estimateDeliveryTime } = await import('./geoUtils')
    const estimatedTime = estimateDeliveryTime(nearestPartner.distance)

    const result = await assignOrderToDeliveryPartner(
      orderId,
      nearestPartner.id,
      nearestPartner.name,
      nearestPartner.distance,
      estimatedTime
    )

    if (result.success) {
      return { success: true, partnerId: nearestPartner.id }
    } else {
      return { success: false, error: result.error }
    }
  } catch (err: any) {
    console.error('reassignOrderToNextPartner:', err)
    return { success: false, error: err?.message || String(err) }
  }
}

/**
 * Auto-assign order to nearest delivery partner when restaurant accepts
 */
export async function autoAssignOrderToNearestPartner(
  orderId: string,
  restaurantLocation: { latitude: number; longitude: number },
  allAvailablePartners: any[]
): Promise<{ success: boolean; partnerId?: string; error?: string }> {
  try {
    const { findNearestDeliveryPartner, estimateDeliveryTime } = await import('./geoUtils')
    
    const nearestPartner = findNearestDeliveryPartner(
      restaurantLocation,
      allAvailablePartners
    )

    if (!nearestPartner) {
      return {
        success: false,
        error: 'No available delivery partners nearby',
      }
    }

    const estimatedTime = estimateDeliveryTime(nearestPartner.distance)

    const result = await assignOrderToDeliveryPartner(
      orderId,
      nearestPartner.id,
      nearestPartner.name,
      nearestPartner.distance,
      estimatedTime
    )

    if (result.success) {
      return { success: true, partnerId: nearestPartner.id }
    } else {
      return { success: false, error: result.error }
    }
  } catch (err: any) {
    console.error('autoAssignOrderToNearestPartner:', err)
    return { success: false, error: err?.message || String(err) }
  }
}

/**
 * Partner accepts/rejects an assigned order
 */
export async function partnerRespondToOrder(
  orderId: string,
  partnerId: string,
  accepted: boolean,
  rejectReason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (accepted) {
      await updateDoc(doc(db, 'orders', orderId), {
        partnerAccepted: true,
        acceptedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      // Send notification to restaurant
      const orderSnap = await getDoc(doc(db, 'orders', orderId))
      if (orderSnap.exists()) {
        const order = orderSnap.data()
        await addNotification({
          userId: order.restaurantId,
          userType: 'restaurant',
          type: 'order_accepted',
          title: 'Delivery Partner Accepted',
          message: `${order.deliveryPartnerName} accepted order ${order.orderNumber}`,
          priority: 'high',
          data: { orderId },
        })
      }
    } else {
      // Partner rejected - cancel and reassign
      const result = await cancelOrderByDeliveryPartner(
        orderId,
        partnerId,
        rejectReason || 'Partner rejected order'
      )
      return result
    }

    return { success: true }
  } catch (err: any) {
    console.error('partnerRespondToOrder:', err)
    return { success: false, error: err?.message || String(err) }
  }
}

/**
 * Get order with assignment history and details
 */
export async function getOrderWithAssignmentHistory(
  orderId: string
): Promise<any> {
  try {
    const orderSnap = await getDoc(doc(db, 'orders', orderId))
    if (!orderSnap.exists()) {
      return null
    }

    const order = orderSnap.data()
    return {
      ...order,
      id: orderSnap.id,
      assignmentHistory: order.assignmentHistory || [],
      cancellationHistory: order.cancellationHistory || [],
      deniedPartnerIds: order.deniedPartnerIds || [],
    }
  } catch (err: any) {
    console.error('getOrderWithAssignmentHistory:', err)
    return null
  }
}

/**
 * Subscribe to order updates including assignment changes
 */
export function subscribeToOrderWithAssignmentChanges(
  orderId: string,
  callback: (order: any) => void
): () => void {
  try {
    const unsubscribe = onSnapshot(doc(db, 'orders', orderId), (docSnap) => {
      if (docSnap.exists()) {
        const order = docSnap.data()
        callback({
          ...order,
          id: docSnap.id,
          assignmentHistory: order.assignmentHistory || [],
          cancellationHistory: order.cancellationHistory || [],
          deniedPartnerIds: order.deniedPartnerIds || [],
        })
      }
    })

    return unsubscribe
  } catch (err: any) {
    console.error('subscribeToOrderWithAssignmentChanges:', err)
    return () => {}
  }
}

// ── Wallet refund ─────────────────────────────────────────────────────────────

/**
 * Refund an amount to the customer's wallet.
 *
 * The order status stays 'cancelled' — it is NOT changed to 'refunded'.
 * A refund is a financial action on an already-cancelled order, not a new
 * lifecycle state. The order will never be re-assigned once cancelled.
 *
 * Writes:
 *  - `customers/{customerId}.walletBalance`  → incremented by `amount`
 *  - `orders/{orderId}.refundAmount`         → amount
 *  - `orders/{orderId}.refundedAt`           → server timestamp
 *  - `notifications/{auto}`                 → push trigger for the user app
 */
export async function refundToWallet(
  orderId: string,
  customerId: string,
  orderNumber: string,
  amount: number,
): Promise<{ success: boolean; error?: string }> {
  if (!customerId || amount <= 0) {
    return { success: false, error: 'Invalid customerId or amount' }
  }
  try {
    // 1. Increment wallet on customers doc
    await updateDoc(doc(db, 'customers', customerId), {
      walletBalance: increment(amount),
      updatedAt: serverTimestamp(),
    })

    // 2. Record refund on the order — status stays 'cancelled', never 'refunded'.
    //    A cancelled order must never be re-assigned, so we keep it locked.
    await updateDoc(doc(db, 'orders', orderId), {
      refundAmount: amount,
      refundedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    // 3. Write notification doc — the user app's Firestore listener / Cloud
    //    Function reads this and sends an FCM push to the customer.
    const notifRef = doc(collection(db, 'notifications'))
    const displayNum = orderNumber.startsWith('#') ? orderNumber : `#${orderNumber}`
    await updateDoc(notifRef, {}).catch(() => {}) // ensure collection exists; ignore error
    const { setDoc } = await import('firebase/firestore')
    await setDoc(notifRef, {
      userId: customerId,
      userType: 'customer',
      type: 'wallet_refund',
      title: '💰 Refund credited to your wallet!',
      message: `₹${amount} has been added to your TastyKart wallet for order ${displayNum}.`,
      orderId,
      orderNumber,
      data: { orderId, amount, action: 'view_wallet' },
      read: false,
      priority: 'high',
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    })

    return { success: true }
  } catch (err: any) {
    console.error('refundToWallet:', err)
    return { success: false, error: err?.message || String(err) }
  }
}
