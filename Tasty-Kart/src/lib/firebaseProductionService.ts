/**
 * FIREBASE PRODUCTION SERVICE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Handles all Firestore operations for the production delivery-partner management
 * and earning system (Phase 3 onwards).
 * 
 * Key Features:
 * - City/Zone/Slot management
 * - Earning rules and calculations
 * - Wallet transactions and payouts
 * - Incentive campaigns and progress tracking
 * - Partner levels and classifications
 * - Admin audit logging
 * - Idempotency and transaction safety
 */

import {
  collection, doc, setDoc, getDoc, getDocs, onSnapshot, updateDoc, deleteDoc,
  query, orderBy, where, limit, Timestamp, serverTimestamp, FieldValue,
  increment, arrayUnion, writeBatch, runTransaction, Transaction
} from 'firebase/firestore'
import { db } from './firebase'
import type {
  City, Zone, Slot, SlotBooking, EarningRule, IncentiveCampaign, IncentiveTier,
  IncentiveProgress, PartnerLevel, WalletTransaction, PayoutRequest, Earning,
  AdminAuditLog, DistanceSlab
} from '@/data/dummy'

// ═══════════════════════════════════════════════════════════════════════════════
// CITIES MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a new city
 */
export async function createCity(cityData: Omit<City, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>, adminId: string) {
  try {
    const cityId = `city_${Date.now()}`
    const now = new Date().toISOString()
    
    await setDoc(doc(db, 'cities', cityId), {
      ...cityData,
      id: cityId,
      createdAt: now,
      updatedAt: now,
      createdBy: adminId,
      updatedBy: adminId
    })
    
    // Audit log
    await logAdminAction('CREATE_CITY', 'CITY', cityId, null, cityData, adminId, 'New city created')
    
    return { success: true, id: cityId }
  } catch (err) {
    return { success: false, error: err }
  }
}

/**
 * Subscribe to cities in real-time
 */
export function subscribeToCities(onData: (cities: City[]) => void) {
  const q = query(collection(db, 'cities'), orderBy('updatedAt', 'desc'))
  return onSnapshot(q, (snap) => {
    const list: City[] = []
    snap.forEach(d => list.push({ id: d.id, ...d.data() } as City))
    onData(list)
  })
}

/**
 * Get single city by ID
 */
export async function getCity(cityId: string) {
  try {
    const snap = await getDoc(doc(db, 'cities', cityId))
    return snap.exists() ? { ...snap.data(), id: snap.id } as City : null
  } catch (err) {
    return null
  }
}

/**
 * Update city details
 */
export async function updateCity(cityId: string, updates: Partial<City>, adminId: string) {
  try {
    const before = await getCity(cityId)
    const now = new Date().toISOString()
    
    await updateDoc(doc(db, 'cities', cityId), {
      ...updates,
      updatedAt: now,
      updatedBy: adminId
    })
    
    // Audit log
    const after = { ...before, ...updates, updatedAt: now, updatedBy: adminId }
    await logAdminAction('UPDATE_CITY', 'CITY', cityId, before, after, adminId, 'City updated')
    
    return { success: true }
  } catch (err) {
    return { success: false, error: err }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ZONES MANAGEMENT (Nested under cities)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a new zone under a city
 */
export async function createZone(cityId: string, zoneData: Omit<Zone, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>, adminId: string) {
  try {
    const zoneId = `zone_${cityId}_${Date.now()}`
    const now = new Date().toISOString()
    
    await setDoc(doc(db, 'cities', cityId, 'zones', zoneId), {
      ...zoneData,
      id: zoneId,
      createdAt: now,
      updatedAt: now,
      createdBy: adminId,
      updatedBy: adminId
    })
    
    await logAdminAction('CREATE_ZONE', 'ZONE', zoneId, null, zoneData, adminId, `Zone created in city ${cityId}`)
    
    return { success: true, id: zoneId }
  } catch (err) {
    return { success: false, error: err }
  }
}

/**
 * Subscribe to zones for a city in real-time
 */
export function subscribeToZones(cityId: string, onData: (zones: Zone[]) => void) {
  const q = query(
    collection(db, 'cities', cityId, 'zones'),
    orderBy('updatedAt', 'desc')
  )
  return onSnapshot(q, (snap) => {
    const list: Zone[] = []
    snap.forEach(d => list.push({ id: d.id, ...d.data() } as Zone))
    onData(list)
  })
}

/**
 * Get single zone
 */
export async function getZone(cityId: string, zoneId: string) {
  try {
    const snap = await getDoc(doc(db, 'cities', cityId, 'zones', zoneId))
    return snap.exists() ? { ...snap.data(), id: snap.id } as Zone : null
  } catch (err) {
    return null
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLOTS MANAGEMENT (Nested under zones)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a new slot under a zone
 */
export async function createSlot(cityId: string, zoneId: string, slotData: Omit<Slot, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>, adminId: string) {
  try {
    const slotId = `slot_${cityId}_${zoneId}_${Date.now()}`
    const now = new Date().toISOString()
    
    await setDoc(doc(db, 'cities', cityId, 'zones', zoneId, 'slots', slotId), {
      ...slotData,
      id: slotId,
      createdAt: now,
      updatedAt: now,
      createdBy: adminId,
      updatedBy: adminId
    })
    
    await logAdminAction('CREATE_SLOT', 'SLOT', slotId, null, slotData, adminId, `Slot created in zone ${zoneId}`)
    
    return { success: true, id: slotId }
  } catch (err) {
    return { success: false, error: err }
  }
}

/**
 * Subscribe to slots for a zone in real-time
 */
export function subscribeToSlots(cityId: string, zoneId: string, onData: (slots: Slot[]) => void) {
  const q = query(
    collection(db, 'cities', cityId, 'zones', zoneId, 'slots'),
    orderBy('date', 'asc')
  )
  return onSnapshot(q, (snap) => {
    const list: Slot[] = []
    snap.forEach(d => list.push({ id: d.id, ...d.data() } as Slot))
    onData(list)
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLOT BOOKINGS WITH TRANSACTION SAFETY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Book a slot for a delivery partner with race condition prevention
 * Uses deterministic booking ID to prevent duplicates
 */
export async function bookSlot(
  cityId: string,
  zoneId: string,
  slotId: string,
  partnerId: string,
  slotDate: string
): Promise<{ success: boolean; error?: any; reason?: string }> {
  try {
    const bookingId = `${slotId}_${partnerId}_${slotDate}`
    const now = new Date().toISOString()
    
    return await runTransaction(db, async (txn: Transaction) => {
      // 1. Read current slot
      const slotRef = doc(db, 'cities', cityId, 'zones', zoneId, 'slots', slotId)
      const slotSnap = await txn.get(slotRef)
      
      if (!slotSnap.exists()) {
        throw new Error('SLOT_NOT_FOUND')
      }
      
      const slotData = slotSnap.data() as Slot
      
      // 2. Check capacity
      if (slotData.currentBookings >= slotData.maxPartners) {
        throw new Error('SLOT_FULL')
      }
      
      // 3. Check for duplicate booking
      const bookingRef = doc(db, 'deliveryPartners', partnerId, 'slotBookings', bookingId)
      const existingBooking = await txn.get(bookingRef)
      
      if (existingBooking.exists()) {
        const bookingStatus = (existingBooking.data() as SlotBooking).status
        if (bookingStatus === 'ACTIVE' || bookingStatus === 'BOOKED') {
          throw new Error('ALREADY_BOOKED')
        }
      }
      
      // 4. Increment slot capacity
      txn.update(slotRef, {
        currentBookings: increment(1),
        availableSpots: increment(-1),
        updatedAt: now
      })
      
      // 5. Create booking in partner's subcollection
      txn.set(bookingRef, {
        id: bookingId,
        slotId,
        deliveryBoyId: partnerId,
        cityId,
        zoneId,
        bookingDate: slotDate,
        bookedAt: now,
        status: 'BOOKED',
        createdAt: now,
        updatedAt: now
      } as SlotBooking)
      
      // 6. Create booking in slot's subcollection (for querying from slot side)
      const slotBookingRef = doc(db, 'cities', cityId, 'zones', zoneId, 'slots', slotId, 'bookings', bookingId)
      txn.set(slotBookingRef, {
        id: bookingId,
        slotId,
        deliveryBoyId: partnerId,
        cityId,
        zoneId,
        bookingDate: slotDate,
        bookedAt: now,
        status: 'BOOKED',
        createdAt: now,
        updatedAt: now
      } as SlotBooking)
      
      return { success: true }
    })
  } catch (err: any) {
    const reason = err.message || 'Unknown error'
    return { success: false, error: err, reason }
  }
}

/**
 * Subscribe to bookings for a partner in real-time
 */
export function subscribeToPartnerBookings(partnerId: string, onData: (bookings: SlotBooking[]) => void) {
  const q = query(
    collection(db, 'deliveryPartners', partnerId, 'slotBookings'),
    orderBy('bookingDate', 'desc')
  )
  return onSnapshot(q, (snap) => {
    const list: SlotBooking[] = []
    snap.forEach(d => list.push({ id: d.id, ...d.data() } as SlotBooking))
    onData(list)
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// EARNING RULES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create earning rule for a city
 */
export async function createEarningRule(cityId: string, ruleData: Omit<EarningRule, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>, adminId: string) {
  try {
    const ruleId = `rule_${cityId}_${Date.now()}`
    const now = new Date().toISOString()
    
    await setDoc(doc(db, 'cities', cityId, 'earningRules', ruleId), {
      ...ruleData,
      id: ruleId,
      createdAt: now,
      updatedAt: now,
      createdBy: adminId,
      updatedBy: adminId
    })
    
    await logAdminAction('CREATE_EARNING_RULE', 'EARNING_RULE', ruleId, null, ruleData, adminId, `Earning rule created for city ${cityId}`)
    
    return { success: true, id: ruleId }
  } catch (err) {
    return { success: false, error: err }
  }
}

/**
 * Get all active earning rules for a city (ordered by priority)
 */
export async function getActiveEarningRules(cityId: string): Promise<EarningRule[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'cities', cityId, 'earningRules'),
        where('isActive', '==', true),
        where('status', '==', 'ACTIVE'),
        orderBy('priority', 'desc')
      )
    )
    
    const rules: EarningRule[] = []
    snap.forEach(d => rules.push({ id: d.id, ...d.data() } as EarningRule))
    return rules
  } catch (err) {
    return []
  }
}

/**
 * Calculate earning for an order based on applicable rules
 */
export async function calculateOrderEarning(
  cityId: string,
  zoneId: string,
  distanceKm: number,
  isPeakHour: boolean,
  isHighDemand: boolean,
  partnerLevelMultiplier: number = 1.0
): Promise<{ baseEarning: number; breakdown: Record<string, number> }> {
  try {
    const rules = await getActiveEarningRules(cityId)
    if (rules.length === 0) {
      return { baseEarning: 0, breakdown: {} }
    }
    
    // For now, use the highest priority rule
    const rule = rules[0]
    
    let earning = rule.baseFee
    const breakdown: Record<string, number> = { base: rule.baseFee }
    
    // Distance calculation
    const distanceSlab = rule.distanceSlabs.find(slab => 
      distanceKm >= slab.minKm && (!slab.maxKm || distanceKm <= slab.maxKm)
    )
    
    if (distanceSlab) {
      const distanceEarning = distanceKm * distanceSlab.amountPerKm
      earning += distanceEarning
      breakdown.distance = distanceEarning
    }
    
    // Peak hour multiplier
    if (isPeakHour && rule.peakHourMultiplier) {
      const peakBonus = earning * (rule.peakHourMultiplier - 1)
      earning += peakBonus
      breakdown.peak = peakBonus
    }
    
    // High demand multiplier
    if (isHighDemand && rule.nightDeliveryMultiplier) {
      const demandBonus = earning * (rule.nightDeliveryMultiplier - 1)
      earning += demandBonus
      breakdown.highDemand = demandBonus
    }
    
    // Partner level multiplier
    earning *= partnerLevelMultiplier
    breakdown.levelMultiplier = partnerLevelMultiplier
    
    return { baseEarning: earning, breakdown }
  } catch (err) {
    return { baseEarning: 0, breakdown: {} }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WALLET TRANSACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create wallet transaction with idempotency
 */
export async function createWalletTransaction(
  partnerId: string,
  transaction: Omit<WalletTransaction, 'id' | 'createdAt' | 'createdBy'>
): Promise<{ success: boolean; id?: string; error?: any }> {
  try {
    const txId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    const now = new Date().toISOString()
    
    // Check for duplicate using idempotency key
    if (transaction.idempotencyKey) {
      const snap = await getDocs(
        query(
          collection(db, 'deliveryPartners', partnerId, 'walletTransactions'),
          where('idempotencyKey', '==', transaction.idempotencyKey),
          where('status', '==', 'COMPLETED')
        )
      )
      
      if (snap.size > 0) {
        // Already processed, return existing
        return { success: true, id: snap.docs[0].id }
      }
    }
    
    await setDoc(doc(db, 'deliveryPartners', partnerId, 'walletTransactions', txId), {
      ...transaction,
      id: txId,
      createdAt: now,
      createdBy: 'system'
    })
    
    return { success: true, id: txId }
  } catch (err) {
    return { success: false, error: err }
  }
}

/**
 * Subscribe to wallet transactions for a partner
 */
export function subscribeToWalletTransactions(partnerId: string, onData: (transactions: WalletTransaction[]) => void) {
  const q = query(
    collection(db, 'deliveryPartners', partnerId, 'walletTransactions'),
    orderBy('createdAt', 'desc'),
    limit(100)
  )
  return onSnapshot(q, (snap) => {
    const list: WalletTransaction[] = []
    snap.forEach(d => list.push({ id: d.id, ...d.data() } as WalletTransaction))
    onData(list)
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYOUT REQUESTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create payout request for partner
 */
export async function createPayoutRequest(
  partnerId: string,
  amount: number
): Promise<{ success: boolean; id?: string; error?: any }> {
  try {
    const payoutId = `payout_${partnerId}_${Date.now()}`
    const now = new Date().toISOString()
    
    await setDoc(doc(db, 'deliveryPartners', partnerId, 'payoutRequests', payoutId), {
      id: payoutId,
      deliveryBoyId: partnerId,
      partnerId,
      requestedAmount: amount,
      requestedAt: now,
      status: 'PENDING',
      idempotencyKey: `payout_${payoutId}`,
      createdAt: now,
      updatedAt: now
    } as PayoutRequest)
    
    return { success: true, id: payoutId }
  } catch (err) {
    return { success: false, error: err }
  }
}

/**
 * Subscribe to payout requests for a partner
 */
export function subscribeToPayoutRequests(partnerId: string, onData: (payouts: PayoutRequest[]) => void) {
  const q = query(
    collection(db, 'deliveryPartners', partnerId, 'payoutRequests'),
    orderBy('requestedAt', 'desc')
  )
  return onSnapshot(q, (snap) => {
    const list: PayoutRequest[] = []
    snap.forEach(d => list.push({ id: d.id, ...d.data() } as PayoutRequest))
    onData(list)
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARTNER LEVELS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Subscribe to partner levels
 */
export function subscribeToPartnerLevels(onData: (levels: PartnerLevel[]) => void) {
  const q = query(collection(db, 'partnerLevels'), orderBy('priority', 'asc'))
  return onSnapshot(q, (snap) => {
    const list: PartnerLevel[] = []
    snap.forEach(d => list.push({ id: d.id, ...d.data() } as PartnerLevel))
    onData(list)
  })
}

/**
 * Determine partner level based on metrics
 */
export async function determinePartnerLevel(
  completedTrips: number,
  avgRating: number,
  completionRate: number
): Promise<string | null> {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'partnerLevels'),
        where('isActive', '==', true),
        orderBy('minTrips', 'desc')
      )
    )
    
    let selectedLevel: any | null = null
    
    snap.forEach(d => {
      const level = { id: d.id, ...d.data() } as any
      
      if (completedTrips >= level.minTrips &&
          avgRating >= level.minRating &&
          completionRate >= level.minCompletionRate &&
          (!level.maxTrips || completedTrips <= level.maxTrips)) {
        if (!selectedLevel || level.minTrips > selectedLevel.minTrips) {
          selectedLevel = level
        }
      }
    })
    
    return selectedLevel?.id || null
  } catch (err) {
    return null
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN AUDIT LOGGING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Log admin action for audit trail
 */
export async function logAdminAction(
  action: string,
  entityType: string,
  entityId: string,
  before: any,
  after: any,
  adminId: string,
  reason?: string
) {
  try {
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    const now = new Date().toISOString()
    
    await setDoc(doc(db, 'adminAuditLogs', logId), {
      id: logId,
      adminId,
      adminEmail: 'admin@system', // TODO: Get from auth context
      adminRole: 'ADMIN', // TODO: Get from auth context
      createdAt: now,
      action,
      entityType,
      entityId,
      before,
      after,
      reason,
      immutable: true
    } as AdminAuditLog)
  } catch (err) {
    console.error('Failed to log admin action:', err)
  }
}

/**
 * Subscribe to audit logs
 */
export function subscribeToAuditLogs(onData: (logs: any[]) => void) {
  const q = query(
    collection(db, 'adminAuditLogs'),
    orderBy('createdAt', 'desc'),
    limit(100)
  )
  return onSnapshot(q, (snap) => {
    const list: any[] = []
    snap.forEach(d => list.push({ id: d.id, ...d.data() }))
    onData(list)
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// INCENTIVE CAMPAIGNS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create incentive campaign
 */
export async function createIncentiveCampaign(
  campaignData: Omit<IncentiveCampaign, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>,
  adminId: string
) {
  try {
    const campaignId = `campaign_${Date.now()}`
    const now = new Date().toISOString()
    
    await setDoc(doc(db, 'incentiveCampaigns', campaignId), {
      ...campaignData,
      id: campaignId,
      createdAt: now,
      updatedAt: now,
      createdBy: adminId,
      updatedBy: adminId
    })
    
    await logAdminAction('CREATE_CAMPAIGN', 'INCENTIVE_CAMPAIGN', campaignId, null, campaignData, adminId)
    
    return { success: true, id: campaignId }
  } catch (err) {
    return { success: false, error: err }
  }
}

/**
 * Subscribe to active incentive campaigns
 */
export function subscribeToActiveCampaigns(onData: (campaigns: any[]) => void) {
  const q = query(
    collection(db, 'incentiveCampaigns'),
    where('isActive', '==', true),
    orderBy('startAt', 'desc')
  )
  return onSnapshot(q, (snap) => {
    const list: any[] = []
    snap.forEach(d => list.push({ id: d.id, ...d.data() }))
    onData(list)
  })
}

export { Timestamp, serverTimestamp, increment }
