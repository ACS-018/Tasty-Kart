/**
 * Geolocation utilities for order assignment
 * Calculates distances and finds nearest delivery partners
 */

export interface Location {
  latitude: number
  longitude: number
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(
  from: Location,
  to: Location
): number {
  const R = 6371 // Earth's radius in kilometers
  const dLat = (to.latitude - from.latitude) * (Math.PI / 180)
  const dLon = (to.longitude - from.longitude) * (Math.PI / 180)
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(from.latitude * (Math.PI / 180)) *
      Math.cos(to.latitude * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c
  
  return Math.round(distance * 100) / 100 // Round to 2 decimal places
}

/**
 * Find the nearest available delivery partner to a restaurant
 * Filters by status (online/available) and city
 */
export interface DeliveryPartnerWithDistance {
  id: string
  name: string
  phone: string
  avatar: string
  vehicle: string
  vehicleNumber: string
  rating: number
  completedOrders: number
  status: string
  city: string
  currentLat: number
  currentLng: number
  distance: number
  acceptRate: number
  earnings?: number
}

export function findNearestDeliveryPartner(
  restaurantLocation: Location,
  availablePartners: any[]
): DeliveryPartnerWithDistance | null {
  if (!availablePartners || availablePartners.length === 0) {
    return null
  }

  // Filter partners who are online or available, and have current location
  const validPartners = availablePartners.filter(
    (p) =>
      (p.status === 'online' || p.status === 'available') &&
      p.currentLat &&
      p.currentLng &&
      !p.blockedAt && // Exclude blocked partners
      p.approved // Only approved partners
  )

  if (validPartners.length === 0) {
    return null
  }

  // Calculate distance for each partner
  const partnersWithDistance = validPartners.map((partner) => ({
    ...partner,
    distance: calculateDistance(restaurantLocation, {
      latitude: partner.currentLat,
      longitude: partner.currentLng,
    }),
  }))

  // Sort by distance and rating (prefer closer + higher rating)
  const sorted = partnersWithDistance.sort((a, b) => {
    // Primary sort: distance
    if (a.distance !== b.distance) {
      return a.distance - b.distance
    }
    // Secondary sort: rating (descending)
    return (b.rating || 0) - (a.rating || 0)
  })

  return sorted[0]
}

/**
 * Find top N nearest delivery partners
 * Useful for fallback assignments
 */
export function findNearestDeliveryPartners(
  restaurantLocation: Location,
  availablePartners: any[],
  topN: number = 5
): DeliveryPartnerWithDistance[] {
  if (!availablePartners || availablePartners.length === 0) {
    return []
  }

  const validPartners = availablePartners.filter(
    (p) =>
      (p.status === 'online' || p.status === 'available') &&
      p.currentLat &&
      p.currentLng &&
      !p.blockedAt &&
      p.approved
  )

  const partnersWithDistance = validPartners.map((partner) => ({
    ...partner,
    distance: calculateDistance(restaurantLocation, {
      latitude: partner.currentLat,
      longitude: partner.currentLng,
    }),
  }))

  const sorted = partnersWithDistance.sort((a, b) => {
    if (a.distance !== b.distance) {
      return a.distance - b.distance
    }
    return (b.rating || 0) - (a.rating || 0)
  })

  return sorted.slice(0, topN)
}

/**
 * Calculate estimated delivery time based on distance
 * Assumes average speed of 20 km/h in city traffic
 */
export function estimateDeliveryTime(distanceKm: number): string {
  const averageSpeedKmh = 20
  const estimatedMinutes = Math.ceil((distanceKm / averageSpeedKmh) * 60)
  
  if (estimatedMinutes < 1) {
    return 'Just now'
  }
  if (estimatedMinutes < 60) {
    return `~${estimatedMinutes} min`
  }
  
  const hours = Math.floor(estimatedMinutes / 60)
  const mins = estimatedMinutes % 60
  return `~${hours}h ${mins}m`
}
