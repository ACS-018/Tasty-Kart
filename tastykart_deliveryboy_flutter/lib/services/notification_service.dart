import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';

import '../constants/delivery_stage.dart';
import '../models/app_notification.dart';
import '../models/delivery_order.dart';
import 'firestore_paths.dart';

/// Service for managing in-app notifications
class NotificationService {
  NotificationService._();

  static final FirebaseFirestore _db = FirebaseFirestore.instance;

  /// Get notifications collection reference
  static CollectionReference get _notificationsCollection =>
      _db.collection(FirestorePaths.notifications);

  // ============ Real-time Streams ============

  /// Watch notifications stream for a partner (from Firestore)
  static Stream<List<AppNotification>> watchNotifications(String partnerId) {
    return _notificationsCollection
        .where('userId', isEqualTo: partnerId)
        .where('userType', isEqualTo: 'delivery_partner')
        .orderBy('createdAt', descending: true)
        .limit(50)
        .snapshots()
        .map((snapshot) {
          return snapshot.docs
              .map((doc) => AppNotification.fromDoc(doc))
              .where((notif) => !notif.isExpired)
              .toList();
        });
  }

  /// Watch unread notifications count
  static Stream<int> watchUnreadCount(String partnerId) {
    return _notificationsCollection
        .where('userId', isEqualTo: partnerId)
        .where('userType', isEqualTo: 'delivery_partner')
        .where('read', isEqualTo: false)
        .snapshots()
        .map((snapshot) {
          return snapshot.docs
              .map((doc) => AppNotification.fromDoc(doc))
              .where((notif) => !notif.isExpired)
              .length;
        });
  }

  /// Watch inbox for a partner.
  ///
  /// [registeredAt] — when provided, only notifications created on or after
  /// this date are fetched from Firestore.  This prevents new partners from
  /// ever downloading broadcast notifications that predate their registration.
  static Stream<List<AppNotification>> watchInbox({DateTime? registeredAt}) {
    var query = _db
        .collection(FirestorePaths.notifications)
        .orderBy('createdAt', descending: true)
        .limit(60);

    if (registeredAt != null) {
      query = query.where(
        'createdAt',
        isGreaterThanOrEqualTo: Timestamp.fromDate(registeredAt),
      );
    }

    return query.snapshots().map(
      (snap) => snap.docs
          .map(AppNotification.fromDoc)
          .where((n) => n.title.isNotEmpty)
          .toList(),
    );
  }

  // ============ Fetch Operations ============

  /// Get notifications (one-time fetch)
  static Future<List<AppNotification>> getNotifications(
    String partnerId, {
    int limit = 50,
    bool unreadOnly = false,
  }) async {
    try {
      var query = _notificationsCollection
          .where('userId', isEqualTo: partnerId)
          .where('userType', isEqualTo: 'delivery_partner')
          .orderBy('createdAt', descending: true)
          .limit(limit);

      if (unreadOnly) {
        query = query.where('read', isEqualTo: false);
      }

      final snapshot = await query.get();
      return snapshot.docs
          .map((doc) => AppNotification.fromDoc(doc))
          .where((notif) => !notif.isExpired)
          .toList();
    } catch (e) {
      debugPrint('Error getting notifications: $e');
      return [];
    }
  }

  // ============ Update Operations ============

  /// Mark notification as read
  static Future<void> markAsRead(String notificationId) async {
    try {
      await _notificationsCollection.doc(notificationId).update({'read': true});
      debugPrint('Notification marked as read: $notificationId');
    } catch (e) {
      debugPrint('Error marking notification as read: $e');
    }
  }

  /// Mark all notifications as read
  static Future<void> markAllAsRead(String partnerId) async {
    try {
      final snapshot = await _notificationsCollection
          .where('userId', isEqualTo: partnerId)
          .where('userType', isEqualTo: 'delivery_partner')
          .where('read', isEqualTo: false)
          .get();

      if (snapshot.docs.isEmpty) {
        debugPrint('No unread notifications to mark');
        return;
      }

      final batch = _db.batch();
      for (final doc in snapshot.docs) {
        batch.update(doc.reference, {'read': true});
      }

      await batch.commit();
      debugPrint('Marked ${snapshot.docs.length} notifications as read');
    } catch (e) {
      debugPrint('Error marking all notifications as read: $e');
    }
  }

  // ============ Delete Operations ============

  /// Delete notification
  static Future<void> deleteNotification(String notificationId) async {
    try {
      await _notificationsCollection.doc(notificationId).delete();
      debugPrint('Notification deleted: $notificationId');
    } catch (e) {
      debugPrint('Error deleting notification: $e');
    }
  }

  /// Delete all read notifications
  static Future<void> deleteAllRead(String partnerId) async {
    try {
      final snapshot = await _notificationsCollection
          .where('userId', isEqualTo: partnerId)
          .where('userType', isEqualTo: 'delivery_partner')
          .where('read', isEqualTo: true)
          .get();

      if (snapshot.docs.isEmpty) {
        debugPrint('No read notifications to delete');
        return;
      }

      final batch = _db.batch();
      for (final doc in snapshot.docs) {
        batch.delete(doc.reference);
      }

      await batch.commit();
      debugPrint('Deleted ${snapshot.docs.length} read notifications');
    } catch (e) {
      debugPrint('Error deleting read notifications: $e');
    }
  }

  // ============ Create Operation ============

  /// Create notification (for testing purposes - normally created by Cloud Functions)
  static Future<void> createNotification({
    required String userId,
    required String type,
    required String title,
    required String message,
    Map<String, dynamic>? data,
    String priority = 'medium',
    DateTime? expiresAt,
  }) async {
    try {
      await _notificationsCollection.add({
        'userId': userId,
        'userType': 'delivery_partner',
        'type': type,
        'title': title,
        'message': message,
        'data': data ?? {},
        'read': false,
        'priority': priority,
        'createdAt': FieldValue.serverTimestamp(),
        if (expiresAt != null) 'expiresAt': Timestamp.fromDate(expiresAt),
      });
      debugPrint('Notification created');
    } catch (e) {
      debugPrint('Error creating notification: $e');
    }
  }

  // ============ Cleanup Operations ============

  /// Clean expired notifications
  static Future<void> cleanExpiredNotifications(String partnerId) async {
    try {
      final now = Timestamp.now();

      final snapshot = await _notificationsCollection
          .where('userId', isEqualTo: partnerId)
          .where('userType', isEqualTo: 'delivery_partner')
          .where('expiresAt', isLessThan: now)
          .get();

      if (snapshot.docs.isEmpty) {
        debugPrint('No expired notifications to clean');
        return;
      }

      final batch = _db.batch();
      for (final doc in snapshot.docs) {
        batch.delete(doc.reference);
      }

      await batch.commit();
      debugPrint('Cleaned ${snapshot.docs.length} expired notifications');
    } catch (e) {
      debugPrint('Error cleaning expired notifications: $e');
    }
  }

  // ============ Legacy Methods ============

  /// Filter notifications visible for a specific partner.
  ///
  /// Pass [notificationsEnabled] = false to exclude broadcast notifications
  /// for partners who have opted out of push notifications.
  ///
  /// Pass [registeredAt] to exclude broadcast notifications that were created
  /// before this partner registered — prevents new partners from seeing old
  /// global messages that have nothing to do with them.
  static List<AppNotification> visibleForPartner({
    required String partnerId,
    required List<AppNotification> inbox,
    required List<DeliveryOrder> orders,
    bool notificationsEnabled = true,
    DateTime? registeredAt,
  }) {
    final items = <AppNotification>[
      ...inbox.where(
        (n) => _isForPartner(
          n,
          partnerId,
          notificationsEnabled: notificationsEnabled,
          registeredAt: registeredAt,
        ),
      ),
      ...fromOrders(orders),
    ];
    items.sort((a, b) {
      final at = a.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
      final bt = b.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
      return bt.compareTo(at);
    });
    if (items.length <= 40) return items;
    return items.sublist(0, 40);
  }

  static bool _isForPartner(
    AppNotification note,
    String partnerId, {
    bool notificationsEnabled = true,
    DateTime? registeredAt,
  }) {
    // Never show support-channel notifications in the partner feed.
    if (note.type == 'support') return false;

    // Broadcast notifications (userId == 'broadcast' or empty) are shown to
    // all partners — UNLESS this partner has opted out of notifications, or
    // the notification was created before this partner registered (so new
    // partners don't see stale global messages from days ago).
    final uid = note.userId.trim();
    if (uid.isEmpty || uid == 'broadcast') {
      if (!notificationsEnabled) return false;
      // Hide broadcasts that predate this partner's registration.
      if (registeredAt != null && note.createdAt != null) {
        if (note.createdAt!.isBefore(registeredAt)) return false;
      }
      return true;
    }

    // Targeted notification — only show to the addressed partner.
    return uid == partnerId;
  }

  /// Generate notifications from orders
  static List<AppNotification> fromOrders(List<DeliveryOrder> orders) {
    final items = <AppNotification>[];
    for (final order in orders) {
      final number = order.displayOrderNumber;
      final restaurant = order.restaurantName;
      final assignedAt = order.createdAt;
      if (order.partnerAccepted || order.isIncoming || order.isHistoryItem) {
        items.add(
          AppNotification(
            id: 'assigned-${order.id}',
            title: 'New Order Assigned',
            message: restaurant.isEmpty
                ? 'Order $number'
                : 'Order $number from $restaurant',
            type: 'order',
            userId: order.deliveryPartnerId,
            createdAt: assignedAt,
          ),
        );
      }
      final stage = order.resolvedStage;
      if (stage == DeliveryStage.preparing || stage == DeliveryStage.pickup) {
        items.add(
          AppNotification(
            id: 'pickup-${order.id}',
            title: 'Pickup Reminder',
            message: restaurant.isEmpty
                ? 'Order $number is ready for pickup'
                : '$restaurant Order $number',
            type: 'order',
            userId: order.deliveryPartnerId,
            createdAt:
                assignedAt?.add(const Duration(minutes: 2)) ?? DateTime.now(),
          ),
        );
      }
      if (order.pickedAt != null ||
          order.statusValue == 'picked' ||
          stage == DeliveryStage.toCustomer ||
          stage == DeliveryStage.arrivedCustomer ||
          order.isDelivered) {
        items.add(
          AppNotification(
            id: 'picked-${order.id}',
            title: 'Order Picked Up',
            message: order.isDelivered
                ? 'Your order $number is delivered'
                : 'Order $number is on the way',
            type: 'order',
            userId: order.deliveryPartnerId,
            createdAt: order.pickedAt ?? assignedAt,
          ),
        );
      }
    }
    return items;
  }
}
