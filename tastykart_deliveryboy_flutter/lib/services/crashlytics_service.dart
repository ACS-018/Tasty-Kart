import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';

/// Crashlytics service for error reporting and crash tracking
class CrashlyticsService {
  CrashlyticsService._();

  static final FirebaseCrashlytics _crashlytics = FirebaseCrashlytics.instance;

  /// Set user identifier
  static Future<void> setUserId(String userId) async {
    try {
      await _crashlytics.setUserIdentifier(userId);
      debugPrint('Crashlytics user ID set: $userId');
    } catch (e) {
      debugPrint('Error setting Crashlytics user ID: $e');
    }
  }

  /// Set custom key
  static Future<void> setCustomKey(String key, dynamic value) async {
    try {
      await _crashlytics.setCustomKey(key, value);
      debugPrint('Crashlytics custom key set: $key = $value');
    } catch (e) {
      debugPrint('Error setting custom key: $e');
    }
  }

  /// Log message
  static void log(String message) {
    try {
      _crashlytics.log(message);
      debugPrint('Crashlytics log: $message');
    } catch (e) {
      debugPrint('Error logging to Crashlytics: $e');
    }
  }

  /// Record error (non-fatal)
  static Future<void> recordError({
    required dynamic exception,
    required StackTrace stackTrace,
    String? reason,
    Iterable<Object>? information,
    bool printDetails = true,
    bool fatal = false,
  }) async {
    try {
      if (information != null) {
        await _crashlytics.recordError(
          exception,
          stackTrace,
          reason: reason,
          information: information.toList(),
          printDetails: printDetails,
          fatal: fatal,
        );
      } else {
        await _crashlytics.recordError(
          exception,
          stackTrace,
          reason: reason,
          printDetails: printDetails,
          fatal: fatal,
        );
      }
      debugPrint('Crashlytics error recorded: ${exception.toString()}');
    } catch (e) {
      debugPrint('Error recording to Crashlytics: $e');
    }
  }

  /// Record Flutter error
  static Future<void> recordFlutterError(
    FlutterErrorDetails errorDetails,
  ) async {
    try {
      await _crashlytics.recordFlutterError(errorDetails);
      debugPrint('Crashlytics Flutter error recorded');
    } catch (e) {
      debugPrint('Error recording Flutter error: $e');
    }
  }

  /// Record Flutter fatal error
  static Future<void> recordFlutterFatalError(
    FlutterErrorDetails errorDetails,
  ) async {
    try {
      await _crashlytics.recordFlutterFatalError(errorDetails);
      debugPrint('Crashlytics Flutter fatal error recorded');
    } catch (e) {
      debugPrint('Error recording Flutter fatal error: $e');
    }
  }

  /// Set collection enabled/disabled
  static Future<void> setCrashlyticsCollectionEnabled(bool enabled) async {
    try {
      await _crashlytics.setCrashlyticsCollectionEnabled(enabled);
      debugPrint('Crashlytics collection enabled: $enabled');
    } catch (e) {
      debugPrint('Error setting Crashlytics collection: $e');
    }
  }

  /// Check if collection is enabled
  static Future<bool> isCrashlyticsCollectionEnabled() async {
    try {
      return _crashlytics.isCrashlyticsCollectionEnabled;
    } catch (e) {
      debugPrint('Error checking Crashlytics collection status: $e');
      return false;
    }
  }

  // ============ Partner-specific Error Tracking ============

  /// Record order acceptance error
  static Future<void> recordOrderAcceptanceError({
    required String orderId,
    required String partnerId,
    required dynamic error,
    required StackTrace stackTrace,
  }) async {
    await setCustomKey('order_id', orderId);
    await setCustomKey('partner_id', partnerId);
    await setCustomKey('error_context', 'order_acceptance');

    await recordError(
      exception: error,
      stackTrace: stackTrace,
      reason: 'Failed to accept order $orderId',
    );
  }

  /// Record order pickup error
  static Future<void> recordOrderPickupError({
    required String orderId,
    required String partnerId,
    required dynamic error,
    required StackTrace stackTrace,
  }) async {
    await setCustomKey('order_id', orderId);
    await setCustomKey('partner_id', partnerId);
    await setCustomKey('error_context', 'order_pickup');

    await recordError(
      exception: error,
      stackTrace: stackTrace,
      reason: 'Failed to pickup order $orderId',
    );
  }

  /// Record order delivery error
  static Future<void> recordOrderDeliveryError({
    required String orderId,
    required String partnerId,
    required dynamic error,
    required StackTrace stackTrace,
  }) async {
    await setCustomKey('order_id', orderId);
    await setCustomKey('partner_id', partnerId);
    await setCustomKey('error_context', 'order_delivery');

    await recordError(
      exception: error,
      stackTrace: stackTrace,
      reason: 'Failed to deliver order $orderId',
    );
  }

  /// Record location update error
  static Future<void> recordLocationUpdateError({
    required String partnerId,
    required dynamic error,
    required StackTrace stackTrace,
  }) async {
    await setCustomKey('partner_id', partnerId);
    await setCustomKey('error_context', 'location_update');

    await recordError(
      exception: error,
      stackTrace: stackTrace,
      reason: 'Failed to update location',
    );
  }

  /// Record document upload error
  static Future<void> recordDocumentUploadError({
    required String partnerId,
    required String documentType,
    required dynamic error,
    required StackTrace stackTrace,
  }) async {
    await setCustomKey('partner_id', partnerId);
    await setCustomKey('document_type', documentType);
    await setCustomKey('error_context', 'document_upload');

    await recordError(
      exception: error,
      stackTrace: stackTrace,
      reason: 'Failed to upload document: $documentType',
    );
  }

  /// Record withdrawal error
  static Future<void> recordWithdrawalError({
    required String partnerId,
    required int amount,
    required dynamic error,
    required StackTrace stackTrace,
  }) async {
    await setCustomKey('partner_id', partnerId);
    await setCustomKey('withdrawal_amount', amount);
    await setCustomKey('error_context', 'withdrawal');

    await recordError(
      exception: error,
      stackTrace: stackTrace,
      reason: 'Failed to process withdrawal',
    );
  }

  /// Record authentication error
  static Future<void> recordAuthError({
    required String authMethod,
    required dynamic error,
    required StackTrace stackTrace,
  }) async {
    await setCustomKey('auth_method', authMethod);
    await setCustomKey('error_context', 'authentication');

    await recordError(
      exception: error,
      stackTrace: stackTrace,
      reason: 'Authentication failed',
    );
  }

  /// Record Firebase error
  static Future<void> recordFirebaseError({
    required String operation,
    required String collection,
    required dynamic error,
    required StackTrace stackTrace,
  }) async {
    await setCustomKey('firebase_operation', operation);
    await setCustomKey('firebase_collection', collection);
    await setCustomKey('error_context', 'firebase_operation');

    await recordError(
      exception: error,
      stackTrace: stackTrace,
      reason: 'Firebase operation failed: $operation on $collection',
    );
  }

  /// Record network error
  static Future<void> recordNetworkError({
    required String endpoint,
    required int statusCode,
    required dynamic error,
    required StackTrace stackTrace,
  }) async {
    await setCustomKey('network_endpoint', endpoint);
    await setCustomKey('network_status_code', statusCode);
    await setCustomKey('error_context', 'network_request');

    await recordError(
      exception: error,
      stackTrace: stackTrace,
      reason: 'Network request failed: $endpoint',
    );
  }

  /// Record permission error
  static Future<void> recordPermissionError({
    required String permissionType,
    required String partnerId,
    required dynamic error,
    required StackTrace stackTrace,
  }) async {
    await setCustomKey('permission_type', permissionType);
    await setCustomKey('partner_id', partnerId);
    await setCustomKey('error_context', 'permission_request');

    await recordError(
      exception: error,
      stackTrace: stackTrace,
      reason: 'Permission request failed: $permissionType',
    );
  }

  /// Clear custom keys
  static Future<void> clearCustomKeys() async {
    try {
      // Crashlytics doesn't have a clear method, but we can set empty values
      await setCustomKey('order_id', '');
      await setCustomKey('partner_id', '');
      await setCustomKey('error_context', '');
    } catch (e) {
      debugPrint('Error clearing custom keys: $e');
    }
  }
}
