import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'

admin.initializeApp()

const db = admin.firestore()
const Timestamp = admin.firestore.Timestamp

/**
 * PHASE 11: CLOUD FUNCTIONS FOR DELIVERY PARTNER EARNING SYSTEM
 * 
 * Implements:
 * 1. Order earnings calculation (triggered on order completion)
 * 2. Wallet transaction creation with idempotency
 * 3. Incentive reward distribution
 * 4. Payout request processing
 * 5. Partner level determination
 * 6. Audit logging for all actions
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Order {
  id: string
  restaurantId: string
  deliveryPartnerId?: string
  deliveryFee: number
  finalTotal: number
  status: string
  createdAt: admin.firestore.Timestamp
  completedAt?: admin.firestore.Timestamp
  discountAmount?: number
}

interface EarningRule {
  id: string
  scope: 'GLOBAL' | 'CITY' | 'ZONE'
  scopeId?: string
  baseFee: number
  peakHourMultiplier?: number
  nightMultiplier?: number
  isActive: boolean
  priority: number
}

interface WalletTransaction {
  id: string
  deliveryBoyId: string
  type: 'ORDER_EARNING' | 'BONUS' | 'INCENTIVE' | 'ADJUSTMENT' | 'DEDUCTION' | 'PAYOUT'
  description: string
  amount: number
  direction: 'CREDIT' | 'DEBIT'
  orderId?: string
  earningId?: string
  campaignId?: string
  idempotencyKey: string
  createdAt: admin.firestore.Timestamp
}

interface Earning {
  id: string
  orderId: string
  deliveryPartnerId: string
  baseEarning: number
  multiplier: number
  finalEarning: number
  ruleId: string
  appliedAt: admin.firestore.Timestamp
}

interface IncentiveCampaign {
  id: string
  type: 'TRIP' | 'EARNINGS' | 'RATING' | 'HYBRID'
  tiers: IncentiveTier[]
  activeFrom: admin.firestore.Timestamp
  activeTo: admin.firestore.Timestamp
  isActive: boolean
}

interface IncentiveTier {
  minThreshold: number
  maxThreshold?: number
  rewardAmount: number
  rewardType: 'FIXED' | 'PERCENTAGE'
}

interface PayoutRequest {
  id: string
  deliveryBoyId: string
  requestedAmount: number
  status: 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED'
  approvedBy?: string
  approvedAt?: admin.firestore.Timestamp
  rejectionReason?: string
  completedAt?: admin.firestore.Timestamp
  transactionReference?: string
  createdAt: admin.firestore.Timestamp
  updatedAt: admin.firestore.Timestamp
}

// ============================================================================
// FIRESTORE TRIGGER: Order Completion → Calculate Earnings
// ============================================================================

/**
 * Triggered when an order document changes status to 'COMPLETED'
 * Calculates earning based on delivery fee, earning rules, and multipliers
 * Creates wallet transaction and updates delivery partner balance
 */
export const onOrderCompleted = functions.firestore
  .document('orders/{orderId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data() as Order
    const after = change.after.data() as Order
    const orderId = context.params.orderId

    // Only process if status changed to COMPLETED
    if (before.status === 'COMPLETED' || after.status !== 'COMPLETED') {
      return null
    }

    try {
      const partnerId = after.deliveryPartnerId
      if (!partnerId) {
        console.warn(`Order ${orderId} completed but no delivery partner assigned`)
        return null
      }

      // Step 1: Fetch earning rules (ordered by priority)
      const rulesSnapshot = await db
        .collection('earningRules')
        .where('isActive', '==', true)
        .orderBy('priority', 'desc')
        .limit(1)
        .get()

      if (rulesSnapshot.empty) {
        console.error(`No active earning rules found for order ${orderId}`)
        return null
      }

      const rule = rulesSnapshot.docs[0].data() as EarningRule

      // Step 2: Calculate earning with multipliers
      const isPeakHour = isPeakTime(after.completedAt || Timestamp.now())
      const isNightHour = isNightTime(after.completedAt || Timestamp.now())

      let multiplier = 1
      if (isPeakHour && rule.peakHourMultiplier) multiplier *= rule.peakHourMultiplier
      if (isNightHour && rule.nightMultiplier) multiplier *= rule.nightMultiplier

      const finalEarning = rule.baseFee * multiplier

      // Step 3: Create earning record
      const earningDoc = await db.collection('earnings').add({
        orderId,
        deliveryPartnerId: partnerId,
        baseEarning: rule.baseFee,
        multiplier,
        finalEarning,
        ruleId: rule.id,
        appliedAt: Timestamp.now(),
      } as Earning)

      // Step 4: Create wallet transaction with idempotency
      const idempotencyKey = `order-${orderId}-earning`
      const walletTxnRef = db
        .collection('walletTransactions')
        .doc(idempotencyKey)

      await db.runTransaction(async (transaction) => {
        const existingTxn = await transaction.get(walletTxnRef)
        if (existingTxn.exists) {
          console.log(`Wallet transaction already exists for ${idempotencyKey}`)
          return
        }

        transaction.set(walletTxnRef, {
          id: idempotencyKey,
          deliveryBoyId: partnerId,
          type: 'ORDER_EARNING',
          description: `Earning for order ${orderId}`,
          amount: finalEarning,
          direction: 'CREDIT',
          orderId,
          earningId: earningDoc.id,
          idempotencyKey,
          createdAt: Timestamp.now(),
        } as WalletTransaction)

        // Update partner wallet balance
        transaction.update(db.collection('deliveryPartners').doc(partnerId), {
          totalEarnings: admin.firestore.FieldValue.increment(finalEarning),
          walletBalance: admin.firestore.FieldValue.increment(finalEarning),
          totalCompletedOrders: admin.firestore.FieldValue.increment(1),
          lastEarningAt: Timestamp.now(),
        })
      })

      // Step 5: Log audit event
      await db.collection('adminAuditLog').add({
        action: 'ORDER_EARNING_CALCULATED',
        actor: 'SYSTEM',
        resourceType: 'ORDER',
        resourceId: orderId,
        changes: {
          partnerEarning: finalEarning,
          multiplier,
          earningRuleId: rule.id,
        },
        timestamp: Timestamp.now(),
      })

      console.log(`Earning calculated for order ${orderId}: ${finalEarning}`)
      return null
    } catch (error) {
      console.error(`Error calculating earning for order ${orderId}:`, error)
      throw error
    }
  })

// ============================================================================
// FIRESTORE TRIGGER: Incentive Milestone → Apply Reward
// ============================================================================

/**
 * Triggered when partner earnings reach incentive thresholds
 * Distributes bonus rewards based on active incentive campaigns
 */
export const onPartnerEarningsUpdated = functions.firestore
  .document('deliveryPartners/{partnerId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data()
    const after = change.after.data()
    const partnerId = context.params.partnerId

    // Only process if earnings changed
    if (before.totalEarnings === after.totalEarnings) {
      return null
    }

    try {
      const earningsDelta = after.totalEarnings - before.totalEarnings

      // Fetch active incentive campaigns
      const campaignsSnapshot = await db
        .collection('incentiveCampaigns')
        .where('isActive', '==', true)
        .where('activeFrom', '<=', Timestamp.now())
        .where('activeTo', '>=', Timestamp.now())
        .get()

      if (campaignsSnapshot.empty) {
        return null
      }

      for (const campaignDoc of campaignsSnapshot.docs) {
        const campaign = campaignDoc.data() as IncentiveCampaign

        // Check EARNINGS type campaigns
        if (campaign.type !== 'EARNINGS' && campaign.type !== 'HYBRID') {
          continue
        }

        // Check if partner qualifies for tier rewards
        const matchingTier = campaign.tiers.find(
          (tier) =>
            after.totalEarnings >= tier.minThreshold &&
            (!tier.maxThreshold || after.totalEarnings <= tier.maxThreshold)
        )

        if (!matchingTier) continue

        // Calculate reward
        const rewardAmount =
          matchingTier.rewardType === 'FIXED'
            ? matchingTier.rewardAmount
            : (after.totalEarnings * matchingTier.rewardAmount) / 100

        // Check if already awarded (via incentiveProgress)
        const progressRef = db
          .collection('incentiveProgress')
          .doc(`${campaignDoc.id}-${partnerId}`)

        await db.runTransaction(async (transaction) => {
          const progress = await transaction.get(progressRef)

          if (!progress.exists || !progress.data()?.tierRewardedAt) {
            // Create wallet transaction for reward
            const rewardTxnId = `incentive-${campaignDoc.id}-${partnerId}-${Date.now()}`
            transaction.set(db.collection('walletTransactions').doc(rewardTxnId), {
              id: rewardTxnId,
              deliveryBoyId: partnerId,
              type: 'INCENTIVE',
              description: `Incentive reward from campaign ${campaign.type}`,
              amount: rewardAmount,
              direction: 'CREDIT',
              campaignId: campaignDoc.id,
              idempotencyKey: rewardTxnId,
              createdAt: Timestamp.now(),
            } as WalletTransaction)

            // Update incentive progress
            transaction.set(
              progressRef,
              {
                campaignId: campaignDoc.id,
                partnerId,
                tierReached: matchingTier.minThreshold,
                rewardAwarded: rewardAmount,
                tierRewardedAt: Timestamp.now(),
              },
              { merge: true }
            )

            // Update partner balance
            transaction.update(db.collection('deliveryPartners').doc(partnerId), {
              walletBalance: admin.firestore.FieldValue.increment(rewardAmount),
              incentivesEarned: admin.firestore.FieldValue.increment(rewardAmount),
            })
          }
        })
      }

      return null
    } catch (error) {
      console.error(`Error processing incentives for partner ${partnerId}:`, error)
      throw error
    }
  })

// ============================================================================
// CALLABLE FUNCTION: Process Payout Approval
// ============================================================================

/**
 * Admin approves a payout request
 * Marks request as APPROVED and initiates transfer
 * Called from Payouts admin page
 */
export const approvePayout = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
  }

  const { payoutId, approvedAmount } = data

  try {
    const payoutRef = db.collection('payoutRequests').doc(payoutId)

    await db.runTransaction(async (transaction) => {
      const payout = await transaction.get(payoutRef)

      if (!payout.exists) {
        throw new functions.https.HttpsError('not-found', 'Payout request not found')
      }

      const payoutData = payout.data() as PayoutRequest

      if (payoutData.status !== 'PENDING') {
        throw new functions.https.HttpsError('failed-precondition', 'Payout already processed')
      }

      // Update payout status
      transaction.update(payoutRef, {
        status: 'APPROVED',
        approvedBy: context.auth!.uid,
        approvedAt: Timestamp.now(),
        approvedAmount: approvedAmount || payoutData.requestedAmount,
        updatedAt: Timestamp.now(),
      })

      // Create debit transaction in wallet
      const debitTxnId = `payout-${payoutId}-debit`
      transaction.set(db.collection('walletTransactions').doc(debitTxnId), {
        id: debitTxnId,
        deliveryBoyId: payoutData.deliveryBoyId,
        type: 'PAYOUT',
        description: `Payout approved: ₹${approvedAmount || payoutData.requestedAmount}`,
        amount: approvedAmount || payoutData.requestedAmount,
        direction: 'DEBIT',
        idempotencyKey: debitTxnId,
        createdAt: Timestamp.now(),
      } as WalletTransaction)

      // Update partner balance
      transaction.update(
        db.collection('deliveryPartners').doc(payoutData.deliveryBoyId),
        {
          walletBalance: admin.firestore.FieldValue.increment(
            -(approvedAmount || payoutData.requestedAmount)
          ),
        }
      )

      // Log audit
      transaction.set(db.collection('adminAuditLog').doc(), {
        action: 'PAYOUT_APPROVED',
        actor: context.auth!.uid,
        resourceType: 'PAYOUT_REQUEST',
        resourceId: payoutId,
        changes: {
          approvedAmount: approvedAmount || payoutData.requestedAmount,
        },
        timestamp: Timestamp.now(),
      })
    })

    return { success: true, payoutId, status: 'APPROVED' }
  } catch (error) {
    console.error(`Error approving payout ${payoutId}:`, error)
    throw error
  }
})

// ============================================================================
// CALLABLE FUNCTION: Reject Payout
// ============================================================================

/**
 * Admin rejects a payout request
 * Called from Payouts admin page
 */
export const rejectPayout = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
  }

  const { payoutId, rejectionReason } = data

  try {
    const payoutRef = db.collection('payoutRequests').doc(payoutId)

    await db.runTransaction(async (transaction) => {
      const payout = await transaction.get(payoutRef)

      if (!payout.exists) {
        throw new functions.https.HttpsError('not-found', 'Payout request not found')
      }

      const payoutData = payout.data() as PayoutRequest

      if (payoutData.status !== 'PENDING') {
        throw new functions.https.HttpsError('failed-precondition', 'Payout already processed')
      }

      transaction.update(payoutRef, {
        status: 'REJECTED',
        rejectedBy: context.auth!.uid,
        rejectedAt: Timestamp.now(),
        rejectionReason: rejectionReason || 'No reason provided',
        updatedAt: Timestamp.now(),
      })

      // Log audit
      transaction.set(db.collection('adminAuditLog').doc(), {
        action: 'PAYOUT_REJECTED',
        actor: context.auth!.uid,
        resourceType: 'PAYOUT_REQUEST',
        resourceId: payoutId,
        changes: { rejectionReason },
        timestamp: Timestamp.now(),
      })
    })

    return { success: true, payoutId, status: 'REJECTED' }
  } catch (error) {
    console.error(`Error rejecting payout ${payoutId}:`, error)
    throw error
  }
})

// ============================================================================
// CALLABLE FUNCTION: Calculate Partner Level
// ============================================================================

/**
 * Determines partner tier based on cumulative metrics
 * Levels: BRONZE, SILVER, GOLD, PLATINUM
 * Called daily or after significant milestones
 */
export const calculatePartnerLevel = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
  }

  const { partnerId } = data

  try {
    const partnerRef = db.collection('deliveryPartners').doc(partnerId)
    const partner = await partnerRef.get()

    if (!partner.exists) {
      throw new functions.https.HttpsError('not-found', 'Partner not found')
    }

    const partnerData = partner.data()!

    // Determine level based on metrics
    let level = 'BRONZE'
    let levelScore = 0

    // Score: 30 points per 1000 in total earnings
    levelScore += (partnerData.totalEarnings || 0) / 1000 * 0.3

    // Score: 10 points per completed order
    levelScore += (partnerData.totalCompletedOrders || 0) * 0.1

    // Score: 5 points per rating point (5-star scale)
    levelScore += (partnerData.avgRating || 0) * 5

    // Determine level
    if (levelScore >= 500) level = 'PLATINUM'
    else if (levelScore >= 300) level = 'GOLD'
    else if (levelScore >= 100) level = 'SILVER'

    await partnerRef.update({
      partnerLevel: level,
      levelScore,
      levelCalculatedAt: Timestamp.now(),
    })

    return { success: true, partnerId, level, score: levelScore }
  } catch (error) {
    console.error(`Error calculating partner level for ${data.partnerId}:`, error)
    throw error
  }
})

// ============================================================================
// SCHEDULED FUNCTION: Daily Audit Cleanup
// ============================================================================

/**
 * Runs daily to clean up old audit logs (older than 90 days)
 * Maintains Firestore performance and storage
 */
export const cleanupOldAuditLogs = functions.pubsub
  .schedule('every day 02:00')
  .onRun(async () => {
    try {
      const ninetyDaysAgo = Timestamp.fromDate(
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      )

      const oldLogs = await db
        .collection('adminAuditLog')
        .where('timestamp', '<', ninetyDaysAgo)
        .limit(1000)
        .get()

      const batch = db.batch()
      oldLogs.docs.forEach((doc) => batch.delete(doc.ref))
      await batch.commit()

      console.log(`Deleted ${oldLogs.size} old audit logs`)
      return null
    } catch (error) {
      console.error('Error cleaning up audit logs:', error)
      throw error
    }
  })

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function isPeakTime(timestamp: admin.firestore.Timestamp): boolean {
  const hour = new Date(timestamp.toMillis()).getHours()
  // Peak hours: 12-2 PM, 6-9 PM
  return (hour >= 12 && hour < 14) || (hour >= 18 && hour < 21)
}

function isNightTime(timestamp: admin.firestore.Timestamp): boolean {
  const hour = new Date(timestamp.toMillis()).getHours()
  // Night hours: 9 PM to 6 AM
  return hour >= 21 || hour < 6
}


// ============================================================================
// RAZORPAY PAYMENT FUNCTIONS
// ============================================================================

import * as crypto from 'crypto'
import {defineSecret} from 'firebase-functions/params'
import {onCall as onCallV2, onRequest, HttpsError} from 'firebase-functions/v2/https'
import Razorpay = require('razorpay')
import {logger} from 'firebase-functions'

const RAZORPAY_KEY_ID     = defineSecret('RAZORPAY_KEY_ID')
const RAZORPAY_KEY_SECRET = defineSecret('RAZORPAY_KEY_SECRET')
const RAZORPAY_WEBHOOK_SECRET = defineSecret('RAZORPAY_WEBHOOK_SECRET')

const CURRENCY = 'INR'

function requireAuth(uid: string | undefined): string {
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.')
  return uid
}

function toPaise(amountRupees: number): number {
  if (!Number.isFinite(amountRupees) || amountRupees <= 0)
    throw new HttpsError('failed-precondition', 'Invalid order amount.')
  return Math.round(amountRupees * 100)
}

function rzpClient(keyId: string, keySecret: string) {
  return new Razorpay({ key_id: keyId, key_secret: keySecret })
}

function computePayablePaise(order: admin.firestore.DocumentData): number {
  const total = Number(order.total ?? 0)
  if (total <= 0) throw new HttpsError('failed-precondition', 'Order has no payable total.')

  // Cross-check using the stored subtotal + fee breakdown so the formula
  // matches the Flutter cart exactly (subtotal already has discounts baked in).
  const subtotal    = Number(order.subtotal    ?? 0)
  const tax         = Number(order.tax         ?? 0)
  const deliveryFee = Number(order.deliveryFee ?? 0)
  const platformFee = Number(order.platformFee ?? 0)
  const discount    = Number(order.discount    ?? 0)
  const tip         = Number(order.tip         ?? 0)

  const recomputed = subtotal + tax + deliveryFee + platformFee - discount + tip

  // Allow ±2 rupee rounding tolerance.
  if (Math.abs(recomputed - total) > 2) {
    logger.warn('Order amount mismatch', { orderId: order.id, total, recomputed })
    throw new HttpsError('failed-precondition', 'Order amount failed server validation.')
  }
  return toPaise(total)
}

function hmacSha256Hex(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'utf8')
    const bb = Buffer.from(b, 'utf8')
    if (ba.length !== bb.length) return false
    return crypto.timingSafeEqual(ba, bb)
  } catch { return false }
}

async function markProcessedIdempotent(
  paymentId: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  const ref = db.collection('paymentEvents').doc(paymentId)
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (snap.exists && snap.data()?.processed === true) throw new Error('ALREADY_PROCESSED')
      tx.set(ref, { ...payload, processed: true, processedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
    })
    return true
  } catch (e) {
    if (e instanceof Error && e.message === 'ALREADY_PROCESSED') return false
    throw e
  }
}

async function applyPaidUpdate(params: {
  firestoreOrderId: string
  razorpayOrderId: string
  razorpayPaymentId: string
  amountPaise: number
  currency: string
  source: 'verify' | 'webhook'
}): Promise<void> {
  const ref = db.collection('orders').doc(params.firestoreOrderId)
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) throw new HttpsError('not-found', 'Order not found.')
    const data = snap.data()!
    if (data.paymentVerified === true && data.paymentStatus === 'paid') return
    if (data.razorpayOrderId && data.razorpayOrderId !== params.razorpayOrderId)
      throw new HttpsError('failed-precondition', 'Razorpay order ID mismatch.')
    const expected = computePayablePaise(data)
    if (params.amountPaise !== expected)
      throw new HttpsError('failed-precondition', 'Payment amount mismatch.')
    if (params.currency.toUpperCase() !== CURRENCY)
      throw new HttpsError('failed-precondition', 'Currency mismatch.')
    tx.update(ref, {
      paymentStatus: 'paid',
      paymentVerified: true,
      razorpayOrderId: params.razorpayOrderId,
      razorpayPaymentId: params.razorpayPaymentId,
      paidAmount: params.amountPaise / 100,
      paidAmountPaise: params.amountPaise,
      currency: CURRENCY,
      paymentVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      paymentSource: params.source,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  })
}

/**
 * createRazorpayOrder — reads order total from Firestore, creates a Razorpay order.
 */
export const createRazorpayOrder = onCallV2(
  { region: 'asia-south1', secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET] },
  async (request) => {
    const uid = requireAuth(request.auth?.uid)
    const orderId = String(request.data?.orderId ?? '').trim()
    if (!orderId) throw new HttpsError('invalid-argument', 'orderId is required.')

    const snap = await db.collection('orders').doc(orderId).get()
    if (!snap.exists) throw new HttpsError('not-found', 'Order not found.')
    const order = snap.data()!

    if (order.customerId && order.customerId !== uid)
      throw new HttpsError('permission-denied', 'You do not own this order.')
    if (order.paymentVerified === true && order.paymentStatus === 'paid')
      throw new HttpsError('failed-precondition', 'Order is already paid.')

    const amountPaise = computePayablePaise(order)
    const keyId     = RAZORPAY_KEY_ID.value()
    const keySecret = RAZORPAY_KEY_SECRET.value()
    const rzp = rzpClient(keyId, keySecret)

    // Reuse existing Razorpay order if still valid.
    if (order.razorpayOrderId && order.paymentStatus !== 'paid') {
      try {
        const existing = await rzp.orders.fetch(order.razorpayOrderId)
        if (Number(existing.amount) === amountPaise && existing.status !== 'paid') {
          await db.collection('orders').doc(orderId).set(
            { paymentStatus: 'awaiting_payment', updatedAt: admin.firestore.FieldValue.serverTimestamp() },
            { merge: true }
          )
          return { keyId, razorpayOrderId: order.razorpayOrderId, amount: amountPaise, currency: CURRENCY, orderId }
        }
      } catch { /* create new below */ }
    }

    let rzOrder: { id: string }
    try {
      rzOrder = await rzp.orders.create({
        amount: amountPaise,
        currency: CURRENCY,
        receipt: orderId.slice(0, 40),
        notes: { firestoreOrderId: orderId, customerId: uid },
      })
    } catch {
      throw new HttpsError('unavailable', 'Unable to create payment order. Try again.')
    }

    await db.collection('orders').doc(orderId).set(
      { razorpayOrderId: rzOrder.id, paymentStatus: 'awaiting_payment', paymentVerified: false,
        currency: CURRENCY, payableAmountPaise: amountPaise, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    )

    return { keyId, razorpayOrderId: rzOrder.id, amount: amountPaise, currency: CURRENCY, orderId }
  }
)

/**
 * verifyRazorpayPayment — verifies HMAC signature and marks the order paid.
 */
export const verifyRazorpayPayment = onCallV2(
  { region: 'asia-south1', secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET] },
  async (request) => {
    const uid              = requireAuth(request.auth?.uid)
    const firestoreOrderId = String(request.data?.orderId ?? '').trim()
    const razorpayOrderId  = String(request.data?.razorpay_order_id ?? '').trim()
    const razorpayPaymentId= String(request.data?.razorpay_payment_id ?? '').trim()
    const razorpaySignature= String(request.data?.razorpay_signature ?? '').trim()

    if (!firestoreOrderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature)
      throw new HttpsError('invalid-argument', 'Missing payment fields.')

    const snap = await db.collection('orders').doc(firestoreOrderId).get()
    if (!snap.exists) throw new HttpsError('not-found', 'Order not found.')
    const order = snap.data()!

    if (order.customerId && order.customerId !== uid)
      throw new HttpsError('permission-denied', 'You do not own this order.')
    if (order.paymentVerified === true && order.paymentStatus === 'paid' && order.razorpayPaymentId === razorpayPaymentId)
      return { success: true, verified: true, alreadyProcessed: true }

    const keySecret = RAZORPAY_KEY_SECRET.value()
    const expected  = hmacSha256Hex(`${razorpayOrderId}|${razorpayPaymentId}`, keySecret)
    if (!timingSafeEqualHex(expected, razorpaySignature)) {
      logger.warn('Invalid Razorpay signature', { firestoreOrderId })
      return { success: false, verified: false, reason: 'invalid_signature' }
    }

    await markProcessedIdempotent(razorpayPaymentId, { firestoreOrderId, razorpayOrderId, source: 'verify', uid })

    const rzp = rzpClient(RAZORPAY_KEY_ID.value(), keySecret)
    let payment: { id: string; order_id: string; amount: number; currency: string; status: string }
    try { payment = await rzp.payments.fetch(razorpayPaymentId) as typeof payment }
    catch { throw new HttpsError('unavailable', 'Unable to verify payment with gateway.') }

    if (!['authorized', 'captured'].includes(payment.status))
      return { success: false, verified: false, reason: 'payment_not_captured' }

    try {
      await applyPaidUpdate({
        firestoreOrderId, razorpayOrderId, razorpayPaymentId,
        amountPaise: Number(payment.amount), currency: String(payment.currency).toUpperCase(),
        source: 'verify',
      })
    } catch (err) {
      const msg = err instanceof HttpsError ? err.message : 'verification_failed'
      return { success: false, verified: false, reason: msg }
    }

    return { success: true, verified: true }
  }
)

function cashLimitRupees(partner: admin.firestore.DocumentData, settings: admin.firestore.DocumentData | undefined): number {
  const personal = Number(partner.cashLimit ?? 0)
  if (personal > 0) return Math.round(personal)
  const configured = Number(settings?.deliveryPartner?.cashLimitDefault ?? 0)
  return configured > 0 ? Math.round(configured) : 0
}

function excessCashRupees(partner: admin.firestore.DocumentData, settings: admin.firestore.DocumentData | undefined): number {
  const held = Math.round(Number(partner.cashInHand ?? 0))
  const limit = cashLimitRupees(partner, settings)
  if (limit <= 0) return 0
  return Math.max(0, held - limit)
}

async function applyCashDeposit(params: {
  depositId: string
  razorpayOrderId: string
  razorpayPaymentId: string
  amountPaise: number
}): Promise<void> {
  const depositRef = db.collection('cashDeposits').doc(params.depositId)
  await db.runTransaction(async (tx) => {
    const depositSnap = await tx.get(depositRef)
    if (!depositSnap.exists) throw new HttpsError('not-found', 'Cash deposit not found.')
    const deposit = depositSnap.data()!
    if (deposit.status === 'PAID' && deposit.razorpayPaymentId === params.razorpayPaymentId) return
    if (deposit.razorpayOrderId && deposit.razorpayOrderId !== params.razorpayOrderId)
      throw new HttpsError('failed-precondition', 'Razorpay order ID mismatch.')
    const expectedPaise = Number(deposit.amountPaise ?? 0)
    if (params.amountPaise !== expectedPaise)
      throw new HttpsError('failed-precondition', 'Payment amount mismatch.')

    const partnerId = String(deposit.partnerId || '')
    const partnerRef = db.collection('deliveryPartners').doc(partnerId)
    const partnerSnap = await tx.get(partnerRef)
    if (!partnerSnap.exists) throw new HttpsError('not-found', 'Delivery partner not found.')
    const held = Math.round(Number(partnerSnap.data()?.cashInHand ?? 0))
    const paidRupees = Math.round(expectedPaise / 100)
    const nextHeld = Math.max(0, held - paidRupees)

    tx.update(depositRef, {
      status: 'PAID',
      razorpayPaymentId: params.razorpayPaymentId,
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    tx.update(partnerRef, {
      cashInHand: nextHeld,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    const txRef = db.collection('transactions').doc(`cashdep_${params.razorpayPaymentId}`)
    tx.set(txRef, {
      id: txRef.id,
      partnerId,
      type: 'cash_deposit',
      title: 'Cash limit settlement',
      amount: -paidRupees,
      method: 'razorpay',
      status: 'completed',
      utr: params.razorpayPaymentId,
      remarks: 'Excess cash paid to TastyKart',
      balanceBefore: held,
      balanceAfter: nextHeld,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  })
}

/**
 * createCashDepositOrder — partner pays cash held above the admin cash limit
 * into the same production Razorpay account used for customer orders.
 */
export const createCashDepositOrder = onCallV2(
  { region: 'asia-south1', secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET] },
  async (request) => {
    const uid = requireAuth(request.auth?.uid)
    const partnerId = String(request.data?.partnerId ?? uid).trim()
    const partnerSnap = await db.collection('deliveryPartners').doc(partnerId).get()
    if (!partnerSnap.exists) throw new HttpsError('not-found', 'Delivery partner not found.')
    const partner = partnerSnap.data()!
    const owner = String(partner.uid || partnerId)
    if (uid !== partnerId && uid !== owner)
      throw new HttpsError('permission-denied', 'You can only settle your own cash.')
    const settingsSnap = await db.collection('settings').doc('admin').get()
    const excess = excessCashRupees(partner, settingsSnap.data())
    if (excess <= 0) throw new HttpsError('failed-precondition', 'Cash in hand is within the limit.')

    const amountPaise = excess * 100
    const keyId = RAZORPAY_KEY_ID.value()
    const keySecret = RAZORPAY_KEY_SECRET.value()
    const rzp = rzpClient(keyId, keySecret)
    const depositId = `cd_${partnerId}_${Date.now()}`

    let rzOrder: { id: string }
    try {
      rzOrder = await rzp.orders.create({
        amount: amountPaise,
        currency: CURRENCY,
        receipt: depositId.slice(0, 40),
        notes: { type: 'cash_deposit', depositId, partnerId },
      })
    } catch {
      throw new HttpsError('unavailable', 'Unable to create payment order. Try again.')
    }

    const held = Math.round(Number(partner.cashInHand ?? 0))
    const limit = cashLimitRupees(partner, settingsSnap.data())
    await db.collection('cashDeposits').doc(depositId).set({
      id: depositId,
      partnerId,
      amount: excess,
      amountPaise,
      cashInHandBefore: held,
      cashLimit: limit,
      status: 'PENDING',
      razorpayOrderId: rzOrder.id,
      currency: CURRENCY,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    return { keyId, razorpayOrderId: rzOrder.id, amount: amountPaise, currency: CURRENCY, depositId }
  }
)

/**
 * verifyCashDeposit — checks the Razorpay signature, then reduces cash in hand.
 */
export const verifyCashDeposit = onCallV2(
  { region: 'asia-south1', secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET] },
  async (request) => {
    const uid = requireAuth(request.auth?.uid)
    const depositId = String(request.data?.depositId ?? '').trim()
    const razorpayOrderId = String(request.data?.razorpay_order_id ?? '').trim()
    const razorpayPaymentId = String(request.data?.razorpay_payment_id ?? '').trim()
    const razorpaySignature = String(request.data?.razorpay_signature ?? '').trim()

    if (!depositId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature)
      throw new HttpsError('invalid-argument', 'Missing payment fields.')

    const depositSnap = await db.collection('cashDeposits').doc(depositId).get()
    if (!depositSnap.exists) throw new HttpsError('not-found', 'Cash deposit not found.')
    const deposit = depositSnap.data()!
    const depositPartnerId = String(deposit.partnerId || '')
    if (depositPartnerId !== uid) {
      const ownerSnap = await db.collection('deliveryPartners').doc(depositPartnerId).get()
      const owner = String(ownerSnap.data()?.uid || '')
      if (owner !== uid) throw new HttpsError('permission-denied', 'You do not own this deposit.')
    }
    if (deposit.status === 'PAID' && deposit.razorpayPaymentId === razorpayPaymentId)
      return { success: true, verified: true, alreadyProcessed: true }

    const keySecret = RAZORPAY_KEY_SECRET.value()
    const expected = hmacSha256Hex(`${razorpayOrderId}|${razorpayPaymentId}`, keySecret)
    if (!timingSafeEqualHex(expected, razorpaySignature))
      return { success: false, verified: false, reason: 'invalid_signature' }

    const fresh = await markProcessedIdempotent(razorpayPaymentId, { depositId, razorpayOrderId, source: 'verify', uid })
    if (!fresh && deposit.status === 'PAID')
      return { success: true, verified: true, alreadyProcessed: true }

    const rzp = rzpClient(RAZORPAY_KEY_ID.value(), keySecret)
    let payment: { id: string; order_id: string; amount: number; currency: string; status: string }
    try { payment = await rzp.payments.fetch(razorpayPaymentId) as typeof payment }
    catch { throw new HttpsError('unavailable', 'Unable to verify payment with gateway.') }

    if (!['authorized', 'captured'].includes(payment.status))
      return { success: false, verified: false, reason: 'payment_not_captured' }
    if (String(payment.order_id) !== razorpayOrderId)
      return { success: false, verified: false, reason: 'order_mismatch' }

    try {
      await applyCashDeposit({
        depositId,
        razorpayOrderId,
        razorpayPaymentId,
        amountPaise: Number(payment.amount),
      })
    } catch (err) {
      const msg = err instanceof HttpsError ? err.message : 'verification_failed'
      return { success: false, verified: false, reason: msg }
    }

    return { success: true, verified: true }
  }
)

/**
 * razorpayWebhook — recovers payments if the app is killed after Checkout.
 * Configure URL in Razorpay dashboard: https://<region>-<project>.cloudfunctions.net/razorpayWebhook
 */
export const razorpayWebhook = onRequest(
  { region: 'asia-south1', secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET] },
  async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return }

    const signature    = String(req.get('x-razorpay-signature') || '')
    const webhookSecret= RAZORPAY_WEBHOOK_SECRET.value()
    const rawBody      = typeof req.rawBody !== 'undefined' ? req.rawBody.toString('utf8') : JSON.stringify(req.body)

    if (!timingSafeEqualHex(hmacSha256Hex(rawBody, webhookSecret), signature)) {
      res.status(400).send('Invalid signature'); return
    }

    const event   = req.body?.event as string | undefined
    const payload = req.body?.payload
    const eventId = (req.body?.id as string) || `${event}_${Date.now()}`

    const eventRef  = db.collection('webhookEvents').doc(eventId)
    const eventSnap = await eventRef.get()
    if (eventSnap.exists && eventSnap.data()?.processed === true) {
      res.status(200).json({ ok: true, duplicate: true }); return
    }

    try {
      if (event === 'payment.authorized' || event === 'payment.captured') {
        const pmt = payload?.payment?.entity
        if (pmt?.id) {
          const rzpPaymentId = String(pmt.id)
          const rzpOrderId   = String(pmt.order_id || '')
          const notes        = pmt.notes || {}
          const noteType     = String(notes.type || '')
          const depositId    = String(notes.depositId || '')
          if (noteType === 'cash_deposit' && depositId) {
            const should = await markProcessedIdempotent(rzpPaymentId, { depositId, rzpOrderId, source: 'webhook', event })
            if (should) {
              await applyCashDeposit({
                depositId,
                razorpayOrderId: rzpOrderId,
                razorpayPaymentId: rzpPaymentId,
                amountPaise: Number(pmt.amount),
              })
            }
          } else {
            let fsOrderId      = String(notes.firestoreOrderId || '')
            if (!fsOrderId && rzpOrderId) {
              const q = await db.collection('orders').where('razorpayOrderId', '==', rzpOrderId).limit(1).get()
              if (!q.empty) fsOrderId = q.docs[0].id
            }
            if (fsOrderId) {
              const should = await markProcessedIdempotent(rzpPaymentId, { fsOrderId, rzpOrderId, source: 'webhook', event })
              if (should) {
                await applyPaidUpdate({ firestoreOrderId: fsOrderId, razorpayOrderId: rzpOrderId,
                  razorpayPaymentId: rzpPaymentId, amountPaise: Number(pmt.amount),
                  currency: String(pmt.currency || CURRENCY).toUpperCase(), source: 'webhook' })
              }
            }
          }
        }
      }
      await eventRef.set({ event, processed: true, processedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
      res.status(200).json({ ok: true })
    } catch (err) {
      logger.error('Webhook error', { event, message: err instanceof Error ? err.message : 'unknown' })
      res.status(500).json({ ok: false })
    }
  }
)

// ============================================================================
// CALLABLE FUNCTION: Send Push Notifications via FCM
// ============================================================================

/**
 * Sends FCM push notifications to one or many device tokens.
 *
 * Payload expected from admin panel:
 *   {
 *     tokens: string[]          — one or more FCM registration tokens
 *     title:  string            — notification title
 *     body:   string            — notification body
 *     data?:  Record<string, string>  — optional custom data payload
 *   }
 *
 * The function uses `admin.messaging().sendEachForMulticast` so each token
 * gets its own message and stale/invalid tokens are handled gracefully
 * (they are removed from Firestore automatically).
 */
export const sendPushNotification = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be signed in as admin to send notifications.'
      )
    }

    const tokens: string[] = (data.tokens ?? []).filter(
      (t: unknown) => typeof t === 'string' && t.trim().length > 0
    )
    const title: string = String(data.title ?? '').trim()
    const body: string  = String(data.body  ?? '').trim()
    const extraData: Record<string, string> = data.data ?? {}

    if (tokens.length === 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'At least one FCM token is required.'
      )
    }
    if (!title || !body) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'title and body are required.'
      )
    }

    const messaging = admin.messaging()

    // Send in batches of 500 (FCM multicast limit).
    const BATCH = 500
    let successCount = 0
    let failureCount = 0
    const invalidTokens: string[] = []

    for (let i = 0; i < tokens.length; i += BATCH) {
      const batch = tokens.slice(i, i + BATCH)
      const message: admin.messaging.MulticastMessage = {
        tokens: batch,
        notification: { title, body },
        data: extraData,
        android: {
          priority: 'high',
          notification: { channelId: 'tasty_kart_general', sound: 'default' },
        },
        apns: {
          payload: { aps: { sound: 'default', badge: 1 } },
        },
      }

      const response = await messaging.sendEachForMulticast(message)
      successCount += response.successCount
      failureCount += response.failureCount

      // Collect tokens that are no longer valid so we can clean them up.
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const code = resp.error?.code ?? ''
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            invalidTokens.push(batch[idx])
          }
        }
      })
    }

    // Remove stale tokens from Firestore (best-effort, non-blocking).
    if (invalidTokens.length > 0) {
      logger.info(`Removing ${invalidTokens.length} stale FCM tokens`)
      const batch = db.batch()
      const staleToken = invalidTokens[0] // use first to find docs
      // Clean from customers
      const customerSnap = await db
        .collection('customers')
        .where('fcmTokens', 'array-contains-any', invalidTokens.slice(0, 10))
        .limit(50)
        .get()
      customerSnap.docs.forEach(d =>
        batch.update(d.ref, {
          fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens),
        })
      )
      // Clean from deliveryPartners
      const partnerSnap = await db
        .collection('deliveryPartners')
        .where('fcmTokens', 'array-contains-any', invalidTokens.slice(0, 10))
        .limit(50)
        .get()
      partnerSnap.docs.forEach(d =>
        batch.update(d.ref, {
          fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens),
        })
      )
      try { await batch.commit() } catch (e) {
        logger.warn('Failed to remove stale tokens', e)
      }
    }

    logger.info('Push notification sent', {
      total: tokens.length,
      successCount,
      failureCount,
      adminUid: context.auth.uid,
    })

    return { success: true, successCount, failureCount }
  }
)


// ============================================================================
// FIRESTORE TRIGGER: Order Needs Reassignment → Find Nearest Partner & FCM
// ============================================================================

/**
 * Fires when an order's `needsReassignment` field is set to `true`.
 *
 * This happens in two cases:
 *   1. A delivery partner rejects the order (OrderService.reject).
 *   2. A delivery partner transfers the order after the restaurant delay
 *      waiting timer expires (OrderService.transferOrder).
 *
 * What this function does:
 *   1. Fetches all online, approved, unblocked delivery partners.
 *   2. Filters out any partner in `excludedPartnerIds` or `deniedPartnerIds`.
 *   3. Finds the geographically nearest remaining partner (Haversine).
 *   4. Assigns the order to that partner.
 *   5. Sends FCM push to the NEW partner's devices ("New order assigned").
 *   6. Sends FCM push to the CUSTOMER ("Your order has a new delivery partner").
 *   7. Clears `needsReassignment` to prevent re-triggering.
 */
export const onOrderNeedsReassignment = functions.firestore
  .document('orders/{orderId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data()
    const after  = change.after.data()
    const orderId: string = context.params.orderId

    // Only act when needsReassignment just became true.
    if (!after.needsReassignment || before.needsReassignment === true) {
      return null
    }

    // If a partner is already freshly assigned AND accepted, nothing to do.
    if (after.deliveryPartnerId && after.partnerAccepted === true) {
      return null
    }

    logger.info(`[Reassign] Order ${orderId} needs reassignment`)

    // ── 1. Collect excluded partner IDs ─────────────────────────────────────
    const excluded: string[] = [
      ...(Array.isArray(after.excludedPartnerIds) ? after.excludedPartnerIds : []),
      ...(Array.isArray(after.deniedPartnerIds)   ? after.deniedPartnerIds   : []),
      after.transferredByPartnerId ?? '',
    ].filter(Boolean)

    // ── 2. Fetch online, approved partners ──────────────────────────────────
    const partnersSnap = await db
      .collection('deliveryPartners')
      .where('approved', '==', true)
      .where('blocked',  '==', false)
      .where('available', '==', true)
      .get()

    if (partnersSnap.empty) {
      logger.warn(`[Reassign] No available partners for order ${orderId}`)
      // Clear the flag so admin can retry manually.
      await change.after.ref.update({ needsReassignment: false, updatedAt: Timestamp.now() })
      return null
    }

    // ── 3. Filter out excluded partners ─────────────────────────────────────
    const candidates = partnersSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter((p: any) => !excluded.includes(p.id))

    if (candidates.length === 0) {
      logger.warn(`[Reassign] All available partners excluded for order ${orderId}`)
      await change.after.ref.update({ needsReassignment: false, updatedAt: Timestamp.now() })
      return null
    }

    // ── 4. Find nearest partner (Haversine) ──────────────────────────────────
    const restLat: number = after.restaurantLat ?? 0
    const restLng: number = after.restaurantLng ?? 0

    function haversineKm(
      lat1: number, lng1: number,
      lat2: number, lng2: number
    ): number {
      const R = 6371
      const dLat = ((lat2 - lat1) * Math.PI) / 180
      const dLng = ((lng2 - lng1) * Math.PI) / 180
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }

    let nearest: any = null
    let nearestDist = Infinity

    for (const p of candidates as any[]) {
      const pLat: number = p.currentLat ?? p.lat ?? 0
      const pLng: number = p.currentLng ?? p.lng ?? 0
      if (!pLat || !pLng) continue
      const dist = haversineKm(restLat, restLng, pLat, pLng)
      if (dist < nearestDist) {
        nearestDist = dist
        nearest = p
      }
    }

    // Fall back to first candidate if no one has valid coords.
    if (!nearest) nearest = candidates[0] as any

    const newPartnerId: string   = nearest.id
    const newPartnerName: string = nearest.name ?? nearest.partnerName ?? ''

    logger.info(`[Reassign] Assigning order ${orderId} to partner ${newPartnerId} (${newPartnerName})`)

    // ── 5. Assign order to new partner ───────────────────────────────────────
    await change.after.ref.set({
      deliveryPartnerId:   newPartnerId,
      deliveryPartnerName: newPartnerName,
      deliveryPartnerPhone: nearest.phone ?? '',
      partnerAccepted:     false,
      deliveryStage:       'to_restaurant',
      needsReassignment:   false,
      reassignedAt:        Timestamp.now(),
      updatedAt:           Timestamp.now(),
      timeline: admin.firestore.FieldValue.arrayUnion({
        status: 'reassigned',
        partnerId: newPartnerId,
        partnerName: newPartnerName,
        time: Timestamp.now(),
      }),
    }, { merge: true })

    // ── 6. Send FCM to new partner ───────────────────────────────────────────
    const partnerFcmTokens: string[] = Array.isArray(nearest.fcmTokens)
      ? nearest.fcmTokens.filter(Boolean)
      : []

    if (partnerFcmTokens.length > 0) {
      try {
        await admin.messaging().sendEachForMulticast({
          tokens: partnerFcmTokens,
          notification: {
            title: '🛵 New Order Assigned',
            body:  `Order #${after.orderNumber ?? orderId} is waiting at ${after.restaurantName ?? 'restaurant'}.`,
          },
          data: {
            action:  'view_order',
            orderId: orderId,
          },
          android: {
            priority: 'high',
            notification: { channelId: 'order_alerts', sound: 'default' },
          },
          apns: { payload: { aps: { sound: 'default', badge: 1 } } },
        })
        logger.info(`[Reassign] Pushed to partner ${newPartnerId}`)
      } catch (e) {
        logger.error('[Reassign] Failed to push to partner', e)
      }
    }

    // ── 7. Send FCM to customer ───────────────────────────────────────────────
    const customerId: string = after.customerId ?? ''
    if (customerId) {
      try {
        const customerDoc = await db.collection('customers').doc(customerId).get()
        const customerTokens: string[] = customerDoc.exists
          ? (Array.isArray(customerDoc.data()?.fcmTokens)
              ? customerDoc.data()!.fcmTokens.filter(Boolean)
              : [])
          : []

        if (customerTokens.length > 0) {
          await admin.messaging().sendEachForMulticast({
            tokens: customerTokens,
            notification: {
              title: '🔄 Order Reassigned',
              body:  `Good news! Your order is now assigned to a new delivery partner and is on its way.`,
            },
            data: {
              orderId: orderId,
              action:  'view_order',
            },
            android: {
              priority: 'high',
              notification: { channelId: 'tasty_kart_general', sound: 'default' },
            },
            apns: { payload: { aps: { sound: 'default', badge: 1 } } },
          })
          logger.info(`[Reassign] Pushed reassignment notice to customer ${customerId}`)
        }
      } catch (e) {
        logger.error('[Reassign] Failed to push to customer', e)
      }
    }

    return null
  })
