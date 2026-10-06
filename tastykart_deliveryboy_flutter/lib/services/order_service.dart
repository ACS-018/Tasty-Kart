import 'dart:math';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';

import '../constants/delivery_stage.dart';
import '../models/delivery_order.dart';
import 'analytics_service.dart';
import 'crashlytics_service.dart';
import 'firestore_paths.dart';
import 'performance_service.dart';

class RestaurantContact {
  const RestaurantContact({
    this.name = '',
    this.phone = '',
    this.address = '',
    this.lat,
    this.lng,
  });

  final String name;
  final String phone;
  final String address;
  final double? lat;
  final double? lng;
}

/// Enhanced Order Service with real-time streams, analytics, and error handling
class OrderService {
  OrderService._();

  static final FirebaseFirestore _db = FirebaseFirestore.instance;

  static CollectionReference<Map<String, dynamic>> get _orders =>
      _db.collection(FirestorePaths.orders);

  // ============ Real-time Streams ============

  /// Watch all orders for a partner
  static Stream<List<DeliveryOrder>> watchForPartner(String partnerId) {
    return _orders
        .where('deliveryPartnerId', isEqualTo: partnerId)
        .snapshots()
        .map((snap) => snap.docs.map(DeliveryOrder.fromDoc).toList());
  }

  /// Watch active orders only (not delivered or cancelled)
  static Stream<List<DeliveryOrder>> watchActiveOrders(String partnerId) {
    return _orders
        .where('deliveryPartnerId', isEqualTo: partnerId)
        .where('partnerAccepted', isEqualTo: true)
        .where('status', whereIn: ['accepted', 'preparing', 'ready', 'picked'])
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snap) => snap.docs.map(DeliveryOrder.fromDoc).toList());
  }

  /// Watch incoming order assignments (not yet accepted)
  static Stream<List<DeliveryOrder>> watchIncomingOrders(String partnerId) {
    return _orders
        .where('deliveryPartnerId', isEqualTo: partnerId)
        .where('partnerAccepted', isEqualTo: false)
        .where('status', whereIn: ['accepted', 'preparing', 'ready'])
        .snapshots()
        .map((snap) => snap.docs.map(DeliveryOrder.fromDoc).toList());
  }

  /// Watch history (delivered and cancelled orders)
  static Stream<List<DeliveryOrder>> watchHistoryForPartner(String partnerId) {
    return Stream<List<DeliveryOrder>>.multi((controller) {
      var assigned = <DeliveryOrder>[];
      var denied = <DeliveryOrder>[];
      var assignedReady = false;
      var deniedReady = false;

      void emit() {
        if (!assignedReady || !deniedReady) return;
        final map = <String, DeliveryOrder>{};
        for (final order in assigned) {
          map[order.id] = order;
        }
        for (final order in denied) {
          map.putIfAbsent(order.id, () => order);
        }
        controller.add(map.values.toList());
      }

      final assignedSub = watchForPartner(partnerId).listen((value) {
        assigned = value;
        assignedReady = true;
        emit();
      }, onError: controller.addError);

      final deniedSub = _orders
          .where('deniedPartnerId', isEqualTo: partnerId)
          .snapshots()
          .listen(
            (snap) {
              denied = snap.docs.map(DeliveryOrder.fromDoc).toList();
              deniedReady = true;
              emit();
            },
            onError: (_, __) {
              denied = const [];
              deniedReady = true;
              emit();
            },
          );

      controller.onCancel = () async {
        await assignedSub.cancel();
        await deniedSub.cancel();
      };
    });
  }

  /// Watch specific order by ID
  static Stream<DeliveryOrder?> watchById(String orderId) {
    return _orders.doc(orderId).snapshots().map((doc) {
      if (!doc.exists) return null;
      return DeliveryOrder.fromDoc(doc);
    });
  }

  // ============ Query Helpers ============

  /// Get today's delivered orders. Uses the delivery time, then the order time.
  static List<DeliveryOrder> deliveredToday(List<DeliveryOrder> orders) {
    final start = DateTime(
      DateTime.now().year,
      DateTime.now().month,
      DateTime.now().day,
    );
    return orders.where((order) {
      if (!order.isDelivered) return false;
      final time = order.deliveredAt ?? order.createdAt;
      if (time == null) return false;
      return !time.isBefore(start);
    }).toList();
  }

  /// Get this week's delivered orders (Mon–Sun).
  static List<DeliveryOrder> deliveredThisWeek(List<DeliveryOrder> orders) {
    final now = DateTime.now();
    final start = DateTime(
      now.year,
      now.month,
      now.day,
    ).subtract(Duration(days: now.weekday - 1));
    return orders.where((order) {
      if (!order.isDelivered) return false;
      final created = order.createdAt;
      if (created == null) return false;
      return !created.isBefore(start);
    }).toList();
  }

  /// Find first incoming order that this [partnerId] is eligible to accept.
  /// Excludes any order the partner previously transferred or rejected.
  static DeliveryOrder? incomingFor(
    List<DeliveryOrder> orders, {
    String partnerId = '',
  }) {
    for (final order in orders) {
      if (partnerId.isNotEmpty
          ? order.isIncomingFor(partnerId)
          : order.isIncoming) {
        return order;
      }
    }
    return null;
  }

  /// Find active trip
  static DeliveryOrder? activeTripFor(List<DeliveryOrder> orders) {
    for (final order in orders) {
      if (order.isActiveTrip) return order;
    }
    return null;
  }

  /// Get orders by date range
  static Future<List<DeliveryOrder>> getOrdersByDateRange({
    required String partnerId,
    required DateTime startDate,
    required DateTime endDate,
  }) async {
    try {
      final snapshot = await _orders
          .where('deliveryPartnerId', isEqualTo: partnerId)
          .where(
            'createdAt',
            isGreaterThanOrEqualTo: Timestamp.fromDate(startDate),
          )
          .where('createdAt', isLessThanOrEqualTo: Timestamp.fromDate(endDate))
          .orderBy('createdAt', descending: true)
          .get();

      return snapshot.docs.map((doc) => DeliveryOrder.fromDoc(doc)).toList();
    } catch (e) {
      debugPrint('Error getting orders by date range: $e');
      return [];
    }
  }

  // ============ Order Actions with Analytics ============

  /// Accept order assignment
  /// Accept an order assignment — marks the partner as actively working
  /// the order and transitions the order status to 'accepted'.
  static Future<void> accept({
    required DeliveryOrder order,
    required String partnerId,
    required String partnerName,
  }) async {
    final startTime = DateTime.now();

    try {
      await PerformanceService.traceOrderAcceptance(
        orderId: order.id,
        operation: () async {
          await _orders.doc(order.id).set({
            'deliveryPartnerId': partnerId,
            'deliveryPartnerName': partnerName,
            'partnerAccepted': true,
            'status': 'accepted',
            'deliveryStage': DeliveryStage.toRestaurant,
            'pickupCode': _pickupCodeFor(order),
            'updatedAt': FieldValue.serverTimestamp(),
          }, SetOptions(merge: true));
        },
      );

      // Track analytics
      final responseTime = DateTime.now().difference(startTime).inSeconds;
      await AnalyticsService.logOrderAccepted(
        orderId: order.id,
        orderNumber: order.orderNumber,
        partnerId: partnerId,
        responseTimeSeconds: responseTime,
      );
    } catch (e, stackTrace) {
      debugPrint('Error accepting order: $e');

      await CrashlyticsService.recordOrderAcceptanceError(
        orderId: order.id,
        partnerId: partnerId,
        error: e,
        stackTrace: stackTrace,
      );

      rethrow;
    }
  }

  /// Reject/deny order assignment — clears the partner assignment so the
  /// admin's auto-assign logic can reassign to the next available partner.
  static Future<void> reject({
    required DeliveryOrder order,
    required String partnerId,
    required String reason,
  }) async {
    try {
      // Clear order assignment and reset to pending
      await _orders.doc(order.id).set({
        // Clear the assignment so the order is free to be reassigned.
        'deliveryPartnerId': '',
        'deliveryPartnerName': '',
        'partnerAccepted': false,
        'deliveryStage': FieldValue.delete(),
        // Reset status to pending so auto-assignment can pick it up
        'status': 'pending',
        // Track all rejecting partners so they are excluded from reassignment.
        'deniedPartnerId': partnerId,
        'deniedPartnerIds': FieldValue.arrayUnion([partnerId]),
        'deniedAt': FieldValue.serverTimestamp(),
        'cancelReason': reason,
        // Signal to admin/cloud function that this order needs a new partner.
        'needsReassignment': true,
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));

      // Reset partner status back to online so they can receive new orders
      await FirebaseFirestore.instance
          .collection('deliveryPartners')
          .doc(partnerId)
          .set({
            'status': 'online',
            'currentOrder': FieldValue.delete(),
            'updatedAt': FieldValue.serverTimestamp(),
          }, SetOptions(merge: true));

      // Track analytics
      await AnalyticsService.logOrderDenied(
        orderId: order.id,
        orderNumber: order.orderNumber,
        partnerId: partnerId,
        reason: reason,
      );
    } catch (e, stackTrace) {
      debugPrint('Error rejecting order: $e');

      await CrashlyticsService.recordError(
        exception: e,
        stackTrace: stackTrace,
        reason: 'Failed to reject order ${order.id}',
      );

      rethrow;
    }
  }

  /// Mark arrived at restaurant — transitions order status to 'preparing'
  /// so the admin filter tab shows it correctly.
  static Future<void> arriveAtRestaurant(DeliveryOrder order) async {
    try {
      await _orders.doc(order.id).set({
        'status': 'preparing',
        'deliveryStage': DeliveryStage.preparing,
        'partnerArrivedRestaurant': true,
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
    } catch (e) {
      debugPrint('Error marking arrival at restaurant: $e');
      rethrow;
    }
  }

  /// Start pickup process
  static Future<void> startPickup(DeliveryOrder order) async {
    try {
      await _orders.doc(order.id).set({
        'deliveryStage': DeliveryStage.pickup,
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
    } catch (e) {
      debugPrint('Error starting pickup: $e');
      rethrow;
    }
  }

  /// Confirm order pickup
  static Future<void> confirmPickup({
    required DeliveryOrder order,
    required String partnerId,
  }) async {
    try {
      final trace = await PerformanceService.traceOrderPickupFlow();

      try {
        await _orders.doc(order.id).set({
          'status': 'picked',
          'deliveryStage': DeliveryStage.toCustomer,
          'pickedAt': FieldValue.serverTimestamp(),
          'updatedAt': FieldValue.serverTimestamp(),
          'timeline': FieldValue.arrayUnion([
            {'status': 'picked', 'time': Timestamp.now()},
          ]),
        }, SetOptions(merge: true));
      } finally {
        await PerformanceService.stopTrace(trace);
      }

      // Track analytics
      await AnalyticsService.logOrderPicked(
        orderId: order.id,
        orderNumber: order.orderNumber,
        partnerId: partnerId,
      );
    } catch (e, stackTrace) {
      debugPrint('Error confirming pickup: $e');

      await CrashlyticsService.recordOrderPickupError(
        orderId: order.id,
        partnerId: partnerId,
        error: e,
        stackTrace: stackTrace,
      );

      rethrow;
    }
  }

  /// Mark arrived at customer location
  static Future<void> arriveAtCustomer(DeliveryOrder order) async {
    try {
      await _orders.doc(order.id).set({
        'deliveryStage': DeliveryStage.arrivedCustomer,
        'partnerArrivedCustomer': true,
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
    } catch (e) {
      debugPrint('Error marking arrival at customer: $e');
      rethrow;
    }
  }

  /// Resume navigation to customer
  static Future<void> resumeCustomerNav(DeliveryOrder order) async {
    try {
      await _orders.doc(order.id).set({
        'deliveryStage': DeliveryStage.toCustomer,
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
    } catch (e) {
      debugPrint('Error resuming customer navigation: $e');
      rethrow;
    }
  }

  /// Complete delivery
  static Future<void> completeDelivery({
    required DeliveryOrder order,
    required String partnerId,
    required String collectedVia,
    String? deliveryProofUrl,
  }) async {
    try {
      await PerformanceService.traceOperation(
        traceName: 'order_delivery',
        operation: (trace) async {
          final updateData = {
            'status': 'delivered',
            'deliveryStage': 'delivered',
            'collectedVia': collectedVia,
            'deliveredAt': FieldValue.serverTimestamp(),
            'updatedAt': FieldValue.serverTimestamp(),
            'timeline': FieldValue.arrayUnion([
              {'status': 'delivered', 'time': Timestamp.now()},
            ]),
          };

          if (deliveryProofUrl != null) {
            updateData['deliveryProofUrl'] = deliveryProofUrl;
          }

          await _orders.doc(order.id).set(updateData, SetOptions(merge: true));
        },
      );

      try {
        final deliveryTime = order.pickedAt != null
            ? DateTime.now().difference(order.pickedAt!).inMinutes
            : 0;
        await AnalyticsService.logOrderDelivered(
          orderId: order.id,
          orderNumber: order.orderNumber,
          partnerId: partnerId,
          deliveryTimeMinutes: deliveryTime,
          earnings: order.deliveryFee,
        );
      } catch (e) {
        debugPrint('Delivery analytics error: $e');
      }
    } catch (e, stackTrace) {
      debugPrint('Error completing delivery: $e');

      await CrashlyticsService.recordOrderDeliveryError(
        orderId: order.id,
        partnerId: partnerId,
        error: e,
        stackTrace: stackTrace,
      );

      rethrow;
    }
  }

  /// Cancel order by partner
  static Future<void> cancelByPartner({
    required DeliveryOrder order,
    required String partnerId,
    required String reason,
    required String phase,
  }) async {
    try {
      await _orders.doc(order.id).set({
        'status': 'cancelled',
        'cancelReason': reason,
        'cancelPhase': phase,
        'cancelledBy': 'delivery_partner',
        'updatedAt': FieldValue.serverTimestamp(),
        'timeline': FieldValue.arrayUnion([
          {'status': 'cancelled', 'time': Timestamp.now()},
        ]),
      }, SetOptions(merge: true));

      // Log to Crashlytics for monitoring
      await CrashlyticsService.setCustomKey('order_id', order.id);
      await CrashlyticsService.setCustomKey('cancel_reason', reason);
      CrashlyticsService.log('Partner cancelled order: ${order.id}');
    } catch (e) {
      debugPrint('Error cancelling order: $e');
      rethrow;
    }
  }

  // ============ Restaurant Info ============

  /// Get restaurant contact information
  static Future<RestaurantContact> restaurantContact(
    String restaurantId,
  ) async {
    if (restaurantId.isEmpty) return const RestaurantContact();

    try {
      final doc = await _db
          .collection(FirestorePaths.restaurants)
          .doc(restaurantId)
          .get();

      final d = doc.data() ?? {};
      return RestaurantContact(
        name: d['name']?.toString() ?? '',
        phone: d['phone']?.toString() ?? '',
        address: d['address']?.toString() ?? '',
        lat: (d['lat'] as num?)?.toDouble(),
        lng: (d['lng'] as num?)?.toDouble(),
      );
    } catch (e) {
      debugPrint('Error getting restaurant contact: $e');
      return const RestaurantContact();
    }
  }

  // ============ Helpers ============

  /// Transfer order — marks this partner as excluded and signals the Cloud
  /// Function to reassign to the next nearest available partner.
  ///
  /// Writes:
  /// - `excludedPartnerIds[]` — this partner is added; Cloud Function skips them on reassignment
  /// - `deliveryPartnerId: ''` / `deliveryPartnerName: ''` — clears the assignment
  /// - `partnerAccepted: false`
  /// - `needsReassignment: true` — triggers the Cloud Function
  /// - `transferredAt` — timestamp for audit
  static Future<void> transferOrder({
    required DeliveryOrder order,
    required String partnerId,
  }) async {
    try {
      await _orders.doc(order.id).set({
        // Clear the current assignment.
        'deliveryPartnerId': '',
        'deliveryPartnerName': '',
        'partnerAccepted': false,
        // Exclude this partner AND all previously denied partners from
        // the next assignment so the same person is never re-assigned.
        'excludedPartnerIds': FieldValue.arrayUnion([partnerId]),
        'deniedPartnerIds': FieldValue.arrayUnion([partnerId]),
        // Tell the Cloud Function to kick off reassignment.
        'needsReassignment': true,
        'transferredAt': FieldValue.serverTimestamp(),
        'transferredByPartnerId': partnerId,
        'updatedAt': FieldValue.serverTimestamp(),
        'timeline': FieldValue.arrayUnion([
          {
            'status': 'transfer_requested',
            'time': Timestamp.now(),
            'partnerId': partnerId,
          },
        ]),
      }, SetOptions(merge: true));
    } catch (e) {
      debugPrint('Error transferring order: $e');
      rethrow;
    }
  }

  /// Generate pickup code
  static String _pickupCodeFor(DeliveryOrder order) {
    if (order.pickupCode.length == 4) return order.pickupCode;
    final digits = order.orderNumber.replaceAll(RegExp(r'\D'), '');
    if (digits.length >= 4) return digits.substring(digits.length - 4);
    return (1000 + Random().nextInt(9000)).toString();
  }

  // ============ Customer Notifications ============

  /// Writes a notification document to `notifications/{auto-id}` targeting the
  /// customer (`userType: 'customer'`).  The user-app's Cloud Function (or its
  /// own Firestore listener) reads this doc and sends the FCM push.
  ///
  /// [type] values used here:
  ///   - `'order_delayed'`   — restaurant taking longer than expected
  ///   - `'order_transferred'` — partner could not pick up; reassigning
  static Future<void> notifyCustomer({
    required DeliveryOrder order,
    required String type,
    required String title,
    required String message,
  }) async {
    if (order.customerId.isEmpty) return;
    try {
      await _db.collection(FirestorePaths.notifications).add({
        'userId': order.customerId,
        'userType': 'customer',
        'type': type,
        'title': title,
        'message': message,
        'orderId': order.id,
        'orderNumber': order.displayOrderNumber,
        'data': {
          'orderId': order.id,
          'orderNumber': order.displayOrderNumber,
          'action': 'view_order',
        },
        'read': false,
        'priority': 'high',
        'createdAt': FieldValue.serverTimestamp(),
        // Expire after 24 h so stale notifications don't clutter the inbox.
        'expiresAt': Timestamp.fromDate(
          DateTime.now().add(const Duration(hours: 24)),
        ),
      });
    } catch (e) {
      // Non-critical — log but don't surface to the partner.
      debugPrint('[OrderService] notifyCustomer error: $e');
    }
  }
}
