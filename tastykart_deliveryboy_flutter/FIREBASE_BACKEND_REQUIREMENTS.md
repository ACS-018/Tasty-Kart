# TastyKart Delivery Partner App - Firebase Backend Requirements

**Project**: TastyKart Food Delivery Platform  
**Component**: Delivery Partner Mobile Application  
**Backend**: Firebase (Firestore, Authentication, Storage, Cloud Functions)  
**Document Version**: 1.0  
**Date**: September 11, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Firebase Project Setup](#firebase-project-setup)
3. [Firebase Authentication](#firebase-authentication)
4. [Firestore Database Structure](#firestore-database-structure)
5. [Security Rules](#security-rules)
6. [Cloud Storage](#cloud-storage)
7. [Cloud Functions](#cloud-functions)
8. [Firebase Cloud Messaging](#firebase-cloud-messaging)
9. [Indexes](#indexes)
10. [API Integration Requirements](#api-integration-requirements)
11. [Real-time Updates](#real-time-updates)
12. [Data Synchronization](#data-synchronization)
13. [Performance & Scalability](#performance--scalability)
14. [Monitoring & Analytics](#monitoring--analytics)

---

## Overview

The TastyKart Delivery Partner app is part of a three-app ecosystem (Admin, User/Customer, Delivery Partner) sharing a single Firebase project. This document outlines the backend requirements specific to the delivery partner application while maintaining consistency with the existing admin and user apps.

### Key Requirements
- **Shared Firebase Project**: `tastykart-b791a`
- **Package Name**: `com.arrowcoders.fooddeliveryboy`
- **Primary Collections**: Shared with Admin and User apps
- **Real-time Updates**: Critical for order assignments and status changes
- **Offline Support**: Basic offline capability for viewing assigned orders
- **Location Tracking**: Real-time location updates during active deliveries

---

## Firebase Project Setup

### Project Information
```
Project ID: tastykart-b791a
Project Number: 1045450942825
Storage Bucket: tastykart-b791a.firebasestorage.app
Package Name: com.arrowcoders.fooddeliveryboy
```

### Required Firebase Services
- ✅ Firebase Authentication
- ✅ Cloud Firestore
- ✅ Firebase Storage
- ✅ Firebase Cloud Messaging (FCM)
- ⚠️ Cloud Functions (Required for business logic)
- ⚠️ Firebase Extensions (Optional: Resize Images)
- ⚠️ Firebase Analytics (Optional: Performance monitoring)

### Platform Configuration
- **Android**: google-services.json configured
- **iOS**: GoogleService-Info.plist required
- **Web**: Not applicable (mobile-only app)

---

## Firebase Authentication

### Authentication Methods
1. **Phone Number Authentication** (Primary)
   - OTP-based verification
   - Used for delivery partner login
   - Phone number format: Country code + number (e.g., +919876543210)

2. **Email/Password** (Optional backup)
   - For admin-assigned accounts
   - Password reset via email

### Authentication Flow
```
1. Partner enters phone number
2. Firebase sends OTP via SMS
3. Partner verifies OTP
4. Check if user exists in `deliveryPartners` collection
5. If not exists or wrong role → throw WrongAppRoleException
6. If blocked → throw PartnerBlockedException
7. If approved=false → show "Pending Approval" screen
8. If approved=true → navigate to home
```

### User Metadata
```dart
FirebaseAuth.instance.currentUser:
  - uid: String (matches deliveryPartners/{id})
  - phoneNumber: String
  - displayName: String (delivery partner name)
  - photoURL: String (avatar URL from Storage)
```

### Security Requirements
- Phone number verification mandatory
- Rate limiting on OTP requests (max 5 per hour per number)
- Session timeout: 30 days
- Multi-device login: Allowed (but track active devices)
- Account linking: Support linking phone with email

---

## Firestore Database Structure

### Collection: `deliveryPartners` (Root Collection)
**Purpose**: Core delivery partner profile and account information  
**Document ID**: Auto-generated or UID from Firebase Auth  
**Access**: Read/Write by partner (own document), Read/Write by Admin

```javascript
{
  // Identity
  "id": "partner_uid",
  "uid": "firebase_auth_uid", // Same as document ID
  "name": "John Doe",
  "phone": "+919876543210",
  "email": "john@example.com",
  "avatar": "gs://bucket/partners/uid/avatar.jpg",
  
  // Location & Assignment
  "city": "Mumbai",
  "currentLat": 19.0760,
  "currentLng": 72.8777,
  "lastLocationUpdate": Timestamp,
  
  // Status & Availability
  "status": "available", // available, busy, offline, blocked
  "approved": true,
  "activationAcknowledged": true,
  "blockedAt": null,
  "blockedReason": null,
  
  // Vehicle Information
  "vehicle": "Bike", // Bike, Scooter, Bicycle, Car
  "vehicleNumber": "MH-01-AB-1234",
  
  // Documents (KYC)
  "documents": {
    "aadhar": "storage_url",
    "pan": "storage_url",
    "drivingLicense": "storage_url",
    "vehicleRC": "storage_url",
    "profilePhoto": "storage_url"
  },
  "documentsComplete": true,
  
  // Bank Details
  "accountHolderName": "John Doe",
  "bankAccount": "1234567890",
  "ifsc": "SBIN0001234",
  "ifscVerified": true,
  "upiId": "john@paytm",
  
  // Training & Onboarding
  "trainingCompleted": ["safety", "app_usage", "customer_service"],
  "trainingComplete": true,
  "termsAccepted": true,
  "legalAccepted": ["terms", "privacy", "partner_agreement"],
  
  // Performance Metrics
  "rating": 4.5,
  "completedOrders": 150,
  "cancelledOrders": 5,
  "acceptRate": 0.85, // Orders accepted / Orders offered
  "earnings": 45000, // Total lifetime earnings in smallest currency unit
  "pocketBalance": 5000, // Current balance (earnings - withdrawals)
  "cashLimit": 10000, // Max cash they can hold
  "tipBalance": 500,
  
  // Slot Booking
  "bookedSlots": [
    {
      "slotId": "slot_morning",
      "date": "2026-09-11"
    }
  ],
  
  // Preferences
  "notificationsEnabled": true,
  "fcmTokens": ["device_token_1", "device_token_2"],
  
  // Metadata
  "gender": "Male",
  "dateOfBirth": "1995-05-15",
  "createdAt": Timestamp,
  "updatedAt": Timestamp
}
```

### Collection: `orders` (Root Collection - Shared)
**Purpose**: Order data shared across all three apps  
**Document ID**: Auto-generated order ID  
**Access**: Read by assigned partner, Write by Admin/Functions

```javascript
{
  // Order Identification
  "id": "order_id",
  "orderNumber": "#TK12345",
  "status": "preparing", // placed, accepted, preparing, ready, picked, delivered, cancelled, refunded
  
  // Customer Information
  "customerId": "user_uid",
  "customerName": "Jane Smith",
  "customerPhone": "+919876543211",
  
  // Restaurant Information
  "restaurantId": "rest_id",
  "restaurantName": "Pizza Hub",
  "restaurantAddress": "123 Main St, Mumbai",
  "restaurantPhone": "+919876543212",
  "restaurantLat": 19.0760,
  "restaurantLng": 72.8777,
  
  // Delivery Partner Assignment
  "deliveryPartnerId": "partner_uid",
  "deliveryPartnerName": "John Doe",
  "partnerAccepted": false,
  "deliveryStage": "to_restaurant", // to_restaurant, at_restaurant, to_customer, at_customer
  "pickupCode": "1234", // 4-digit code for restaurant pickup verification
  "deniedPartnerId": "", // Track if partner denied/cancelled
  
  // Delivery Address
  "deliveryAddress": {
    "fullAddress": "456 Park Ave, Apt 5B",
    "label": "Home",
    "landmark": "Near Central Park",
    "city": "Mumbai",
    "lat": 19.0800,
    "lng": 72.8800
  },
  "address": "456 Park Ave, Apt 5B, Mumbai", // Flattened for backward compatibility
  "addressLabel": "Home",
  "addressLandmark": "Near Central Park",
  "addressCity": "Mumbai",
  "destLat": 19.0800,
  "destLng": 72.8800,
  
  // Distance & Route
  "pickupKm": 2.5, // Distance from partner to restaurant
  "dropKm": 3.2, // Distance from restaurant to customer
  
  // Financial
  "deliveryFee": 40,
  "total": 550, // Grand total including delivery fee
  "paymentMethod": "Cash on Delivery", // COD, Razorpay, UPI, etc.
  "collectedVia": "", // "cash" or "online" - filled when delivered
  
  // Order Items (simplified for partner view)
  "items": [
    {
      "name": "Margherita Pizza",
      "quantity": 2,
      "price": 250
    }
  ],
  
  // Multi-pickup Flag
  "multiPickup": false, // If partner is picking multiple orders from same restaurant
  
  // Cancellation
  "cancelReason": "",
  "cancelPhase": "", // customer, restaurant, partner, system
  "cancelledBy": "", // user_id or system
  
  // Timestamps
  "createdAt": Timestamp,
  "acceptedAt": Timestamp, // Restaurant accepted
  "readyAt": Timestamp, // Restaurant marked ready
  "pickedAt": Timestamp, // Partner picked up
  "deliveredAt": Timestamp,
  "updatedAt": Timestamp,
  
  // Metadata
  "platformFee": 20,
  "gstAmount": 30,
  "packagingCharges": 10
}
```

### Collection: `transactions` (Root Collection)
**Purpose**: Financial transactions for delivery partners  
**Document ID**: Auto-generated  
**Access**: Read by partner (own transactions), Write by Admin/Functions

```javascript
{
  "id": "txn_id",
  "partnerId": "partner_uid",
  "type": "order_earning", // order_earning, payout, withdrawal, deduction, late_delivery, tip, tip_deduction
  "title": "Delivery Payment - #TK12345",
  "orderNumber": "#TK12345",
  "orderId": "order_id",
  "amount": 40, // Positive for credit, negative for debit
  "method": "auto", // auto, bank_transfer, upi
  "status": "completed", // pending, completed, failed
  "utr": "UTR123456789", // Bank transaction reference
  "balanceBefore": 5000,
  "balanceAfter": 5040,
  "createdAt": Timestamp,
  "processedAt": Timestamp,
  "remarks": "Delivery fee for order #TK12345"
}
```

### Collection: `notifications` (Root Collection)
**Purpose**: In-app notifications for delivery partners  
**Document ID**: Auto-generated  
**Access**: Read by partner (own notifications), Write by Admin/Functions

```javascript
{
  "id": "notif_id",
  "userId": "partner_uid",
  "userType": "delivery_partner",
  "type": "order_assigned", // order_assigned, order_cancelled, payment_received, account_update, announcement
  "title": "New Order Assigned",
  "message": "You have been assigned order #TK12345",
  "data": {
    "orderId": "order_id",
    "orderNumber": "#TK12345",
    "action": "view_order" // Deep link action
  },
  "read": false,
  "priority": "high", // low, medium, high, urgent
  "createdAt": Timestamp,
  "expiresAt": Timestamp // Auto-delete after this time
}
```

### Collection: `settings` (Root Collection)
**Purpose**: Platform-wide settings shared across apps  
**Document ID**: `admin` (single document)  
**Access**: Read by all, Write by Admin only

```javascript
{
  // Delivery Partner Settings
  "deliveryPartner": {
    "baseFee": 30,
    "perKmRate": 8,
    "minDistance": 1,
    "maxDistance": 10,
    "acceptanceTimeout": 120, // seconds to accept order
    "lateDeliveryThreshold": 45, // minutes
    "lateDeliveryPenalty": 20,
    "cashLimitDefault": 10000,
    "withdrawalMinAmount": 500,
    "withdrawalMaxAmount": 50000,
    "slotDuration": 4, // hours
    "requiredDocuments": ["aadhar", "pan", "drivingLicense", "vehicleRC", "profilePhoto"]
  },
  
  // Platform Settings
  "supportPhone": "+911234567890",
  "supportEmail": "support@tastykart.com",
  "termsUrl": "https://tastykart.com/terms",
  "privacyUrl": "https://tastykart.com/privacy",
  "partnerAgreementUrl": "https://tastykart.com/partner-agreement",
  
  // Feature Flags
  "features": {
    "slotBooking": true,
    "multiPickup": true,
    "tipCollection": true,
    "cashCollection": true
  }
}
```

### Collection: `banners` (Root Collection)
**Purpose**: Promotional banners for delivery partner app  
**Document ID**: Auto-generated  
**Access**: Read by all partners, Write by Admin

```javascript
{
  "id": "banner_id",
  "title": "Earn More This Weekend!",
  "description": "Complete 20+ orders and get ₹500 bonus",
  "imageUrl": "storage_url",
  "targetScreen": "earnings", // home, earnings, profile, orders
  "actionUrl": "",
  "active": true,
  "priority": 1,
  "startDate": Timestamp,
  "endDate": Timestamp,
  "createdAt": Timestamp
}
```

### Subcollection: `deliveryPartners/{partnerId}/slots` 
**Purpose**: Daily time slots for delivery partners  
**Document ID**: Date in format YYYY-MM-DD  
**Access**: Read/Write by partner, Read by Admin

```javascript
{
  "date": "2026-09-11",
  "bookedSlots": [
    {
      "slotId": "morning",
      "label": "Morning (8 AM - 12 PM)",
      "startTime": "08:00",
      "endTime": "12:00",
      "bookedAt": Timestamp
    }
  ],
  "status": "active", // active, cancelled, completed
  "earnings": 800,
  "ordersCompleted": 12
}
```

### Subcollection: `deliveryPartners/{partnerId}/locations`
**Purpose**: Location history for tracking and dispute resolution  
**Document ID**: Timestamp-based  
**Access**: Write by partner app, Read by Admin

```javascript
{
  "lat": 19.0760,
  "lng": 72.8777,
  "accuracy": 10.5, // meters
  "orderId": "order_id", // If location is during active delivery
  "timestamp": Timestamp,
  "battery": 65, // percentage
  "isMoving": true
}
```

---

## Security Rules

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper Functions
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isPartner(partnerId) {
      return isSignedIn() && request.auth.uid == partnerId;
    }
    
    function isAdmin() {
      // Admin check - verify admin role from custom claims or admin collection
      return isSignedIn() && 
        get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role == 'admin';
    }
    
    function getPartnerDoc(partnerId) {
      return get(/databases/$(database)/documents/deliveryPartners/$(partnerId)).data;
    }
    
    function isApprovedPartner(partnerId) {
      let partnerData = getPartnerDoc(partnerId);
      return partnerData.approved == true && partnerData.status != 'blocked';
    }
    
    // Delivery Partners Collection
    match /deliveryPartners/{partnerId} {
      // Partner can read their own document
      allow read: if isPartner(partnerId) || isAdmin();
      
      // Partner can update specific fields in their own document
      allow update: if isPartner(partnerId) && 
        // Only allow updating these fields
        request.resource.data.diff(resource.data).affectedKeys()
          .hasOnly(['name', 'email', 'currentLat', 'currentLng', 'lastLocationUpdate', 
                   'status', 'avatar', 'vehicle', 'vehicleNumber', 'documents', 
                   'accountHolderName', 'bankAccount', 'ifsc', 'upiId', 
                   'trainingCompleted', 'termsAccepted', 'legalAccepted', 
                   'activationAcknowledged', 'bookedSlots', 'notificationsEnabled', 
                   'fcmTokens', 'updatedAt']) &&
        // Cannot change critical fields
        request.resource.data.approved == resource.data.approved &&
        request.resource.data.status != 'blocked';
      
      // Only admin can create new partners
      allow create: if isAdmin();
      
      // Only admin can delete
      allow delete: if isAdmin();
      
      // Subcollections
      match /slots/{date} {
        allow read, write: if isPartner(partnerId) || isAdmin();
      }
      
      match /locations/{locationId} {
        allow read: if isAdmin();
        allow create: if isPartner(partnerId) && isApprovedPartner(partnerId);
      }
    }
    
    // Orders Collection
    match /orders/{orderId} {
      // Partners can read orders assigned to them or unassigned orders in their city
      allow read: if isSignedIn() && (
        resource.data.deliveryPartnerId == request.auth.uid ||
        (resource.data.deliveryPartnerId == '' && 
         resource.data.status in ['accepted', 'preparing', 'ready'] &&
         getPartnerDoc(request.auth.uid).city == resource.data.restaurantCity)
      ) || isAdmin();
      
      // Partners can update specific fields for their assigned orders
      allow update: if isPartner(resource.data.deliveryPartnerId) && 
        isApprovedPartner(request.auth.uid) &&
        request.resource.data.diff(resource.data).affectedKeys()
          .hasOnly(['partnerAccepted', 'deliveryStage', 'status', 'pickedAt', 
                   'deliveredAt', 'collectedVia', 'deniedPartnerId', 'updatedAt']) &&
        // Status transitions must be valid
        (
          (resource.data.status == 'ready' && request.resource.data.status == 'picked') ||
          (resource.data.status == 'picked' && request.resource.data.status == 'delivered') ||
          (resource.data.status in ['accepted', 'preparing', 'ready'] && 
           request.resource.data.status == 'cancelled' && 
           request.resource.data.cancelledBy == request.auth.uid)
        );
      
      // Only admin/functions can create orders
      allow create: if isAdmin();
      
      // Only admin can delete
      allow delete: if isAdmin();
    }
    
    // Transactions Collection
    match /transactions/{txnId} {
      // Partners can read their own transactions
      allow read: if isSignedIn() && 
        resource.data.partnerId == request.auth.uid || isAdmin();
      
      // Only admin/functions can create, update, delete
      allow write: if isAdmin();
    }
    
    // Notifications Collection
    match /notifications/{notifId} {
      // Partners can read their own notifications
      allow read: if isSignedIn() && 
        resource.data.userId == request.auth.uid || isAdmin();
      
      // Partners can mark as read
      allow update: if isPartner(resource.data.userId) &&
        request.resource.data.diff(resource.data).affectedKeys()
          .hasOnly(['read']);
      
      // Only admin/functions can create notifications
      allow create: if isAdmin();
      
      // Partners can delete their own read notifications
      allow delete: if isPartner(resource.data.userId) && 
        resource.data.read == true;
    }
    
    // Settings Collection
    match /settings/{docId} {
      // Everyone can read settings
      allow read: if true;
      
      // Only admin can write
      allow write: if isAdmin();
    }
    
    // Banners Collection
    match /banners/{bannerId} {
      // Everyone can read active banners
      allow read: if resource.data.active == true || isAdmin();
      
      // Only admin can write
      allow write: if isAdmin();
    }
  }
}
```

---

## Cloud Storage

### Storage Structure
```
gs://tastykart-b791a.firebasestorage.app/
├── partners/
│   ├── {partnerId}/
│   │   ├── avatar.jpg (profile picture)
│   │   ├── documents/
│   │   │   ├── aadhar.jpg
│   │   │   ├── pan.jpg
│   │   │   ├── driving_license.jpg
│   │   │   ├── vehicle_rc.jpg
│   │   │   └── profile_photo.jpg
│   │   └── temp/ (temporary uploads)
├── orders/
│   └── {orderId}/
│       └── delivery_proof.jpg (optional photo proof of delivery)
```

### Storage Security Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isPartner(partnerId) {
      return request.auth != null && request.auth.uid == partnerId;
    }
    
    function isValidImage() {
      return request.resource.size < 10 * 1024 * 1024 && // 10MB max
             request.resource.contentType.matches('image/.*');
    }
    
    function isValidDocument() {
      return request.resource.size < 10 * 1024 * 1024 && // 10MB max
             (request.resource.contentType.matches('image/.*') ||
              request.resource.contentType == 'application/pdf');
    }
    
    // Partner Files
    match /partners/{partnerId}/{allPaths=**} {
      // Partners can read/write their own files
      allow read: if isPartner(partnerId);
      
      allow write: if isPartner(partnerId) && (
        (allPaths.matches('avatar.jpg') && isValidImage()) ||
        (allPaths.matches('documents/.*') && isValidDocument()) ||
        (allPaths.matches('temp/.*'))
      );
    }
    
    // Order delivery proof
    match /orders/{orderId}/{allPaths=**} {
      allow read: if isSignedIn();
      allow write: if isSignedIn() && isValidImage();
    }
  }
}
```

---

## Cloud Functions

### Required Cloud Functions

#### 1. **onPartnerSignUp** (Auth Trigger)
**Trigger**: onCreate in Firebase Authentication  
**Purpose**: Initialize delivery partner document when new user signs up

```javascript
exports.onPartnerSignUp = functions.auth.user().onCreate(async (user) => {
  const { uid, phoneNumber } = user;
  
  // Check if partner document already exists
  const partnerRef = admin.firestore().collection('deliveryPartners').doc(uid);
  const doc = await partnerRef.get();
  
  if (!doc.exists) {
    await partnerRef.set({
      id: uid,
      uid: uid,
      phone: phoneNumber || '',
      name: '',
      email: '',
      city: '',
      status: 'offline',
      approved: false,
      documents: {},
      documentsComplete: false,
      trainingComplete: false,
      termsAccepted: false,
      rating: 0,
      completedOrders: 0,
      earnings: 0,
      pocketBalance: 0,
      cashLimit: 0,
      tipBalance: 0,
      acceptRate: 0,
      notificationsEnabled: true,
      fcmTokens: [],
      bookedSlots: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
});
```

#### 2. **assignDeliveryPartner** (Callable Function)
**Trigger**: Called by Admin app or automated assignment logic  
**Purpose**: Assign delivery partner to an order

```javascript
exports.assignDeliveryPartner = functions.https.onCall(async (data, context) => {
  const { orderId, partnerId } = data;
  
  // Validate inputs and permissions
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const orderRef = admin.firestore().collection('orders').doc(orderId);
  const partnerRef = admin.firestore().collection('deliveryPartners').doc(partnerId);
  
  const [orderDoc, partnerDoc] = await Promise.all([
    orderRef.get(),
    partnerRef.get()
  ]);
  
  if (!orderDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Order not found');
  }
  
  if (!partnerDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Partner not found');
  }
  
  const partner = partnerDoc.data();
  
  if (!partner.approved || partner.status === 'blocked') {
    throw new functions.https.HttpsError('failed-precondition', 'Partner is not available');
  }
  
  // Calculate distances (use Google Distance Matrix API)
  const distances = await calculateDistances(
    partner.currentLat,
    partner.currentLng,
    orderDoc.data().restaurantLat,
    orderDoc.data().restaurantLng,
    orderDoc.data().destLat,
    orderDoc.data().destLng
  );
  
  // Update order with partner assignment
  await orderRef.update({
    deliveryPartnerId: partnerId,
    deliveryPartnerName: partner.name,
    partnerAccepted: false,
    deliveryStage: 'to_restaurant',
    pickupKm: distances.pickupKm,
    dropKm: distances.dropKm,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  // Update partner status
  await partnerRef.update({
    status: 'busy',
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  // Send push notification to partner
  await sendNotificationToPartner(partnerId, {
    title: 'New Order Assigned',
    body: `Order ${orderDoc.data().orderNumber} has been assigned to you`,
    data: { orderId, action: 'view_order' }
  });
  
  return { success: true };
});
```

#### 3. **onOrderStatusChange** (Firestore Trigger)
**Trigger**: onUpdate in orders collection  
**Purpose**: Handle order status changes and update related data

```javascript
exports.onOrderStatusChange = functions.firestore
  .document('orders/{orderId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const orderId = context.params.orderId;
    
    // If order is delivered
    if (before.status !== 'delivered' && after.status === 'delivered') {
      const partnerId = after.deliveryPartnerId;
      const deliveryFee = after.deliveryFee;
      
      // Create transaction for partner earnings
      await admin.firestore().collection('transactions').add({
        partnerId: partnerId,
        type: 'order_earning',
        title: `Delivery Payment - ${after.orderNumber}`,
        orderNumber: after.orderNumber,
        orderId: orderId,
        amount: deliveryFee,
        method: 'auto',
        status: 'completed',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Update partner stats
      const partnerRef = admin.firestore().collection('deliveryPartners').doc(partnerId);
      await partnerRef.update({
        completedOrders: admin.firestore.FieldValue.increment(1),
        earnings: admin.firestore.FieldValue.increment(deliveryFee),
        pocketBalance: admin.firestore.FieldValue.increment(deliveryFee),
        cashLimit: admin.firestore.FieldValue.increment(deliveryFee),
        status: 'available',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Send notification
      await sendNotificationToPartner(partnerId, {
        title: 'Order Delivered',
        body: `You earned ₹${deliveryFee} for order ${after.orderNumber}`,
        data: { orderId, action: 'view_earnings' }
      });
    }
    
    // If order is cancelled
    if (before.status !== 'cancelled' && after.status === 'cancelled') {
      const partnerId = after.deliveryPartnerId;
      
      if (partnerId) {
        // Update partner status to available
        await admin.firestore().collection('deliveryPartners').doc(partnerId).update({
          status: 'available',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Send notification
        await sendNotificationToPartner(partnerId, {
          title: 'Order Cancelled',
          body: `Order ${after.orderNumber} has been cancelled`,
          data: { orderId }
        });
      }
    }
  });
```

#### 4. **processWithdrawal** (Callable Function)
**Trigger**: Called by partner when requesting payout  
**Purpose**: Process withdrawal request from partner's pocket balance

```javascript
exports.processWithdrawal = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { amount, method } = data; // method: 'bank_transfer' or 'upi'
  const partnerId = context.auth.uid;
  
  const partnerRef = admin.firestore().collection('deliveryPartners').doc(partnerId);
  const partnerDoc = await partnerRef.get();
  
  if (!partnerDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Partner not found');
  }
  
  const partner = partnerDoc.data();
  
  // Validate withdrawal
  const settings = await getSettings();
  const minAmount = settings.deliveryPartner.withdrawalMinAmount;
  const maxAmount = settings.deliveryPartner.withdrawalMaxAmount;
  
  if (amount < minAmount || amount > maxAmount) {
    throw new functions.https.HttpsError('invalid-argument', 
      `Withdrawal amount must be between ₹${minAmount} and ₹${maxAmount}`);
  }
  
  if (partner.pocketBalance < amount) {
    throw new functions.https.HttpsError('failed-precondition', 'Insufficient balance');
  }
  
  // Validate bank details
  if (method === 'bank_transfer' && (!partner.bankAccount || !partner.ifsc)) {
    throw new functions.https.HttpsError('failed-precondition', 'Bank details not provided');
  }
  
  if (method === 'upi' && !partner.upiId) {
    throw new functions.https.HttpsError('failed-precondition', 'UPI ID not provided');
  }
  
  // Process payout via payment gateway (Razorpay, etc.)
  const payoutResult = await processPayoutToPartner({
    partnerId,
    amount,
    method,
    accountDetails: method === 'upi' ? partner.upiId : 
      { account: partner.bankAccount, ifsc: partner.ifsc, name: partner.accountHolderName }
  });
  
  // Create transaction record
  await admin.firestore().collection('transactions').add({
    partnerId: partnerId,
    type: 'payout',
    title: `Withdrawal to ${method === 'upi' ? 'UPI' : 'Bank'}`,
    amount: -amount,
    method: method,
    status: payoutResult.success ? 'completed' : 'pending',
    utr: payoutResult.utr || '',
    balanceBefore: partner.pocketBalance,
    balanceAfter: partner.pocketBalance - amount,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    processedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  // Update partner balance
  if (payoutResult.success) {
    await partnerRef.update({
      pocketBalance: admin.firestore.FieldValue.increment(-amount),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  
  return { success: payoutResult.success, utr: payoutResult.utr };
});
```

#### 5. **verifyIFSC** (Callable Function)
**Trigger**: Called when partner enters IFSC code  
**Purpose**: Verify IFSC code and return bank details

```javascript
exports.verifyIFSC = functions.https.onCall(async (data, context) => {
  const { ifsc } = data;
  
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  if (!ifsc || ifsc.length !== 11) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid IFSC code');
  }
  
  // Call IFSC API (https://ifsc.razorpay.com/{ifsc})
  const response = await fetch(`https://ifsc.razorpay.com/${ifsc}`);
  
  if (!response.ok) {
    throw new functions.https.HttpsError('not-found', 'Invalid IFSC code');
  }
  
  const bankDetails = await response.json();
  
  return {
    bank: bankDetails.BANK,
    branch: bankDetails.BRANCH,
    address: bankDetails.ADDRESS,
    city: bankDetails.CITY,
    state: bankDetails.STATE,
    ifsc: bankDetails.IFSC
  };
});
```

#### 6. **sendOrderReminder** (Scheduled Function)
**Trigger**: Every 5 minutes  
**Purpose**: Remind partners about pending order assignments

```javascript
exports.sendOrderReminder = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    const fiveMinutesAgo = new Date(now.toMillis() - 5 * 60 * 1000);
    
    // Find orders that have been assigned but not accepted for > 2 minutes
    const ordersSnapshot = await admin.firestore()
      .collection('orders')
      .where('partnerAccepted', '==', false)
      .where('deliveryPartnerId', '!=', '')
      .where('status', 'in', ['accepted', 'preparing', 'ready'])
      .get();
    
    const reminders = [];
    
    ordersSnapshot.forEach(doc => {
      const order = doc.data();
      const updatedAt = order.updatedAt?.toDate();
      
      if (updatedAt && updatedAt < fiveMinutesAgo) {
        reminders.push(
          sendNotificationToPartner(order.deliveryPartnerId, {
            title: 'Order Waiting',
            body: `Please accept order ${order.orderNumber}`,
            data: { orderId: doc.id, action: 'view_order' },
            priority: 'high'
          })
        );
      }
    });
    
    await Promise.all(reminders);
  });
```

#### 7. **calculatePartnerRating** (Firestore Trigger)
**Trigger**: onCreate in reviews collection  
**Purpose**: Update partner rating when new review is added

```javascript
exports.calculatePartnerRating = functions.firestore
  .document('reviews/{reviewId}')
  .onCreate(async (snap, context) => {
    const review = snap.data();
    
    if (review.type !== 'delivery_partner' || !review.deliveryPartnerId) {
      return;
    }
    
    const partnerId = review.deliveryPartnerId;
    const partnerRef = admin.firestore().collection('deliveryPartners').doc(partnerId);
    
    // Get all reviews for this partner
    const reviewsSnapshot = await admin.firestore()
      .collection('reviews')
      .where('deliveryPartnerId', '==', partnerId)
      .where('type', '==', 'delivery_partner')
      .get();
    
    let totalRating = 0;
    let count = 0;
    
    reviewsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.rating) {
        totalRating += data.rating;
        count++;
      }
    });
    
    const avgRating = count > 0 ? totalRating / count : 0;
    
    await partnerRef.update({
      rating: Math.round(avgRating * 10) / 10, // Round to 1 decimal
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
```

---

## Firebase Cloud Messaging

### Push Notification Types

#### 1. Order Assigned
```json
{
  "notification": {
    "title": "New Order Assigned",
    "body": "Order #TK12345 - Pick up from Pizza Hub"
  },
  "data": {
    "type": "order_assigned",
    "orderId": "order_id",
    "orderNumber": "#TK12345",
    "action": "view_order"
  },
  "android": {
    "priority": "high",
    "notification": {
      "sound": "order_alert.mp3",
      "channelId": "order_alerts"
    }
  }
}
```

#### 2. Order Cancelled
```json
{
  "notification": {
    "title": "Order Cancelled",
    "body": "Order #TK12345 has been cancelled by customer"
  },
  "data": {
    "type": "order_cancelled",
    "orderId": "order_id",
    "action": "refresh"
  }
}
```

#### 3. Payment Received
```json
{
  "notification": {
    "title": "Payment Received",
    "body": "₹40 credited for order #TK12345"
  },
  "data": {
    "type": "payment_received",
    "amount": "40",
    "orderId": "order_id",
    "action": "view_earnings"
  }
}
```

#### 4. Account Update
```json
{
  "notification": {
    "title": "Account Approved",
    "body": "Your delivery partner account has been approved. Start earning now!"
  },
  "data": {
    "type": "account_update",
    "action": "refresh_profile"
  }
}
```

### Notification Channels (Android)
```dart
// To be implemented in Flutter app
const orderAlertsChannel = AndroidNotificationChannel(
  'order_alerts',
  'Order Alerts',
  description: 'Notifications for new order assignments',
  importance: Importance.high,
  playSound: true,
  sound: RawResourceAndroidNotificationSound('order_alert'),
);
```

---

## Indexes

### Required Composite Indexes

#### 1. Orders by Partner and Status
```
Collection: orders
Fields: deliveryPartnerId (Ascending), status (Ascending), createdAt (Descending)
```

#### 2. Orders by City (for assignment)
```
Collection: orders
Fields: restaurantCity (Ascending), status (Ascending), deliveryPartnerId (Ascending)
```

#### 3. Transactions by Partner
```
Collection: transactions
Fields: partnerId (Ascending), createdAt (Descending)
```

#### 4. Notifications by User
```
Collection: notifications
Fields: userId (Ascending), read (Ascending), createdAt (Descending)
```

### Index Creation Commands
```bash
# Using Firebase CLI
firebase firestore:indexes > firestore.indexes.json

# Then add to firestore.indexes.json:
{
  "indexes": [
    {
      "collectionGroup": "orders",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "deliveryPartnerId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "orders",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "restaurantCity", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "deliveryPartnerId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "transactions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "partnerId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "notifications",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "read", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}

# Deploy indexes
firebase deploy --only firestore:indexes
```

---

## API Integration Requirements

### 1. Google Maps APIs
**Required APIs**:
- Maps SDK for Android
- Directions API
- Distance Matrix API
- Geocoding API
- Places API

**Configuration**:
```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<meta-data
    android:name="com.google.android.geo.API_KEY"
    android:value="YOUR_GOOGLE_MAPS_API_KEY"/>
```

**Usage**:
- Display route from partner → restaurant → customer
- Calculate ETA for deliveries
- Reverse geocoding for addresses
- Location autocomplete

### 2. IFSC Verification API
**Endpoint**: `https://ifsc.razorpay.com/{ifsc}`  
**Purpose**: Verify bank IFSC codes during onboarding  
**Authentication**: None (public API)

### 3. SMS Gateway (for OTP)
**Provider**: Firebase Authentication (built-in)  
**Backup**: Twilio or MSG91  
**Rate Limiting**: 5 OTPs per hour per phone number

### 4. Payment Gateway (for Payouts)
**Recommended**: Razorpay Payouts  
**Features Needed**:
- Bank account transfer
- UPI transfer
- Transaction status webhooks
- Balance checks

**Integration**:
```javascript
// In Cloud Function
const razorpay = new Razorpay({
  key_id: functions.config().razorpay.key,
  key_secret: functions.config().razorpay.secret
});

const payout = await razorpay.payouts.create({
  account_number: 'partner_account',
  amount: amount * 100, // paise
  currency: 'INR',
  mode: 'UPI',
  purpose: 'payout',
  fund_account_id: 'fa_xxx',
  queue_if_low_balance: true
});
```

---

## Real-time Updates

### Real-time Listeners (StreamBuilders in Flutter)

#### 1. Active Order Listener
```dart
Stream<List<DeliveryOrder>> watchActiveOrders(String partnerId) {
  return FirebaseFirestore.instance
    .collection('orders')
    .where('deliveryPartnerId', isEqualTo: partnerId)
    .where('status', whereIn: ['accepted', 'preparing', 'ready', 'picked'])
    .where('partnerAccepted', isEqualTo: true)
    .orderBy('createdAt', descending: true)
    .snapshots()
    .map((snapshot) => snapshot.docs
      .map((doc) => DeliveryOrder.fromDoc(doc))
      .toList());
}
```

#### 2. Incoming Order Listener
```dart
Stream<List<DeliveryOrder>> watchIncomingOrders(String partnerId, String city) {
  return FirebaseFirestore.instance
    .collection('orders')
    .where('deliveryPartnerId', isEqualTo: partnerId)
    .where('partnerAccepted', isEqualTo: false)
    .where('status', whereIn: ['accepted', 'preparing', 'ready'])
    .snapshots()
    .map((snapshot) => snapshot.docs
      .map((doc) => DeliveryOrder.fromDoc(doc))
      .toList());
}
```

#### 3. Partner Profile Listener
```dart
Stream<DeliveryPartner> watchPartnerProfile(String partnerId) {
  return FirebaseFirestore.instance
    .collection('deliveryPartners')
    .doc(partnerId)
    .snapshots()
    .map((doc) => DeliveryPartner.fromMap(doc.id, doc.data()!));
}
```

#### 4. Earnings/Transactions Listener
```dart
Stream<List<PartnerTransaction>> watchTransactions(String partnerId) {
  return FirebaseFirestore.instance
    .collection('transactions')
    .where('partnerId', isEqualTo: partnerId)
    .orderBy('createdAt', descending: true)
    .limit(50)
    .snapshots()
    .map((snapshot) => snapshot.docs
      .map((doc) => PartnerTransaction.fromDoc(doc))
      .toList());
}
```

#### 5. Notifications Listener
```dart
Stream<List<AppNotification>> watchNotifications(String partnerId) {
  return FirebaseFirestore.instance
    .collection('notifications')
    .where('userId', isEqualTo: partnerId)
    .where('userType', isEqualTo: 'delivery_partner')
    .orderBy('createdAt', descending: true)
    .limit(20)
    .snapshots()
    .map((snapshot) => snapshot.docs
      .map((doc) => AppNotification.fromDoc(doc))
      .toList());
}
```

### Location Updates
**Frequency**: Every 30 seconds during active delivery  
**Implementation**:
```dart
// Background location tracking
Timer.periodic(Duration(seconds: 30), (timer) async {
  if (hasActiveOrder) {
    final position = await Geolocator.getCurrentPosition();
    
    // Update current location in partner document
    await FirebaseFirestore.instance
      .collection('deliveryPartners')
      .doc(partnerId)
      .update({
        'currentLat': position.latitude,
        'currentLng': position.longitude,
        'lastLocationUpdate': FieldValue.serverTimestamp()
      });
    
    // Store location history
    await FirebaseFirestore.instance
      .collection('deliveryPartners')
      .doc(partnerId)
      .collection('locations')
      .add({
        'lat': position.latitude,
        'lng': position.longitude,
        'accuracy': position.accuracy,
        'orderId': activeOrderId,
        'timestamp': FieldValue.serverTimestamp()
      });
  }
});
```

---

## Data Synchronization

### Offline Support Strategy

#### 1. Firestore Offline Persistence
```dart
// Enable in main.dart
await FirebaseFirestore.instance.settings = Settings(
  persistenceEnabled: true,
  cacheSizeBytes: Settings.CACHE_SIZE_UNLIMITED,
);
```

#### 2. Critical Data to Cache
- Assigned orders (status: picked)
- Partner profile data
- Recent earnings (last 7 days)
- Platform settings

#### 3. Sync Behavior
- **On Connect**: Firestore automatically syncs pending writes
- **On Disconnect**: Show offline indicator, allow viewing cached data
- **Write Operations**: Queue locally, sync when online

#### 4. Conflict Resolution
- Use `FieldValue.serverTimestamp()` for all timestamp fields
- Last-write-wins for status updates
- Admin writes always take precedence

---

## Performance & Scalability

### Performance Targets
- **Cold Start**: < 3 seconds
- **Order List Load**: < 1 second
- **Real-time Update Latency**: < 500ms
- **Location Update**: < 2 seconds
- **Image Upload**: < 5 seconds for 2MB image

### Optimization Strategies

#### 1. Firestore Optimization
- Use `.limit()` on all queries
- Implement pagination for history
- Use compound indexes for complex queries
- Denormalize frequently accessed data (e.g., restaurant name in order)

#### 2. Storage Optimization
- Compress images before upload (max 1MB)
- Use thumbnails for profile pictures
- Lazy-load images in lists

#### 3. Function Optimization
- Use batched writes where possible
- Implement retry logic with exponential backoff
- Set appropriate timeout values
- Use Cloud Pub/Sub for async processing

#### 4. App-level Optimization
- Implement local caching with Hive/SharedPreferences
- Use `StreamBuilder` judiciously
- Dispose listeners properly
- Implement pull-to-refresh

### Scalability Considerations

#### Current Scale Estimate
- **Delivery Partners**: 500-1000
- **Orders per Day**: 5000-10000
- **Concurrent Active Orders**: 200-500
- **Peak Time**: 12 PM - 2 PM, 7 PM - 10 PM

#### Scale Targets (Next 12 Months)
- **Delivery Partners**: 5000+
- **Orders per Day**: 50000+
- **Concurrent Active Orders**: 2000+

#### Scalability Actions
1. **Firestore**: Auto-scales, but monitor read/write costs
2. **Cloud Functions**: Use 2nd gen functions with more memory
3. **Storage**: CDN for frequently accessed images
4. **FCM**: Batch notifications (max 500 tokens per call)
5. **Location Updates**: Consider Firebase Realtime Database for high-frequency updates

---

## Monitoring & Analytics

### Firebase Console Monitoring

#### 1. Authentication Metrics
- Daily active users (DAU)
- Sign-up rate
- Failed authentication attempts

#### 2. Firestore Metrics
- Document reads/writes per day
- Query performance (slow queries)
- Storage usage

#### 3. Cloud Functions Metrics
- Execution count
- Error rate
- Execution duration
- Cold start frequency

#### 4. Storage Metrics
- Total storage used
- Bandwidth (download/upload)
- File count

### Custom Analytics Events

```dart
// Track key partner actions
FirebaseAnalytics.instance.logEvent(
  name: 'order_accepted',
  parameters: {
    'order_id': orderId,
    'partner_id': partnerId,
    'response_time_seconds': responseTime,
  },
);

// Key events to track:
// - order_accepted
// - order_picked
// - order_delivered
// - earnings_withdrawn
// - slot_booked
// - location_permission_granted/denied
// - onboarding_completed
// - document_uploaded
```

### Crashlytics Integration
```dart
// Report non-fatal errors
FirebaseCrashlytics.instance.recordError(
  error,
  stackTrace,
  reason: 'Failed to update order status',
);

// Set user identifier
FirebaseCrashlytics.instance.setUserIdentifier(partnerId);

// Log custom keys
FirebaseCrashlytics.instance.setCustomKey('order_id', orderId);
```

### Performance Monitoring
```dart
// Trace critical operations
final trace = FirebasePerformance.instance.newTrace('order_acceptance_flow');
await trace.start();
// ... perform order acceptance
await trace.stop();

// Monitor network requests (automatic with Firebase Performance)
```

### Alerts & Notifications (for Admin)
Set up Firebase Alerts for:
1. High error rate in Cloud Functions
2. Spike in authentication failures
3. Unusual increase in Firestore reads/writes
4. Storage quota approaching limit
5. High Cloud Function execution time

---

## Additional Requirements

### 1. Data Retention Policy
- **Active Orders**: Indefinite
- **Delivered/Cancelled Orders**: 2 years
- **Transactions**: 7 years (for compliance)
- **Location History**: 90 days
- **Notifications**: 30 days (auto-delete after)
- **Documents (KYC)**: Indefinite (for compliance)

### 2. Backup & Recovery
- **Firestore**: Daily automated backups via Firebase
- **Storage**: Geo-redundant storage enabled
- **Recovery Time Objective (RTO)**: 4 hours
- **Recovery Point Objective (RPO)**: 24 hours

### 3. Compliance & Legal
- **GDPR**: Right to be forgotten (implement data deletion)
- **Data Localization**: Store data in Asia-South (if required)
- **PCI-DSS**: Not applicable (no card data storage)
- **KYC**: Store encrypted Aadhar/PAN (hash or tokenize)

### 4. Testing Strategy
- **Unit Tests**: Service layer functions
- **Integration Tests**: Cloud Functions with emulator
- **E2E Tests**: Critical flows (order acceptance, delivery)
- **Load Tests**: Simulate 1000 concurrent partners

### 5. Migration & Deployment
- **Environment**: Single production Firebase project
- **Staging**: Use separate Firebase project for testing
- **Deployment**: Use Firebase CLI with CI/CD (GitHub Actions)
- **Rollback**: Version Cloud Functions, rollback via CLI

---

## Implementation Checklist

### Phase 1: Foundation (Week 1-2)
- [ ] Firebase project setup confirmation
- [ ] Security rules implementation
- [ ] Basic authentication flow
- [ ] Partner profile CRUD
- [ ] Firestore indexes creation

### Phase 2: Core Features (Week 3-4)
- [ ] Order assignment logic (Cloud Functions)
- [ ] Real-time order listeners
- [ ] Order status update flow
- [ ] Location tracking implementation
- [ ] Push notifications setup

### Phase 3: Onboarding (Week 5-6)
- [ ] Document upload to Storage
- [ ] IFSC verification function
- [ ] Training modules
- [ ] Approval workflow
- [ ] Slot booking system

### Phase 4: Earnings (Week 7-8)
- [ ] Transaction creation on delivery
- [ ] Earnings dashboard queries
- [ ] Withdrawal function
- [ ] Payment gateway integration
- [ ] Transaction history

### Phase 5: Polish (Week 9-10)
- [ ] Analytics events
- [ ] Crashlytics integration
- [ ] Performance monitoring
- [ ] Offline support testing
- [ ] Load testing

### Phase 6: Launch Prep (Week 11-12)
- [ ] Security audit
- [ ] Performance optimization
- [ ] Admin dashboard verification
- [ ] User acceptance testing
- [ ] Production deployment

---

## Support & Maintenance

### Monitoring Dashboard
Create custom dashboard in Firebase Console:
1. **Partner Activity**: Active partners, online status
2. **Order Flow**: Orders assigned, picked, delivered per hour
3. **Errors**: Function errors, authentication failures
4. **Performance**: API response times, query latencies

### Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Partner can't sign in | Phone number not in E.164 format | Ensure +country_code prefix |
| Order not appearing | Missing Firestore index | Create required composite index |
| Location not updating | Permission denied | Request location permission on app start |
| Notification not received | FCM token not saved | Save token on login |
| Withdrawal failing | Insufficient balance | Check pocketBalance before initiating |

### Emergency Contacts
- **Firebase Support**: https://firebase.google.com/support
- **Google Maps Support**: https://developers.google.com/maps/support
- **Razorpay Support**: https://razorpay.com/support

---

## Appendix

### A. Environment Variables (Cloud Functions)
```bash
# Set using Firebase CLI
firebase functions:config:set \
  razorpay.key="rzp_live_xxx" \
  razorpay.secret="xxx" \
  maps.api_key="AIza..." \
  sms.api_key="xxx" \
  admin.email="admin@tastykart.com"

# Get config
firebase functions:config:get
```

### B. Useful Firebase CLI Commands
```bash
# Deploy everything
firebase deploy

# Deploy specific function
firebase deploy --only functions:assignDeliveryPartner

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Storage rules
firebase deploy --only storage

# Test functions locally
firebase emulators:start

# View logs
firebase functions:log --only assignDeliveryPartner
```

### C. Collection Path Reference
```
firestore/
├── deliveryPartners/{partnerId}
│   ├── slots/{date}
│   └── locations/{locationId}
├── orders/{orderId}
├── transactions/{txnId}
├── notifications/{notifId}
├── settings/admin
├── banners/{bannerId}
├── users/{userId} (Customer app)
├── restaurants/{restaurantId} (Admin app)
└── admins/{adminId} (Admin app)
```

---

**Document Status**: Draft v1.0  
**Last Updated**: September 11, 2026  
**Review Required By**: Admin Team, Backend Team  
**Approval Status**: Pending

---

## Questions & Clarifications

If you have questions about this requirements document, please contact:
- **Technical Lead**: [Name/Email]
- **Product Manager**: [Name/Email]
- **DevOps**: [Name/Email]
