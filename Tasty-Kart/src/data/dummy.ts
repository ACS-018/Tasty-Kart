// ─── Types Only — all actual data lives in Firebase ──────────────────────────
// Pages subscribe to Firestore collections in real-time.
// Use the "Seed Firebase" button on the Dashboard to push initial data.

export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'picked' | 'delivered' | 'cancelled' | 'refunded'
export type PaymentMethod = 'Razorpay' | 'UPI' | 'Cash' | 'Wallet'
export type VehicleType = 'Bike' | 'Scooter' | 'Bicycle' | 'Car'
export type PartnerStatus = 'online' | 'offline' | 'busy' | 'available' | 'blocked'

export interface Restaurant {
  id: string; name: string; logo?: string; cover?: string; cuisine: string
  address: string; city: string; rating: number; totalOrders: number; revenue: number
  status: 'active' | 'inactive'; owner: string; phone: string; email: string
  openingHours: string; deliveryTime: string; minOrder: number; isVeg: boolean
  featured?: boolean
  /** Shown in the user app search screen under Popular restaurants. */
  popular?: boolean
  gst?: string; pan?: string; bankAccount?: string; ifsc?: string; joinedDate?: string
  description?: string
  categories?: string[] // Array of restaurant category IDs

  // Dynamic rating fields — written by user review submissions (Flutter app).
  // `averageRating` is the canonical live value; `rating` is kept in sync with
  // it on every write so older queries continue to work without migration.
  averageRating?: number  // ratingSum / totalReviews, recomputed on each review
  totalReviews?: number   // total number of user-submitted star ratings
  ratingSum?: number      // running sum of all star values (used for recalculation)

  // Google Maps location (MANDATORY for new restaurants)
  location?: {
    latitude: number      // e.g. 17.385044
    longitude: number     // e.g. 78.486671
    address: string       // Full formatted address from Google Maps
    placeId?: string      // Google Places ID (optional)
  }
}

/** Food category belonging to a restaurant (e.g. Starters, Main Course) */
export interface FoodCategory {
  id: string
  restaurantId: string
  restaurantName: string
  name: string
  icon?: string
  description?: string
  image?: string
  sortOrder?: number
  itemCount?: number
  status: 'active' | 'inactive'
}

export type FoodType = 'veg' | 'nonveg'

/** Food item under a restaurant category */
export interface FoodItem {
  id: string
  restaurantId: string
  restaurantName: string
  categoryId: string
  categoryName: string
  name: string
  image?: string
  imageUrl?: string
  price: number
  discountedPrice?: number
  preparationTime?: number
  foodType: FoodType
  isVeg: boolean
  status: 'active' | 'inactive'
  description?: string
  ingredients?: string
  rating?: number
  totalRatings?: number
  available?: boolean
  inStock?: boolean
  tags?: string[]
}

/** Add-on belonging to a restaurant (or optional food item) */
export interface Addon {
  id: string
  restaurantId: string
  restaurantName: string
  foodItemId?: string | null
  name: string
  price: number
  category?: string
  status: 'active' | 'inactive'
  description?: string
}

export type BannerTapAction = 'none' | 'restaurant' | 'web_url'

/** Promotional banner with optional tap navigation (restaurant or external URL). */
export interface Banner {
  id: string
  title: string
  imageUrl: string
  image?: string
  status: 'active' | 'inactive'
  type?: string
  order?: number
  sortOrder?: number
  /** @deprecated Use tapAction + webUrl/restaurantId. Kept for older app builds. */
  link?: string
  /** What happens when user taps the banner in the customer app */
  tapAction?: BannerTapAction
  restaurantId?: string | null
  restaurantName?: string | null
  webUrl?: string | null
}

export interface Customer {
  id: string
  name: string
  email: string
  phone: string
  avatar?: string
  city?: string
  joinedDate?: string
  totalOrders?: number
  totalSpend?: number
  walletBalance?: number
  status: 'active' | 'blocked'
  favorites?: string[]
  addresses?: number
  /** Firebase Auth uid when the customer is a real app user */
  uid?: string
  blockedAt?: string | null
  blockedReason?: string | null
  unblockedAt?: string | null
}
export interface DeliveryPartner {
  // Identity
  id: string
  uid?: string
  name: string
  phone: string
  email: string
  avatar: string
  
  // Location & Assignment
  city: string
  currentLat?: number
  currentLng?: number
  lastLocationUpdate?: string | null
  
  // Status & Availability
  status: PartnerStatus
  approved: boolean
  activationAcknowledged?: boolean
  blockedAt?: string | null
  blockedReason?: string | null
  
  // Vehicle Information
  vehicle: VehicleType
  vehicleNumber: string
  
  // Documents (KYC)
  documents?: {
    aadhar?: string
    pan?: string
    drivingLicense?: string
    vehicleRC?: string
    profilePhoto?: string
  }
  documentsComplete?: boolean
  
  // Bank Details
  accountHolderName?: string
  bankAccount?: string
  ifsc?: string
  ifscVerified?: boolean
  upiId?: string
  
  // Training & Onboarding
  trainingCompleted?: string[]
  trainingComplete?: boolean
  termsAccepted?: boolean
  legalAccepted?: string[]
  
  // Performance Metrics
  rating: number
  completedOrders: number
  cancelledOrders?: number
  acceptRate: number
  rejectRate?: number
  earnings: number
  pocketBalance?: number
  cashLimit?: number
  tipBalance?: number
  
  // Current Assignment
  currentOrder?: string | null
  
  // Slot Booking
  bookedSlots?: Array<{
    slotId: string
    date: string
  }>
  
  // NEW: For Production System (Phase 3-5)
  cityId?: string              // Primary delivery city
  zoneIds?: string[]           // Zones partner can deliver in
  partnerLevelId?: string      // Reference to partnerLevels/{levelId}
  levelUpdatedAt?: string      // Last level change timestamp
  currentWalletBalance?: number // Derived from walletTransactions
  totalEarnings?: number       // All-time lifetime earnings
  monthlyEarnings?: number     // Current month earnings
  weeklyEarnings?: number      // Current week earnings
  todayEarnings?: number       // Today's earnings
  hasActiveSlotBooking?: boolean
  currentSlotId?: string       // Current active slot ID
  slotBookingEndTime?: string  // When slot booking ends
  
  // Preferences
  notificationsEnabled?: boolean
  fcmTokens?: string[]
  
  // Metadata
  gender?: string
  dateOfBirth?: string
  joinedDate: string
  createdAt?: string
  updatedAt?: string
}

/** Daily delivery incentive structure for motivating delivery partners */
export interface DeliveryIncentive {
  // Identity
  id: string
  partnerId: string
  partnerName: string
  partnerPhone?: string
  
  // Incentive Date
  date: string // YYYY-MM-DD format
  weekOf?: string // Monday of the incentive week, YYYY-MM-DD
  
  // Trip Requirements & Bonuses
  tripThresholds: Array<{
    minTrips: number        // Minimum trips to qualify
    maxTrips?: number       // Optional max trips for this tier
    bonusAmount: number     // Bonus in rupees for this tier
    description: string     // e.g., "₹500 for 5-10 trips"
  }>
  
  // Performance Tracking
  completedTrips: number
  cancelledTrips?: number
  totalDistance?: number
  averageRating?: number
  
  // Earnings Breakdown
  baseEarnings: number      // Earnings from deliveries
  incentiveBonus: number    // Bonus earned if threshold met
  totalEarnings: number     // baseEarnings + incentiveBonus
  
  // Status & Management
  status: 'active' | 'completed' | 'cancelled'
  approvedBy?: string       // Admin name
  approvedAt?: string       // Timestamp
  
  // Notes & Metadata
  notes?: string
  city: string
  createdAt: string
  updatedAt?: string
}
export interface OrderItem { name: string; qty: number; price: number }

export type DeliveryStage = 'to_restaurant' | 'at_restaurant' | 'to_customer' | 'at_customer'

export interface Order {
  // Order Identification
  id: string
  orderNumber: string
  status: OrderStatus
  
  // Customer Information
  customerId: string
  customerName: string
  customerPhone: string
  
  // Restaurant Information
  restaurantId: string
  restaurantName: string
  restaurantAddress?: string
  restaurantPhone?: string
  restaurantLat?: number
  restaurantLng?: number
  
  // Delivery Partner Assignment
  deliveryPartnerId?: string | null
  deliveryPartnerName?: string | null
  partnerAccepted?: boolean
  deliveryStage?: DeliveryStage
  pickupCode?: string
  deniedPartnerId?: string
  deniedPartnerIds?: string[]  // List of partners who denied/cancelled
  
  // Assignment Details
  estimatedDistance?: number    // Distance in km
  estimatedDeliveryTime?: string // E.g., "~15 min"
  assignedAt?: string           // Timestamp when assigned
  
  // Cancellation & Reassignment History
  cancellationHistory?: Array<{
    partnerId: string
    partnerName: string
    timestamp: string
    reason: string
  }>
  
  // NEW: For Production System (Phase 3-5)
  cityId?: string              // City where order is being delivered
  zoneId?: string              // Zone where order is being delivered
  earningId?: string           // Reference to earnings/{earningId}
  slotId?: string              // If delivered by slot-booked partner
  slotBookingId?: string       // Reference to slot booking
  
  // Delivery Address
  address: string
  addressLabel?: string
  addressLandmark?: string
  addressCity?: string
  destLat?: number
  destLng?: number
  
  // Distance & Route
  pickupKm?: number
  dropKm?: number
  
  // Payment & Pricing
  paymentMethod: PaymentMethod
  collectedVia?: string
  subtotal: number
  tax: number
  deliveryFee: number
  platformFee: number
  discount: number
  couponCode?: string
  tip?: number
  surgeFee?: number
  walletUsed?: number
  total: number
  
  // Order Items
  items: OrderItem[]
  
  // Multi-pickup Flag
  multiPickup?: boolean
  
  // Cancellation
  cancelReason?: string
  cancelPhase?: string
  cancelledBy?: string          // 'user' | 'admin' | partnerId
  cancellationSource?: 'user' | 'admin' | 'partner' // who initiated the cancel
  userCancelledAt?: string      // ISO timestamp when user cancelled

  // Refund eligibility (set by cancelOrderByUser)
  refundEligible?: boolean      // true when paymentMethod is NOT Cash/COD
  refundStatus?: 'pending' | 'processed' | 'not_applicable'
  refundAmount?: number         // set when admin processes the refund
  refundedAt?: any              // server timestamp
  
  // Timestamps
  createdAt: string
  acceptedAt?: string
  readyAt?: string
  pickedAt?: string
  deliveredAt?: string
  updatedAt?: string
  
  // Timeline
  timeline: Array<{ status: string; time: string }>
  
  // Additional Charges
  gstAmount?: number
  packagingCharges?: number
}

export type TransactionType = 
  | 'order_earning' 
  | 'payout' 
  | 'withdrawal' 
  | 'deduction' 
  | 'late_delivery' 
  | 'tip' 
  | 'tip_deduction'

export type TransactionStatus = 'pending' | 'completed' | 'failed'

export interface Transaction {
  id: string
  partnerId?: string
  customerName?: string
  type: TransactionType
  title: string
  orderNumber?: string
  orderId?: string
  amount: number
  method: string
  status: TransactionStatus
  utr?: string
  balanceBefore?: number
  balanceAfter?: number
  createdAt: string
  processedAt?: string
  remarks?: string
  refunded?: boolean
}

export type NotificationType = 
  | 'order_assigned' 
  | 'order_cancelled' 
  | 'payment_received' 
  | 'account_update' 
  | 'announcement'

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Notification {
  id: string
  userId: string
  userType?: string
  type: NotificationType
  title: string
  message: string
  data?: Record<string, any>
  read: boolean
  priority?: NotificationPriority
  createdAt: string
  expiresAt?: string
}

// ─── Chart / Analytics data (static, used only for charts) ───────────────────
export const revenueChartData = [
  { month: 'Jan', revenue: 240000, orders: 820 },
  { month: 'Feb', revenue: 290000, orders: 940 },
  { month: 'Mar', revenue: 350000, orders: 1100 },
  { month: 'Apr', revenue: 380000, orders: 1250 },
  { month: 'May', revenue: 410000, orders: 1380 },
  { month: 'Jun', revenue: 485000, orders: 1520 },
  { month: 'Jul', revenue: 520000, orders: 1680 },
  { month: 'Aug', revenue: 560000, orders: 1820 },
]
export const weeklyOrderData = [
  { day: 'Mon', orders: 140, delivered: 135, cancelled: 5 },
  { day: 'Tue', orders: 165, delivered: 160, cancelled: 5 },
  { day: 'Wed', orders: 180, delivered: 174, cancelled: 6 },
  { day: 'Thu', orders: 195, delivered: 188, cancelled: 7 },
  { day: 'Fri', orders: 240, delivered: 232, cancelled: 8 },
  { day: 'Sat', orders: 310, delivered: 298, cancelled: 12 },
  { day: 'Sun', orders: 350, delivered: 338, cancelled: 12 },
]
export const topRestaurants = [
  { name: 'Spice Garden', orders: 1420, revenue: 485000, rating: 4.8 },
  { name: 'Green Leaf Veg', orders: 1850, revenue: 520000, rating: 4.9 },
  { name: 'Pizza Palazzo', orders: 1150, revenue: 410000, rating: 4.7 },
  { name: 'The Burger Lab', orders: 980, revenue: 320000, rating: 4.6 },
  { name: 'Biryani House', orders: 2100, revenue: 640000, rating: 4.7 },
]
export const topFoods = [
  { name: 'Butter Chicken Special', orders: 340, revenue: 98600, restaurant: 'Spice Garden' },
  { name: 'Crispy Paneer Butter Masala', orders: 410, revenue: 94300, restaurant: 'Green Leaf Veg' },
  { name: 'Chicken Dum Biryani', orders: 520, revenue: 145600, restaurant: 'Biryani House' },
  { name: 'Classic Smash Cheeseburger', orders: 215, revenue: 45150, restaurant: 'The Burger Lab' },
  { name: 'Woodfired Pepperoni Pizza', orders: 180, revenue: 75600, restaurant: 'Pizza Palazzo' },
]
export const customerGrowthData = [
  { month: 'Jan', newCustomers: 320, returning: 1200 },
  { month: 'Feb', newCustomers: 410, returning: 1450 },
  { month: 'Mar', newCustomers: 490, returning: 1780 },
  { month: 'Apr', newCustomers: 580, returning: 2100 },
  { month: 'May', newCustomers: 640, returning: 2450 },
  { month: 'Jun', newCustomers: 720, returning: 2890 },
  { month: 'Jul', newCustomers: 810, returning: 3200 },
  { month: 'Aug', newCustomers: 880, returning: 3600 },
]
export const deliveryPerformance = [
  { name: 'On Time', value: 92, fill: '#22c55e' },
  { name: 'Slightly Late', value: 6, fill: '#f59e0b' },
  { name: 'Very Late', value: 2, fill: '#ef4444' },
]


// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 3-5: NEW PRODUCTION DELIVERY-PARTNER MANAGEMENT SYSTEM
// TypeScript Interfaces for Cities, Zones, Slots, Earnings, Incentives, etc.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Type Definitions ───────────────────────────────────────────────────────

export type CityStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
export type ZoneType = 'NORMAL' | 'HIGH_DEMAND' | 'CRITICAL_DEMAND'
export type AreaDensity = 'LOW' | 'MEDIUM' | 'HIGH'
export type SlotStatus = 'DRAFT' | 'OPEN' | 'FULL' | 'CLOSED' | 'CANCELLED' | 'COMPLETED'
export type SlotType = 'REGULAR' | 'PEAK' | 'HIGH_DEMAND' | 'FESTIVAL' | 'SPECIAL_EVENT' | 'EMERGENCY'
export type SlotBookingStatus = 'BOOKED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'
export type EarningRuleScope = 'GLOBAL' | 'CITY' | 'ZONE' | 'PARTNER_LEVEL' | 'DELIVERY_BOY' | 'SLOT'
export type EarningRuleStatus = 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | 'ARCHIVED'
export type OverridePolicy = 'OVERRIDE_ALL' | 'STACK_WITH_LOWER' | 'STACK_WITH_HIGHER'
export type WalletTransactionType = 'EARNING' | 'INCENTIVE' | 'TIP' | 'PAYOUT' | 'DEDUCTION' | 'ADJUSTMENT' | 'REFUND'
export type TransactionDirection = 'CREDIT' | 'DEBIT'
export type WalletTransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED'
export type PayoutStatus = 'PENDING' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'REJECTED'
export type IncentiveCampaignType = 'DAILY' | 'WEEKLY' | 'TRIP_TARGET' | 'SLOT' | 'PEAK' | 'HIGH_DEMAND' | 'CITY' | 'ZONE' | 'PARTNER_SPECIFIC' | 'PARTNER_LEVEL' | 'SPECIAL'
export type IncentiveCampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ENDED' | 'CANCELLED'
export type IncentiveProgressStatus = 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED' | 'DISQUALIFIED'
export type AdminAuditAction = 'CREATE_CITY' | 'UPDATE_CITY' | 'ACTIVATE_CITY' | 'DEACTIVATE_CITY' | 'ARCHIVE_CITY' | 'CREATE_ZONE' | 'UPDATE_ZONE' | 'ACTIVATE_ZONE' | 'DEACTIVATE_ZONE' | 'CREATE_SLOT' | 'UPDATE_SLOT' | 'CANCEL_SLOT' | 'CLOSE_SLOT' | 'CREATE_EARNING_RULE' | 'UPDATE_EARNING_RULE' | 'ACTIVATE_RULE' | 'DEPRECATED_RULE' | 'CREATE_CAMPAIGN' | 'UPDATE_CAMPAIGN' | 'PAUSE_CAMPAIGN' | 'END_CAMPAIGN' | 'CANCEL_CAMPAIGN' | 'CREATE_WALLET_ADJUSTMENT' | 'CREATE_DEDUCTION' | 'REVERSE_TRANSACTION' | 'APPROVE_PAYOUT' | 'REJECT_PAYOUT' | 'PROCESS_PAYOUT' | 'COMPLETE_PAYOUT' | 'SUSPEND_PARTNER' | 'ACTIVATE_PARTNER' | 'UPDATE_PARTNER_LEVEL' | 'UPDATE_SETTINGS' | 'RECALCULATE_EARNINGS' | 'TRIGGER_HIGH_DEMAND'

// ─── PHASE 3: CITIES ────────────────────────────────────────────────────────

export interface City {
  // Identity & Display
  id: string
  name: string
  displayName: string
  state: string
  country: string
  
  // Geography
  latitude: number
  longitude: number
  deliveryRadiusKm: number
  
  // Timezone & Localization
  timezone: string
  currency: string
  currencySymbol: string
  language: string
  
  // Business Rules
  isActive: boolean
  status: CityStatus
  launchDate?: string
  
  // Operational Config
  operatingHours?: {
    startTime: string  // HH:MM
    endTime: string    // HH:MM
  }
  holidayCalendar?: Array<{
    date: string      // YYYY-MM-DD
    name: string
  }>
  
  // Statistics
  restaurantCount: number
  activePartnerCount: number
  totalOrders: number
  totalEarnings: number
  
  // Support
  supportEmail?: string
  supportPhone?: string
  supportHours?: string
  
  // Audit
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
  notes?: string
}

// ─── PHASE 4: ZONES ─────────────────────────────────────────────────────────

export interface Zone {
  // Identity & Hierarchy
  id: string
  cityId: string
  name: string
  displayName: string
  code: string
  
  // Geography
  latitude: number
  longitude: number
  radiusKm: number
  polygon?: string  // GeoJSON
  
  // Zone Type
  type: ZoneType
  isResidential: boolean
  areaDensity: AreaDensity
  
  // Business Rules
  isActive: boolean
  status: CityStatus
  
  // Delivery Config
  minDeliveryFee: number
  distanceFeePerKm: number
  maxDeliveryDistance: number
  avgDeliveryTime: number
  
  // Zone Bonus
  baseBonus: number
  peakHourBonus?: number
  highDemandBonus?: number
  
  // High Demand
  highDemandThreshold: number
  currentlyHighDemand: boolean
  highDemandEndTime?: string
  
  // Active Partners
  activePartnerCount: number
  minRequiredPartners: number
  
  // Performance
  avgDeliveryRating: number
  totalDeliveries: number
  totalEarnings: number
  
  // Audit
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
}

// ─── PHASE 7: SLOTS ─────────────────────────────────────────────────────────

export interface Slot {
  // Identity & Hierarchy
  id: string
  cityId: string
  zoneId: string
  name: string
  description?: string
  
  // Schedule
  date: string  // YYYY-MM-DD
  startTime: string  // HH:MM
  endTime: string    // HH:MM
  durationHours: number
  
  // Booking Window
  bookingOpenAt: string
  bookingCloseAt: string
  
  // Capacity
  maxPartners: number
  minPartners: number
  currentBookings: number
  availableSpots: number
  
  // Slot Type
  slotType: SlotType
  
  // Earnings & Incentives
  baseBonus: number
  perTripBonus?: number
  targetTrips?: number
  targetBonus?: number
  peakBonus?: number
  highDemandBonus?: number
  
  // Status
  status: SlotStatus
  isActive: boolean
  
  // Performance
  expectedTrips: number
  totalTrips: number
  avgDeliveryTime: number
  avgRating: number
  
  // Audit
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
}

// ─── PHASE 8: SLOT BOOKINGS ─────────────────────────────────────────────────

export interface SlotBooking {
  // Identity & Hierarchy
  id: string
  slotId: string
  deliveryBoyId: string
  cityId: string
  zoneId: string
  
  // Booking Details
  bookingDate: string  // YYYY-MM-DD
  bookedAt: string
  
  // Status Lifecycle
  status: SlotBookingStatus
  
  // Cancellation
  cancelledAt?: string
  cancellationReason?: string
  cancelledBy?: string
  
  // Attendance
  actualStartTime?: string
  actualEndTime?: string
  onlineDuration?: number  // Minutes
  
  // Performance
  completedTrips?: number
  cancelledTrips?: number
  noShowTrips?: number
  avgDeliveryTime?: number
  avgRating?: number
  
  // Earnings
  baseEarning?: number
  tripEarning?: number
  bonusEarning?: number
  totalEarning?: number
  
  // Audit
  createdAt: string
  updatedAt: string
}

// ─── PHASE 11-15: EARNING RULES ─────────────────────────────────────────────

export interface DistanceSlab {
  minKm: number
  maxKm?: number  // null = unlimited
  amountPerKm: number
}

export interface EarningRule {
  // Identity & Scoping
  id: string
  cityId: string
  name: string
  description?: string
  
  // Scope
  scopeType: EarningRuleScope
  scopeId?: string
  
  // Effective Dates
  effectiveFrom: string
  effectiveTo?: string
  version: number
  
  // Base Configuration
  baseFee: number
  
  // Distance-Based
  distanceSlabs: DistanceSlab[]
  
  // Time-Based Multipliers
  peakHourMultiplier?: number
  nightDeliveryMultiplier?: number
  
  // Priority
  priority: number
  overridePolicy: OverridePolicy
  
  // Status
  isActive: boolean
  status: EarningRuleStatus
  
  // Audit
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
  notes?: string
}

// ─── PHASE 21-30: WALLET & PAYOUTS ──────────────────────────────────────────

export interface WalletTransaction {
  // Identity
  id: string
  deliveryBoyId: string
  
  // Classification
  type: WalletTransactionType
  subType?: string
  description: string
  
  // Amount
  amount: number
  direction: TransactionDirection
  
  // References
  orderId?: string
  earningId?: string
  campaignId?: string
  payoutId?: string
  
  // Metadata
  reason?: string
  approvedBy?: string
  
  // Balance
  balanceBefore: number
  balanceAfter: number
  
  // Status
  status: WalletTransactionStatus
  
  // Audit
  createdAt: string
  processedAt?: string
  createdBy: string
  
  // Idempotency
  idempotencyKey?: string
}

export interface PayoutRequest {
  // Identity & Hierarchy
  id: string
  deliveryBoyId: string
  partnerId: string
  
  // Request
  requestedAmount: number
  requestedAt: string
  
  // Status
  status: PayoutStatus
  
  // Approval
  approvedBy?: string
  approvedAt?: string
  approvedAmount?: number
  
  // Rejection
  rejectedBy?: string
  rejectedAt?: string
  rejectionReason?: string
  
  // Payment Info
  bankAccount?: string
  ifsc?: string
  upiId?: string
  
  // Completion
  completedAt?: string
  transactionReference?: string
  processingMethod?: string
  
  // Idempotency
  idempotencyKey: string
  
  // Audit
  notes?: string
  createdAt: string
  updatedAt: string
}

// ─── PHASE 16-20: INCENTIVE CAMPAIGNS ───────────────────────────────────────

export interface IncentiveTier {
  // Identity
  id: string
  campaignId: string
  name?: string
  
  // Thresholds
  targetTrips: number
  minTrips: number
  maxTrips?: number
  
  // Alternative Thresholds
  requiredOnlineMinutes?: number
  minCancellationRate?: number
  minAvgRating?: number
  
  // Reward
  rewardAmount: number
  
  // Status
  isActive: boolean
  
  // Audit
  createdAt: string
  updatedAt: string
}

export interface IncentiveCampaign {
  // Identity & Display
  id: string
  name: string
  description: string
  
  // Type & Scope
  type: IncentiveCampaignType
  
  // Geographic Scope
  cityId?: string
  zoneId?: string
  
  // Partner Scope
  deliveryBoyId?: string
  partnerLevelId?: string
  
  // Time Period
  startAt: string
  endAt: string
  
  // Configuration
  stackable: boolean
  maxRewardPerPartner?: number
  minDeliveriesToQualify?: number
  
  // Status
  status: IncentiveCampaignStatus
  isActive: boolean
  
  // Performance
  totalRewardsPaid: number
  partnersEnrolled: number
  successRate: number
  
  // Audit
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
  notes?: string
}

export interface IncentiveProgress {
  // Identity
  id: string
  campaignId: string
  deliveryBoyId: string
  
  // Progress
  tripCount: number
  completedOrders: number
  onlineMinutes: number
  cancellationCount: number
  cancellationRate: number
  avgRating: number
  
  // Tier Progress
  currentTier?: string
  nextTier?: string
  progressToNextTier: number
  
  // Earning
  earnedAmount: number
  completedTierCount: number
  
  // Status
  status: IncentiveProgressStatus
  
  // Dates
  startedAt: string
  completedAt?: string
  
  // Audit
  lastUpdatedAt: string
  createdAt: string
}

// ─── PARTNER LEVELS ─────────────────────────────────────────────────────────

export interface PartnerLevel {
  // Identity
  id: string
  name: string
  displayName: string
  description?: string
  icon?: string
  color?: string
  
  // Qualification
  minTrips: number
  maxTrips?: number
  minRating: number
  minCompletionRate: number
  
  // Benefits
  earningMultiplier: number
  priorityInAssignment: number
  benefits: string[]
  
  // Status
  isActive: boolean
  
  // Display
  priority: number
  
  // Audit
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
  notes?: string
}

// ─── EARNINGS ───────────────────────────────────────────────────────────────

export interface EarningBreakdown {
  baseAmount: number
  distanceAmount: number
  slotBonus: number
  peakBonus: number
  zoneBonus: number
  targetBonus: number
  specialBonus: number
  tipAmount: number
}

export interface RuleSnapshot {
  earningRuleId: string
  earningRuleVersion: number
  incentiveIds: string[]
  calculationVersion: string
}

export interface Earning {
  // Identity
  id: string
  
  // Order & Partner
  orderId: string
  deliveryBoyId: string
  
  // Geography
  cityId: string
  zoneId: string
  
  // Breakdown
  earning: EarningBreakdown
  deductionAmount: number
  deductionReason?: string
  
  // Totals
  grossAmount: number
  netAmount: number
  currency: string
  
  // Rule Snapshot
  ruleSnapshot: RuleSnapshot
  
  // Status
  status: 'CREDITED' | 'PENDING' | 'FAILED' | 'REVERSED'
  
  // Timestamps
  orderDeliveredAt: string
  createdAt: string
  creditedAt?: string
  reversedAt?: string
  
  // Idempotency
  idempotencyKey: string
}

// ─── ADMIN AUDIT LOGS ────────────────────────────────────────────────────────

export interface AdminAuditLog {
  // Identity
  id: string
  
  // Who & When
  adminId: string
  adminEmail: string
  adminRole: string
  createdAt: string
  
  // Action
  action: AdminAuditAction
  entityType: string
  entityId: string
  
  // Before & After
  before?: Record<string, any>
  after?: Record<string, any>
  
  // Metadata
  reason?: string
  ipAddress?: string
  userAgent?: string
  
  // Impact
  impactedPartners?: string[]
  impactedOrders?: string[]
  impactedAmount?: number
  
  // Immutable
  immutable: boolean
}

// ─── EXTENSIONS TO EXISTING MODELS ──────────────────────────────────────────

// Extended DeliveryPartner fields (additions to existing interface)
export interface DeliveryPartnerExtended extends DeliveryPartner {
  // New for production system
  cityId?: string
  zoneIds?: string[]
  partnerLevelId?: string
  levelUpdatedAt?: string
  
  // Wallet (derived from walletTransactions)
  currentWalletBalance: number
  
  // Statistics (snapshots)
  totalEarnings: number
  monthlyEarnings: number
  weeklyEarnings: number
  todayEarnings: number
  
  // Slot Status
  hasActiveSlotBooking?: boolean
  currentSlotId?: string
  slotBookingEndTime?: string
}

// Extended Order fields (additions to existing interface)
export interface OrderExtended extends Order {
  // New for production system
  cityId?: string
  zoneId?: string
  earningId?: string
  slotId?: string
  slotBookingId?: string
}

// Extended Admin Settings
export interface AdminSettingsExtended {
  // Existing fields...
  
  // New financial config
  finance?: {
    minWithdrawalAmount: number
    maxWithdrawalAmount: number
    dailyWithdrawalLimit: number
    payoutProcessingDays: number
  }
  
  // Slot configuration
  slots?: {
    defaultDurationHours: number
    bookingOpenHours: number
    maxPartnerPerSlot: number
    minPartnerPerSlot: number
    concurrencyControl: string
  }
  
  // Incentive rules
  incentives?: {
    maxStackableRules: number
    rewardValidityDays: number
    duplicateCheckEnabled: boolean
  }
  
  // High demand
  highDemand?: {
    enableAutomaticTrigger: boolean
    orderThresholdPerHour: number
    minimumZonePartners: number
  }
}
