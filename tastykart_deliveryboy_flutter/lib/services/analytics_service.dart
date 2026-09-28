import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:flutter/foundation.dart';

/// Analytics service for tracking user events
class AnalyticsService {
  AnalyticsService._();

  static final FirebaseAnalytics _analytics = FirebaseAnalytics.instance;
  static final FirebaseAnalyticsObserver observer =
      FirebaseAnalyticsObserver(analytics: _analytics);

  /// Set user ID
  static Future<void> setUserId(String userId) async {
    try {
      await _analytics.setUserId(id: userId);
      debugPrint('Analytics user ID set: $userId');
    } catch (e) {
      debugPrint('Error setting analytics user ID: $e');
    }
  }

  /// Set user property
  static Future<void> setUserProperty({
    required String name,
    required String value,
  }) async {
    try {
      await _analytics.setUserProperty(name: name, value: value);
      debugPrint('Analytics user property set: $name = $value');
    } catch (e) {
      debugPrint('Error setting user property: $e');
    }
  }

  /// Log custom event
  static Future<void> logEvent({
    required String name,
    Map<String, Object>? parameters,
  }) async {
    try {
      await _analytics.logEvent(name: name, parameters: parameters);
      debugPrint('Analytics event logged: $name');
    } catch (e) {
      debugPrint('Error logging analytics event: $e');
    }
  }

  /// Track screen view
  static Future<void> logScreenView({
    required String screenName,
    String? screenClass,
  }) async {
    try {
      await _analytics.logScreenView(
        screenName: screenName,
        screenClass: screenClass,
      );
      debugPrint('Screen view logged: $screenName');
    } catch (e) {
      debugPrint('Error logging screen view: $e');
    }
  }

  // ============ Partner-specific Events ============

  /// Track partner login
  static Future<void> logPartnerLogin({
    required String partnerId,
    required String method,
  }) async {
    await logEvent(
      name: 'partner_login',
      parameters: {
        'partner_id': partnerId,
        'method': method, // phone, email
      },
    );
  }

  /// Track partner logout
  static Future<void> logPartnerLogout(String partnerId) async {
    await logEvent(
      name: 'partner_logout',
      parameters: {'partner_id': partnerId},
    );
  }

  /// Track order accepted
  static Future<void> logOrderAccepted({
    required String orderId,
    required String orderNumber,
    required String partnerId,
    required int responseTimeSeconds,
  }) async {
    await logEvent(
      name: 'order_accepted',
      parameters: {
        'order_id': orderId,
        'order_number': orderNumber,
        'partner_id': partnerId,
        'response_time_seconds': responseTimeSeconds,
      },
    );
  }

  /// Track order denied/rejected
  static Future<void> logOrderDenied({
    required String orderId,
    required String orderNumber,
    required String partnerId,
    required String reason,
  }) async {
    await logEvent(
      name: 'order_denied',
      parameters: {
        'order_id': orderId,
        'order_number': orderNumber,
        'partner_id': partnerId,
        'reason': reason,
      },
    );
  }

  /// Track order picked up
  static Future<void> logOrderPicked({
    required String orderId,
    required String orderNumber,
    required String partnerId,
  }) async {
    await logEvent(
      name: 'order_picked',
      parameters: {
        'order_id': orderId,
        'order_number': orderNumber,
        'partner_id': partnerId,
      },
    );
  }

  /// Track order delivered
  static Future<void> logOrderDelivered({
    required String orderId,
    required String orderNumber,
    required String partnerId,
    required int deliveryTimeMinutes,
    required int earnings,
  }) async {
    await logEvent(
      name: 'order_delivered',
      parameters: {
        'order_id': orderId,
        'order_number': orderNumber,
        'partner_id': partnerId,
        'delivery_time_minutes': deliveryTimeMinutes,
        'earnings': earnings,
      },
    );
  }

  /// Track earnings withdrawn
  static Future<void> logEarningsWithdrawn({
    required String partnerId,
    required int amount,
    required String method,
  }) async {
    await logEvent(
      name: 'earnings_withdrawn',
      parameters: {
        'partner_id': partnerId,
        'amount': amount,
        'method': method, // bank_transfer, upi
      },
    );
  }

  /// Track slot booked
  static Future<void> logSlotBooked({
    required String partnerId,
    required String slotId,
    required String date,
  }) async {
    await logEvent(
      name: 'slot_booked',
      parameters: {
        'partner_id': partnerId,
        'slot_id': slotId,
        'date': date,
      },
    );
  }

  /// Track location permission
  static Future<void> logLocationPermission({
    required String partnerId,
    required bool granted,
  }) async {
    await logEvent(
      name: granted ? 'location_permission_granted' : 'location_permission_denied',
      parameters: {'partner_id': partnerId},
    );
  }

  /// Track onboarding completed
  static Future<void> logOnboardingCompleted({
    required String partnerId,
    required int durationSeconds,
  }) async {
    await logEvent(
      name: 'onboarding_completed',
      parameters: {
        'partner_id': partnerId,
        'duration_seconds': durationSeconds,
      },
    );
  }

  /// Track document uploaded
  static Future<void> logDocumentUploaded({
    required String partnerId,
    required String documentType,
  }) async {
    await logEvent(
      name: 'document_uploaded',
      parameters: {
        'partner_id': partnerId,
        'document_type': documentType,
      },
    );
  }

  /// Track bank details added
  static Future<void> logBankDetailsAdded({
    required String partnerId,
    required String method,
  }) async {
    await logEvent(
      name: 'bank_details_added',
      parameters: {
        'partner_id': partnerId,
        'method': method, // bank, upi
      },
    );
  }

  /// Track going online
  static Future<void> logGoOnline(String partnerId) async {
    await logEvent(
      name: 'partner_go_online',
      parameters: {'partner_id': partnerId},
    );
  }

  /// Track going offline
  static Future<void> logGoOffline(String partnerId) async {
    await logEvent(
      name: 'partner_go_offline',
      parameters: {'partner_id': partnerId},
    );
  }

  /// Track navigation started
  static Future<void> logNavigationStarted({
    required String orderId,
    required String partnerId,
    required String destination,
  }) async {
    await logEvent(
      name: 'navigation_started',
      parameters: {
        'order_id': orderId,
        'partner_id': partnerId,
        'destination': destination, // restaurant, customer
      },
    );
  }

  /// Track call customer/restaurant
  static Future<void> logCallInitiated({
    required String orderId,
    required String partnerId,
    required String callType,
  }) async {
    await logEvent(
      name: 'call_initiated',
      parameters: {
        'order_id': orderId,
        'partner_id': partnerId,
        'call_type': callType, // customer, restaurant
      },
    );
  }

  /// Track error encountered
  static Future<void> logError({
    required String errorType,
    required String errorMessage,
    String? partnerId,
  }) async {
    await logEvent(
      name: 'error_encountered',
      parameters: {
        'error_type': errorType,
        'error_message': errorMessage,
        if (partnerId != null) 'partner_id': partnerId,
      },
    );
  }
}
