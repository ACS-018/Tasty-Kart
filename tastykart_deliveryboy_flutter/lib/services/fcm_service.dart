import 'dart:async';
import 'dart:convert';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../main.dart';
import '../utils/app_navigation.dart';
import 'firestore_paths.dart';

/// FCM service for handling push notifications
class FCMService {
  FCMService._();

  static final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  static StreamSubscription<RemoteMessage>? _foregroundSubscription;
  static StreamSubscription<RemoteMessage>? _onMessageOpenedAppSubscription;

  // Cached preference — updated by setNotificationsEnabled() so the foreground
  // handler can gate local notifications without an extra Firestore read.
  static bool _notificationsEnabled = true;

  /// Notification channels for Android
  static const AndroidNotificationChannel _orderAlertsChannel =
      AndroidNotificationChannel(
        'order_alerts',
        'Order Alerts',
        description: 'Notifications for new order assignments',
        importance: Importance.high,
        playSound: true,
        enableVibration: true,
      );

  static const AndroidNotificationChannel _generalChannel =
      AndroidNotificationChannel(
        'general',
        'General Notifications',
        description: 'General app notifications',
        importance: Importance.defaultImportance,
      );

  static const _prefKey = 'notifications_enabled';

  /// Initialize FCM service
  static Future<void> initialize() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _notificationsEnabled = prefs.getBool(_prefKey) ?? true;

      // Create notification channels for Android
      await flutterLocalNotificationsPlugin
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >()
          ?.createNotificationChannel(_orderAlertsChannel);

      await flutterLocalNotificationsPlugin
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >()
          ?.createNotificationChannel(_generalChannel);

      if (!_notificationsEnabled) {
        await _messaging.setAutoInitEnabled(false);
      } else {
        final token = await getToken();
        if (token != null) {
          debugPrint('FCM Token: $token');
        }
      }

      // Listen to token refresh — always update Firestore so the token stays
      // current even when notifications are toggled off. The notificationsEnabled
      // flag controls send-gating, not token storage.
      _messaging.onTokenRefresh.listen((newToken) async {
        debugPrint('FCM Token refreshed: $newToken');
        _saveTokenToFirestore(newToken);
      });

      // Handle foreground messages
      _foregroundSubscription = FirebaseMessaging.onMessage.listen(
        _handleForegroundMessage,
      );

      // Handle notification taps when app is in background/terminated
      _onMessageOpenedAppSubscription = FirebaseMessaging.onMessageOpenedApp
          .listen(_handleNotificationTap);

      // Check for initial message (app opened from terminated state)
      final initialMessage = await _messaging.getInitialMessage();
      if (initialMessage != null) {
        _handleNotificationTap(initialMessage);
      }

      debugPrint('FCM Service initialized successfully');
    } catch (e) {
      debugPrint('Error initializing FCM: $e');
    }
  }

  /// Get FCM token
  static Future<String?> getToken() async {
    try {
      final token = await _messaging.getToken();
      if (token != null) {
        await _saveTokenLocally(token);
      }
      return token;
    } catch (e) {
      debugPrint('Error getting FCM token: $e');
      return null;
    }
  }

  /// Save FCM token to Firestore (always, regardless of notification toggle).
  /// The notificationsEnabled boolean in Firestore controls whether broadcasts
  /// are sent — the token itself is always kept current.
  static Future<void> saveTokenToFirestore(String partnerId) async {
    final token = await getToken();
    if (token != null) {
      await _saveTokenToFirestore(token, partnerId: partnerId);
    }
  }

  /// Turns delivery-partner pushes on or off for this device.
  ///
  /// The FCM token is kept in Firestore regardless of the toggle — the admin
  /// panel and Cloud Functions read `notificationsEnabled` (a boolean written
  /// by [DeliveryPartnerService.setNotificationsEnabled]) to decide whether to
  /// include this device in a broadcast. This avoids token churn and makes
  /// re-enabling instant (no need to re-register the token).
  static Future<void> syncPartnerPreference({
    required String partnerId,
    required bool enabled,
  }) async {
    _notificationsEnabled = enabled;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_prefKey, enabled);

    if (enabled) {
      // Re-enabling: make sure we have a fresh token saved.
      try {
        await _messaging.setAutoInitEnabled(true);
      } catch (e) {
        debugPrint('[FCM] setAutoInitEnabled error: $e');
      }
      final token = await getToken();
      if (token != null) {
        await _saveTokenToFirestore(token, partnerId: partnerId);
      }
    }
    // When disabling: do NOT delete the token. The notificationsEnabled flag
    // in Firestore (written by DeliveryPartnerService) is the single source of
    // truth — the Cloud Function and admin panel both check it before sending.
  }

  static Future<void> _saveTokenToFirestore(
    String token, {
    String? partnerId,
  }) async {
    try {
      String? userId = partnerId;

      // If partnerId not provided, get from shared preferences
      if (userId == null) {
        final prefs = await SharedPreferences.getInstance();
        userId = prefs.getString('partner_id');
      }

      if (userId == null) return;

      final partnerRef = FirebaseFirestore.instance
          .collection(FirestorePaths.deliveryPartners)
          .doc(userId);

      await partnerRef.update({
        'fcmTokens': FieldValue.arrayUnion([token]),
        'loggedIn': true,
        'updatedAt': FieldValue.serverTimestamp(),
      });

      debugPrint('FCM token saved to Firestore');
    } catch (e) {
      debugPrint('Error saving FCM token to Firestore: $e');
    }
  }

  /// Save token locally
  static Future<void> _saveTokenLocally(String token) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('fcm_token', token);
    } catch (e) {
      debugPrint('Error saving FCM token locally: $e');
    }
  }

  /// Handle foreground message
  static Future<void> _handleForegroundMessage(RemoteMessage message) async {
    debugPrint('Foreground message received: ${message.messageId}');

    // Respect the partner's notification preference.
    if (!_notificationsEnabled) {
      debugPrint(
        '[FCM] Notifications disabled — suppressing foreground message',
      );
      return;
    }

    final notification = message.notification;
    final data = message.data;

    if (notification != null) {
      await _showLocalNotification(
        title: notification.title ?? 'TastyKart',
        body: notification.body ?? '',
        payload: jsonEncode(data),
        type: data['type'] ?? 'general',
      );
    }
  }

  /// Show local notification
  static Future<void> _showLocalNotification({
    required String title,
    required String body,
    required String payload,
    required String type,
  }) async {
    try {
      // Determine channel based on notification type
      String channelId = _generalChannel.id;
      Importance importance = Importance.defaultImportance;
      Priority priority = Priority.defaultPriority;

      if (type == 'order_assigned' || type == 'order_cancelled') {
        channelId = _orderAlertsChannel.id;
        importance = Importance.high;
        priority = Priority.high;
      }

      final androidDetails = AndroidNotificationDetails(
        channelId,
        channelId == 'order_alerts' ? 'Order Alerts' : 'General Notifications',
        channelDescription: channelId == 'order_alerts'
            ? 'Notifications for new order assignments'
            : 'General app notifications',
        importance: importance,
        priority: priority,
        playSound: true,
        enableVibration: true,
        ticker: 'ticker',
      );

      final notificationDetails = NotificationDetails(android: androidDetails);

      await flutterLocalNotificationsPlugin.show(
        DateTime.now().millisecondsSinceEpoch.remainder(100000),
        title,
        body,
        notificationDetails,
        payload: payload,
      );
    } catch (e) {
      debugPrint('Error showing local notification: $e');
    }
  }

  /// Handle notification tap (when app is opened from notification)
  static void _handleNotificationTap(RemoteMessage message) {
    debugPrint('Notification tapped: ${message.messageId}');

    final data = message.data;
    final action = data['action'] ?? '';
    final orderId = data['orderId'] ?? '';

    _navigateBasedOnAction(action, orderId);
  }

  /// Handle notification tap from local notification payload
  static void handleNotificationTap(String payload) {
    try {
      final data = jsonDecode(payload) as Map<String, dynamic>;
      final action = data['action'] ?? '';
      final orderId = data['orderId'] ?? '';

      _navigateBasedOnAction(action, orderId);
    } catch (e) {
      debugPrint('Error handling notification tap: $e');
    }
  }

  /// Navigate based on notification action
  static void _navigateBasedOnAction(String action, String orderId) {
    final context = AppNavigation.rootNavigatorKey.currentContext;
    if (context == null) return;

    switch (action) {
      case 'view_order':
        if (orderId.isNotEmpty) {
          // Navigate to order details
          debugPrint('Navigate to order: $orderId');
          // TODO: Implement navigation to order details screen
          // Navigator.of(context).push(
          //   MaterialPageRoute(
          //     builder: (context) => OrderDetailsScreen(orderId: orderId),
          //   ),
          // );
        }
        break;
      case 'view_earnings':
        // Navigate to earnings screen
        debugPrint('Navigate to earnings screen');
        // TODO: Implement navigation to earnings screen
        break;
      case 'refresh_profile':
        // Refresh profile or navigate to profile
        debugPrint('Refresh profile');
        break;
      case 'refresh':
        // Just refresh current screen
        debugPrint('Refresh current screen');
        break;
      default:
        debugPrint('Unknown action: $action');
    }
  }

  /// Removes this device token without marking the partner logged out.
  static Future<void> _dropPushToken(String partnerId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('fcm_token');
      final partnerRef = FirebaseFirestore.instance
          .collection(FirestorePaths.deliveryPartners)
          .doc(partnerId);
      await partnerRef.set({
        'fcmTokens': token == null || token.isEmpty
            ? <String>[]
            : FieldValue.arrayRemove([token]),
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
      if (token != null) await prefs.remove('fcm_token');
    } catch (e) {
      debugPrint('[FCM] drop token error: $e');
    }
  }

  /// Remove FCM token from Firestore (on logout)
  static Future<void> removeTokenFromFirestore(String partnerId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('fcm_token');

      final partnerRef = FirebaseFirestore.instance
          .collection(FirestorePaths.deliveryPartners)
          .doc(partnerId);

      final update = <String, dynamic>{
        'loggedIn': false,
        'updatedAt': FieldValue.serverTimestamp(),
      };
      if (token != null) {
        update['fcmTokens'] = FieldValue.arrayRemove([token]);
      }
      await partnerRef.update(update);

      if (token != null) await prefs.remove('fcm_token');
      debugPrint('FCM token removed from Firestore');
    } catch (e) {
      debugPrint('Error removing FCM token: $e');
    }
  }

  /// Update the in-process notifications preference cache.
  /// Called by [DeliveryPartnerService.setNotificationsEnabled] so the
  /// foreground handler immediately respects the new value without restarting.
  static void setNotificationsEnabled(bool enabled) {
    _notificationsEnabled = enabled;
    debugPrint('[FCM] Notifications enabled: $enabled');
  }

  /// Subscribe to topic
  static Future<void> subscribeToTopic(String topic) async {
    try {
      await _messaging.subscribeToTopic(topic);
      debugPrint('Subscribed to topic: $topic');
    } catch (e) {
      debugPrint('Error subscribing to topic: $e');
    }
  }

  /// Unsubscribe from topic
  static Future<void> unsubscribeFromTopic(String topic) async {
    try {
      await _messaging.unsubscribeFromTopic(topic);
      debugPrint('Unsubscribed from topic: $topic');
    } catch (e) {
      debugPrint('Error unsubscribing from topic: $e');
    }
  }

  /// Dispose subscriptions
  static void dispose() {
    _foregroundSubscription?.cancel();
    _onMessageOpenedAppSubscription?.cancel();
  }
}
