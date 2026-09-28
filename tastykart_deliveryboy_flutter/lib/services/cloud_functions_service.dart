import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/foundation.dart';

import 'crashlytics_service.dart';

/// Service for calling Firebase Cloud Functions
class CloudFunctionsService {
  CloudFunctionsService._();

  static final FirebaseFunctions _functions = FirebaseFunctions.instance;

  /// Call a cloud function
  static Future<T?> callFunction<T>({
    required String functionName,
    Map<String, dynamic>? parameters,
  }) async {
    try {
      debugPrint('Calling cloud function: $functionName');
      
      final callable = _functions.httpsCallable(functionName);
      final result = await callable.call(parameters);
      
      debugPrint('Cloud function result: ${result.data}');
      return result.data as T?;
    } catch (e, stackTrace) {
      debugPrint('Error calling cloud function $functionName: $e');
      
      await CrashlyticsService.recordError(
        exception: e,
        stackTrace: stackTrace,
        reason: 'Cloud function call failed: $functionName',
      );
      
      rethrow;
    }
  }

  // ============ Order Management Functions ============

  /// Assign delivery partner to an order
  static Future<Map<String, dynamic>?> assignDeliveryPartner({
    required String orderId,
    required String partnerId,
  }) async {
    return await callFunction<Map<String, dynamic>>(
      functionName: 'assignDeliveryPartner',
      parameters: {
        'orderId': orderId,
        'partnerId': partnerId,
      },
    );
  }

  /// Accept order assignment
  static Future<Map<String, dynamic>?> acceptOrderAssignment({
    required String orderId,
    required String partnerId,
  }) async {
    return await callFunction<Map<String, dynamic>>(
      functionName: 'acceptOrderAssignment',
      parameters: {
        'orderId': orderId,
        'partnerId': partnerId,
      },
    );
  }

  /// Deny/reject order assignment
  static Future<Map<String, dynamic>?> denyOrderAssignment({
    required String orderId,
    required String partnerId,
    required String reason,
  }) async {
    return await callFunction<Map<String, dynamic>>(
      functionName: 'denyOrderAssignment',
      parameters: {
        'orderId': orderId,
        'partnerId': partnerId,
        'reason': reason,
      },
    );
  }

  // ============ Bank & Payment Functions ============

  /// Verify IFSC code
  static Future<Map<String, dynamic>?> verifyIFSC({
    required String ifsc,
  }) async {
    try {
      final result = await callFunction<Map<String, dynamic>>(
        functionName: 'verifyIFSC',
        parameters: {'ifsc': ifsc},
      );
      
      return result;
    } catch (e) {
      debugPrint('Error verifying IFSC: $e');
      return null;
    }
  }

  /// Process withdrawal/payout request
  static Future<Map<String, dynamic>?> processWithdrawal({
    required String partnerId,
    required int amount,
    required String method, // 'bank_transfer' or 'upi'
  }) async {
    return await callFunction<Map<String, dynamic>>(
      functionName: 'processWithdrawal',
      parameters: {
        'partnerId': partnerId,
        'amount': amount,
        'method': method,
      },
    );
  }

  /// Request payout (alternative name)
  static Future<Map<String, dynamic>?> requestPayout({
    required String partnerId,
    required int amount,
    required String method,
  }) async {
    return await processWithdrawal(
      partnerId: partnerId,
      amount: amount,
      method: method,
    );
  }

  // ============ Partner Management Functions ============

  /// Update partner status
  static Future<Map<String, dynamic>?> updatePartnerStatus({
    required String partnerId,
    required String status, // 'available', 'busy', 'offline'
  }) async {
    return await callFunction<Map<String, dynamic>>(
      functionName: 'updatePartnerStatus',
      parameters: {
        'partnerId': partnerId,
        'status': status,
      },
    );
  }

  /// Submit partner documents for verification
  static Future<Map<String, dynamic>?> submitDocumentsForVerification({
    required String partnerId,
  }) async {
    return await callFunction<Map<String, dynamic>>(
      functionName: 'submitDocumentsForVerification',
      parameters: {'partnerId': partnerId},
    );
  }

  /// Complete onboarding
  static Future<Map<String, dynamic>?> completeOnboarding({
    required String partnerId,
  }) async {
    return await callFunction<Map<String, dynamic>>(
      functionName: 'completeOnboarding',
      parameters: {'partnerId': partnerId},
    );
  }

  // ============ Delivery Management Functions ============

  /// Mark order as picked up
  static Future<Map<String, dynamic>?> markOrderPicked({
    required String orderId,
    required String partnerId,
    required String pickupCode,
  }) async {
    return await callFunction<Map<String, dynamic>>(
      functionName: 'markOrderPicked',
      parameters: {
        'orderId': orderId,
        'partnerId': partnerId,
        'pickupCode': pickupCode,
      },
    );
  }

  /// Mark order as delivered
  static Future<Map<String, dynamic>?> markOrderDelivered({
    required String orderId,
    required String partnerId,
    String? deliveryProofUrl,
    String? collectedVia, // 'cash' or 'online'
  }) async {
    return await callFunction<Map<String, dynamic>>(
      functionName: 'markOrderDelivered',
      parameters: {
        'orderId': orderId,
        'partnerId': partnerId,
        if (deliveryProofUrl != null) 'deliveryProofUrl': deliveryProofUrl,
        if (collectedVia != null) 'collectedVia': collectedVia,
      },
    );
  }

  /// Cancel order by partner
  static Future<Map<String, dynamic>?> cancelOrderByPartner({
    required String orderId,
    required String partnerId,
    required String reason,
  }) async {
    return await callFunction<Map<String, dynamic>>(
      functionName: 'cancelOrderByPartner',
      parameters: {
        'orderId': orderId,
        'partnerId': partnerId,
        'reason': reason,
      },
    );
  }

  // ============ Slot & Scheduling Functions ============

  /// Book delivery slot
  static Future<Map<String, dynamic>?> bookDeliverySlot({
    required String partnerId,
    required String slotId,
    required String date,
  }) async {
    return await callFunction<Map<String, dynamic>>(
      functionName: 'bookDeliverySlot',
      parameters: {
        'partnerId': partnerId,
        'slotId': slotId,
        'date': date,
      },
    );
  }

  /// Cancel booked slot
  static Future<Map<String, dynamic>?> cancelDeliverySlot({
    required String partnerId,
    required String slotId,
    required String date,
  }) async {
    return await callFunction<Map<String, dynamic>>(
      functionName: 'cancelDeliverySlot',
      parameters: {
        'partnerId': partnerId,
        'slotId': slotId,
        'date': date,
      },
    );
  }

  // ============ Notification Functions ============

  /// Send custom notification to admin
  static Future<Map<String, dynamic>?> notifyAdmin({
    required String partnerId,
    required String subject,
    required String message,
    String? orderId,
  }) async {
    return await callFunction<Map<String, dynamic>>(
      functionName: 'notifyAdmin',
      parameters: {
        'partnerId': partnerId,
        'subject': subject,
        'message': message,
        if (orderId != null) 'orderId': orderId,
      },
    );
  }

  // ============ Support Functions ============

  /// Report issue
  static Future<Map<String, dynamic>?> reportIssue({
    required String partnerId,
    required String issueType,
    required String description,
    String? orderId,
  }) async {
    return await callFunction<Map<String, dynamic>>(
      functionName: 'reportIssue',
      parameters: {
        'partnerId': partnerId,
        'issueType': issueType,
        'description': description,
        if (orderId != null) 'orderId': orderId,
      },
    );
  }

  /// Request help/support
  static Future<Map<String, dynamic>?> requestSupport({
    required String partnerId,
    required String message,
    String? orderId,
  }) async {
    return await callFunction<Map<String, dynamic>>(
      functionName: 'requestSupport',
      parameters: {
        'partnerId': partnerId,
        'message': message,
        if (orderId != null) 'orderId': orderId,
      },
    );
  }

  // ============ Analytics & Reporting Functions ============

  /// Get partner earnings summary
  static Future<Map<String, dynamic>?> getEarningsSummary({
    required String partnerId,
    String? startDate,
    String? endDate,
  }) async {
    return await callFunction<Map<String, dynamic>>(
      functionName: 'getEarningsSummary',
      parameters: {
        'partnerId': partnerId,
        if (startDate != null) 'startDate': startDate,
        if (endDate != null) 'endDate': endDate,
      },
    );
  }

  /// Get partner performance metrics
  static Future<Map<String, dynamic>?> getPerformanceMetrics({
    required String partnerId,
  }) async {
    return await callFunction<Map<String, dynamic>>(
      functionName: 'getPerformanceMetrics',
      parameters: {'partnerId': partnerId},
    );
  }

  // ============ Utility Functions ============

  /// Calculate route distance and ETA
  static Future<Map<String, dynamic>?> calculateRouteDetails({
    required double originLat,
    required double originLng,
    required double destLat,
    required double destLng,
  }) async {
    return await callFunction<Map<String, dynamic>>(
      functionName: 'calculateRouteDetails',
      parameters: {
        'originLat': originLat,
        'originLng': originLng,
        'destLat': destLat,
        'destLng': destLng,
      },
    );
  }

  /// Verify pickup code
  static Future<Map<String, dynamic>?> verifyPickupCode({
    required String orderId,
    required String code,
  }) async {
    return await callFunction<Map<String, dynamic>>(
      functionName: 'verifyPickupCode',
      parameters: {
        'orderId': orderId,
        'code': code,
      },
    );
  }
}
