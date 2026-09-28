# TastyKart — Location Tracking Integration Guide

**Complete guide for implementing restaurant location selection in admin and delivery partner real-time tracking.**

---

## 📍 Overview

| Component | Responsibility |
|-----------|----------------|
| **Admin Web (TastyKart)** | Add/edit restaurants with mandatory Google Maps location selection |
| **Customer Mobile App** | Place orders with delivery address, track delivery partner in real-time |
| **Delivery Partner App** | Update location every 60 seconds during active delivery |
| **Cloud Functions** | Auto-assign nearest partner, calculate distances, send notifications |

---

## 1. Restaurant Location (Admin Implementation)

### A. Firestore Restaurant Structure

**Collection:** `restaurants`

```typescript
{
  id: string
  name: string
  cuisine: string
  address: string  // Human-readable address
  city: string
  
  // ✅ NEW LOCATION FIELDS (MANDATORY)
  location: {
    latitude: number      // e.g. 17.385044
    longitude: number     // e.g. 78.486671
    address: string       // Full formatted address from Google Maps
    placeId?: string      // Google Places ID (optional)
  }
  
  owner: string
  phone: string
  email: string
  status: 'active' | 'inactive'
  categories: string[]   // Restaurant category IDs
  // ... other fields
}
```

### B. Admin UI Flow

**Restaurant Form (Add/Edit):**

1. Admin fills basic details (name, cuisine, owner, etc.)
2. Admin clicks **"Select Location on Map"** button
3. Map picker modal opens with:
   - Google Maps centered on Hyderabad (default) or saved location
   - Search bar for Places Autocomplete
   - Draggable red marker pin
   - "My Location" button
   - Current address display
   - Confirm & Cancel buttons
4. Admin searches address or drags pin to exact restaurant location
5. Address auto-fills via reverse geocoding
6. Admin clicks "Confirm Location" → lat/lng saved to form
7. Form submission saves restaurant with `location` object to Firestore

**Validation:** Restaurant cannot be saved without valid lat/lng coordinates.

---

## 2. Delivery Partner Location Tracking

### A. Location Update Flow

```
Delivery Partner Mobile App
   ↓ (Every 60 seconds while online/busy)
   
Update Firestore: deliveryPartners/{partnerId}
   ↓
   
Cloud Function: onPartnerLocationUpdate
   ↓
   
Notify subscribed customers via FCM
   ↓
   
Customer App: OrderTrackingMap updates marker position
```

### B. Firestore DeliveryPartner Structure

**Collection:** `deliveryPartners`

```typescript
{
  id: string  // Delivery partner UID
  name: string
  phone: string
  status: 'online' | 'offline' | 'busy' | 'available' | 'blocked'
  
  // 🔴 REAL-TIME LOCATION FIELDS
  location: {
    latitude: number
    longitude: number
    accuracy: number      // GPS accuracy in meters
    timestamp: Timestamp  // Last update time
    address?: string      // Optional human-readable address
  }
  
  currentOrderId: string | null  // Active order being delivered
  isOnline: boolean
  lastSeen: Timestamp
  // ... other KYC, bank, earnings fields
}
```

### C. Mobile App Location Update (Delivery Partner App)

**File:** `lib/services/location_tracking_service.dart` (Flutter)

```dart
import 'package:geolocator/geolocator.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'dart:async';

class LocationTrackingService {
  static final FirebaseFirestore _db = FirebaseFirestore.instance;
  static Timer? _locationTimer;
  static const int UPDATE_INTERVAL_SECONDS = 60; // 1 minute
  
  /// Start background location tracking (call when partner goes online/accepts order)
  static void startTracking(String partnerId) {
    stopTracking(); // Clear any existing timer
    
    _locationTimer = Timer.periodic(
      Duration(seconds: UPDATE_INTERVAL_SECONDS),
      (_) async {
        try {
          final position = await _getCurrentPosition();
          if (position != null) {
            await _updatePartnerLocation(partnerId, position);
          }
        } catch (e) {
          print('Location update error: $e');
        }
      },
    );
    
    // Send initial location immediately
    _sendInitialLocation(partnerId);
  }
  
  /// Stop tracking (call when partner goes offline/completes delivery)
  static void stopTracking() {
    _locationTimer?.cancel();
    _locationTimer = null;
  }
  
  /// Get current GPS position
  static Future<Position?> _getCurrentPosition() async {
    // Check permission
    final permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      return null;
    }
    
    try {
      return await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 10),
      );
    } catch (e) {
      print('Failed to get position: $e');
      return null;
    }
  }
  
  /// Update Firestore with new location
  static Future<void> _updatePartnerLocation(String partnerId, Position pos) async {
    await _db.collection('deliveryPartners').doc(partnerId).update({
      'location.latitude': pos.latitude,
      'location.longitude': pos.longitude,
      'location.accuracy': pos.accuracy,
      'location.timestamp': FieldValue.serverTimestamp(),
      'lastSeen': FieldValue.serverTimestamp(),
    });
    
    print('✅ Location updated: ${pos.latitude}, ${pos.longitude}');
  }
  
  /// Send first location immediately
  static Future<void> _sendInitialLocation(String partnerId) async {
    final position = await _getCurrentPosition();
    if (position != null) {
      await _updatePartnerLocation(partnerId, position);
    }
  }
}
```

### D. When to Start/Stop Tracking

**Start Tracking:**
- Partner sets status to "Online" → call `LocationTrackingService.startTracking(partnerId)`
- Partner accepts an order → ensure tracking is active

**Stop Tracking:**
- Partner sets status to "Offline" → call `LocationTrackingService.stopTracking()`
- Partner completes delivery → optional (can keep tracking if staying online)
- App closes → `AppLifecycleState.detached` → stop tracking

**Background Tracking (Advanced):**
For iOS/Android background location updates, use:
- **Android:** Foreground Service with notification
- **iOS:** `background_location` package with proper permissions
- **Package:** `flutter_background_service` + `geolocator`

---

## 3. Order Assignment (Nearest Partner)

### A. Cloud Function: Auto-Assign Order

**File:** `functions/src/assignDeliveryPartner.ts`

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Assign nearest available delivery partner to an order
 * Triggered when order status changes to 'confirmed'
 */
export const assignDeliveryPartner = functions.firestore
  .document('orders/{orderId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    // Only proceed if order just got confirmed
    if (before.status !== 'confirmed' && after.status === 'confirmed') {
      return null;
    }
    
    // Already has a partner assigned
    if (after.deliveryPartnerId) {
      return null;
    }
    
    const orderId = context.params.orderId;
    const restaurantId = after.restaurantId;
    
    try {
      // Get restaurant location
      const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();
      if (!restaurantDoc.exists) {
        console.error(`Restaurant ${restaurantId} not found`);
        return null;
      }
      
      const restaurant = restaurantDoc.data()!;
      const restaurantLat = restaurant.location?.latitude;
      const restaurantLng = restaurant.location?.longitude;
      
      if (!restaurantLat || !restaurantLng) {
        console.error(`Restaurant ${restaurantId} has no location`);
        return null;
      }
      
      // Find all available partners
      const partnersSnapshot = await db
        .collection('deliveryPartners')
        .where('status', 'in', ['online', 'available'])
        .where('isOnline', '==', true)
        .get();
      
      if (partnersSnapshot.empty) {
        console.log('No available delivery partners');
        // TODO: Notify admin/restaurant
        return null;
      }
      
      // Calculate distances and find nearest
      let nearestPartner = null;
      let minDistance = Infinity;
      
      for (const doc of partnersSnapshot.docs) {
        const partner = doc.data();
        const partnerLat = partner.location?.latitude;
        const partnerLng = partner.location?.longitude;
        
        if (!partnerLat || !partnerLng) continue;
        
        const distance = calculateDistance(
          restaurantLat,
          restaurantLng,
          partnerLat,
          partnerLng
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          nearestPartner = { id: doc.id, ...partner, distance };
        }
      }
      
      if (!nearestPartner) {
        console.log('No partner with valid location found');
        return null;
      }
      
      // Assign partner to order
      await db.collection('orders').doc(orderId).update({
        deliveryPartnerId: nearestPartner.id,
        deliveryPartnerName: nearestPartner.name,
        deliveryPartnerPhone: nearestPartner.phone,
        pickupDistance: minDistance,
        assignedAt: admin.firestore.FieldValue.serverTimestamp(),
        deliveryStage: 'assigned', // assigned → picked_up → out_for_delivery → delivered
      });
      
      // Update partner status
      await db.collection('deliveryPartners').doc(nearestPartner.id).update({
        status: 'busy',
        currentOrderId: orderId,
      });
      
      // Send notification to partner
      await sendNotificationToPartner(nearestPartner.id, {
        title: 'New Order Assigned',
        body: `Order #${orderId.slice(-6)} - ${restaurant.name}`,
        orderId,
      });
      
      console.log(`✅ Assigned order ${orderId} to partner ${nearestPartner.id} (${minDistance.toFixed(2)} km away)`);
      
      return null;
    } catch (error) {
      console.error('Error assigning delivery partner:', error);
      return null;
    }
  });

async function sendNotificationToPartner(partnerId: string, payload: any) {
  // Implement FCM push notification
  // See CLOUD_FUNCTIONS_DELIVERY_PARTNER.md for details
}
```

---

## 4. Customer Order Tracking

### A. Real-Time Location Subscription (Customer App)

**File:** `lib/screens/order/order_tracking_screen.dart`

```dart
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

class OrderTrackingScreen extends StatefulWidget {
  final String orderId;
  const OrderTrackingScreen({required this.orderId});
  
  @override
  State<OrderTrackingScreen> createState() => _OrderTrackingScreenState();
}

class _OrderTrackingScreenState extends State<OrderTrackingScreen> {
  GoogleMapController? _mapController;
  String? _deliveryPartnerId;
  LatLng? _partnerLocation;
  LatLng? _deliveryLocation;
  
  @override
  void initState() {
    super.initState();
    _loadOrderDetails();
  }
  
  /// Load order and start listening to partner location
  Future<void> _loadOrderDetails() async {
    final orderDoc = await FirebaseFirestore.instance
        .collection('orders')
        .doc(widget.orderId)
        .get();
    
    if (!orderDoc.exists) return;
    
    final order = orderDoc.data()!;
    final partnerId = order['deliveryPartnerId'];
    
    if (partnerId != null) {
      setState(() {
        _deliveryPartnerId = partnerId;
        _deliveryLocation = LatLng(
          order['deliveryAddress']['latitude'],
          order['deliveryAddress']['longitude'],
        );
      });
      
      _subscribeToPartnerLocation(partnerId);
    }
  }
  
  /// Subscribe to real-time partner location updates
  void _subscribeToPartnerLocation(String partnerId) {
    FirebaseFirestore.instance
        .collection('deliveryPartners')
        .doc(partnerId)
        .snapshots()
        .listen((snapshot) {
      if (!snapshot.exists) return;
      
      final data = snapshot.data()!;
      final lat = data['location']?['latitude'];
      final lng = data['location']?['longitude'];
      
      if (lat != null && lng != null) {
        setState(() {
          _partnerLocation = LatLng(lat, lng);
        });
        
        // Animate camera to new position
        _mapController?.animateCamera(
          CameraUpdate.newLatLng(_partnerLocation!),
        );
      }
    });
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Track Order')),
      body: GoogleMap(
        initialCameraPosition: CameraPosition(
          target: _deliveryLocation ?? LatLng(17.385044, 78.486671),
          zoom: 13.5,
        ),
        onMapCreated: (controller) => _mapController = controller,
        markers: {
          if (_partnerLocation != null)
            Marker(
              markerId: MarkerId('partner'),
              position: _partnerLocation!,
              icon: BitmapDescriptor.defaultMarkerWithHue(
                BitmapDescriptor.hueBlue,
              ),
              infoWindow: InfoWindow(title: 'Delivery Partner'),
            ),
          if (_deliveryLocation != null)
            Marker(
              markerId: MarkerId('delivery'),
              position: _deliveryLocation!,
              icon: BitmapDescriptor.defaultMarkerWithHue(
                BitmapDescriptor.hueRed,
              ),
              infoWindow: InfoWindow(title: 'Delivery Address'),
            ),
        },
      ),
    );
  }
}
```

---

## 5. Admin Dashboard (Current Implementation)

### A. Files Modified

| File | Changes |
|------|---------|
| `src/data/dummy.ts` | Added `location` object to `Restaurant` interface |
| `src/pages/Restaurants.tsx` | Added Google Maps picker modal for location selection |
| `src/lib/firebaseService.ts` | Helper functions for geocoding & Places API |

### B. Map Picker Component (Admin)

Admin will use a modal with:
- **Search bar** → Google Places Autocomplete
- **Google Map** → Draggable marker (like `AddressMapPicker` from mobile app)
- **My Location button** → Centers on admin's current location
- **Address display** → Shows selected address
- **Confirm/Cancel** → Saves or discards location

**Implementation approach:**
Since admin is React web app (not Flutter), we'll use:
- `@react-google-maps/api` package
- Google Maps JavaScript API (same key: `AIzaSyBwSjsnX7tDra6Wz5mw6wZRwRN57pi0NUM`)
- Places Autocomplete Service
- Geocoding Service

---

## 6. Security Rules Update

**File:** `firestore.rules`

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Restaurant location: only admins can write, anyone can read
    match /restaurants/{restaurantId} {
      allow read: if true;
      allow write: if request.auth != null && 
                     get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role == 'admin';
      
      // Validate location exists
      allow create: if request.resource.data.location.latitude is number &&
                       request.resource.data.location.longitude is number;
    }
    
    // Delivery partner location: only partner themselves can update
    match /deliveryPartners/{partnerId} {
      allow read: if true;
      allow update: if request.auth != null && 
                       request.auth.uid == partnerId &&
                       request.resource.data.diff(resource.data).affectedKeys()
                         .hasOnly(['location', 'lastSeen']);
    }
  }
}
```

---

## 7. Google Maps API Setup

### Required APIs (Already enabled for customer app):
- ✅ Maps JavaScript API (admin web)
- ✅ Places API (autocomplete)
- ✅ Geocoding API (reverse geocode)

### API Key Configuration:

**Current Key:** `AIzaSyBwSjsnX7tDra6Wz5mw6wZRwRN57pi0NUM`

**For Admin Web (React):**
Add to `.env` file:
```bash
VITE_GOOGLE_MAPS_API_KEY=AIzaSyBwSjsnX7tDra6Wz5mw6wZRwRN57pi0NUM
```

**Enable in Google Cloud Console:**
1. Go to: https://console.cloud.google.com/apis/dashboard
2. Enable: **Maps JavaScript API**
3. Add restriction: Allowed referrers: `https://tastykart-b791a.web.app/*`

---

## 8. Testing Checklist

### Admin (Restaurant Location):
- [ ] Create new restaurant without selecting location → validation error
- [ ] Search address via Places → marker moves + address fills
- [ ] Drag marker → reverse geocode updates address
- [ ] Click "My Location" → map centers on current position
- [ ] Save restaurant → verify `location` object saved in Firestore
- [ ] Edit existing restaurant → map loads saved location correctly

### Delivery Partner App:
- [ ] Partner goes online → location updates start (every 60s)
- [ ] Check Firestore → `location.timestamp` updates regularly
- [ ] Partner goes offline → location updates stop
- [ ] Accept order → tracking continues during delivery
- [ ] Complete delivery → tracking stops (or continues if staying online)

### Customer App:
- [ ] Place order → order gets assigned to nearest partner
- [ ] Open tracking screen → partner marker visible on map
- [ ] Wait 60 seconds → partner marker updates position
- [ ] Partner moves → map animates to new location
- [ ] Delivery complete → tracking screen shows final location

### Cloud Functions:
- [ ] Order confirmed → `assignDeliveryPartner` triggers
- [ ] Nearest partner calculated correctly
- [ ] Partner receives FCM notification
- [ ] Order updates with `deliveryPartnerId` and `pickupDistance`
- [ ] Partner status changes to `busy`

---

## 9. Database Indexes Required

**File:** `firestore.indexes.json`

```json
{
  "indexes": [
    {
      "collectionGroup": "deliveryPartners",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "isOnline", "order": "ASCENDING" },
        { "fieldPath": "location.timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "orders",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "deliveryPartnerId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

Deploy: `firebase deploy --only firestore:indexes`

---

## 10. Performance & Cost Optimization

### Location Update Frequency:
- **60 seconds** = 60 writes/hour = 1,440 writes/day per partner
- 10 active partners = 14,400 writes/day
- Firestore free tier: 20K writes/day ✅

### Reduce costs:
- Update only when location changes significantly (>50 meters)
- Stop tracking when partner is idle (no active orders)
- Use batch writes for multiple updates

### Battery optimization (Mobile):
- Use `LocationAccuracy.balanced` instead of `high` when not delivering
- Increase interval to 2-3 minutes when partner is online but idle
- Stop tracking completely when offline

---

## 11. Error Handling

### Scenarios:

| Error | Solution |
|-------|----------|
| GPS permission denied | Show in-app prompt to enable location |
| GPS accuracy too low | Retry with fallback accuracy setting |
| Network error during update | Queue updates locally, retry when online |
| No available partners | Notify admin, show "Finding partner..." to customer |
| Partner location outdated (>5 min) | Mark as offline, exclude from assignment |
| Restaurant has no location | Admin cannot activate restaurant |

---

## 12. Summary: Implementation Path

### Phase 1: Admin Restaurant Location (Current Sprint)
1. ✅ Update `Restaurant` interface with `location` object
2. ✅ Add Google Maps picker modal to Restaurants.tsx
3. ✅ Install `@react-google-maps/api` package
4. ✅ Implement Places Autocomplete search
5. ✅ Implement draggable marker + reverse geocode
6. ✅ Add form validation (location required)
7. ✅ Deploy updated admin dashboard

### Phase 2: Delivery Partner Tracking (Mobile)
1. Create `LocationTrackingService` in Flutter app
2. Start tracking on "Go Online" / accept order
3. Update Firestore every 60 seconds
4. Stop tracking on "Go Offline" / app close
5. Test background location on Android & iOS

### Phase 3: Order Assignment (Cloud Functions)
1. Deploy `assignDeliveryPartner` function
2. Calculate nearest partner using Haversine formula
3. Update order & partner documents
4. Send FCM notification to assigned partner
5. Monitor logs & performance

### Phase 4: Customer Tracking (Mobile)
1. Create `OrderTrackingScreen` with GoogleMap
2. Subscribe to partner location updates (Firestore realtime)
3. Animate marker movement smoothly
4. Show delivery stage (assigned → picked → out → delivered)
5. Test with live partner movement

---

## 📞 Support

For issues or questions:
- Firebase Console: https://console.firebase.google.com/project/tastykart-b791a
- Google Cloud Console: https://console.cloud.google.com/
- Maps API Docs: https://developers.google.com/maps/documentation

---

*Keep this doc updated as you implement each phase. Current status: **Phase 1 (Admin) - In Progress***
