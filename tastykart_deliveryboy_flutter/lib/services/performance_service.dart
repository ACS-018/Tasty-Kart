import 'package:firebase_performance/firebase_performance.dart';
import 'package:flutter/foundation.dart';

/// Wraps [Trace] with its name because `Trace` does not expose a `.name`
/// getter in current versions of `firebase_performance`.
///
/// Used as the return / parameter type for [PerformanceService] helpers so
/// that callers can store trace references while debug logs retain the
/// original trace name.
class NamedTrace {
  final Trace trace;
  final String name;
  NamedTrace(this.trace, this.name);
}

/// Performance monitoring service for tracing critical operations.
class PerformanceService {
  PerformanceService._();

  static final FirebasePerformance _performance = FirebasePerformance.instance;

  /// Start a custom trace
  static Future<NamedTrace> startTrace(String traceName) async {
    final trace = _performance.newTrace(traceName);
    await trace.start();
    debugPrint('Performance trace started: $traceName');
    return NamedTrace(trace, traceName);
  }

  /// Stop a trace
  static Future<void> stopTrace(NamedTrace nt) async {
    await nt.trace.stop();
    debugPrint('Performance trace stopped: ${nt.name}');
  }

  /// Set metric for a trace
  static void setTraceMetric(NamedTrace nt, String metricName, int value) {
    nt.trace.setMetric(metricName, value);
    debugPrint('Trace metric set: $metricName = $value');
  }

  /// Increment metric for a trace
  static void incrementTraceMetric(
    NamedTrace nt,
    String metricName,
    int value,
  ) {
    nt.trace.incrementMetric(metricName, value);
    debugPrint('Trace metric incremented: $metricName += $value');
  }

  /// Set attribute for a trace
  static void setTraceAttribute(NamedTrace nt, String attribute, String value) {
    nt.trace.putAttribute(attribute, value);
    debugPrint('Trace attribute set: $attribute = $value');
  }

  // ============ Predefined Traces ============

  /// Trace order acceptance flow
  static Future<NamedTrace> traceOrderAcceptanceFlow() async {
    return startTrace('order_acceptance_flow');
  }

  /// Trace order pickup flow
  static Future<NamedTrace> traceOrderPickupFlow() async {
    return startTrace('order_pickup_flow');
  }

  /// Trace order delivery flow
  static Future<NamedTrace> traceOrderDeliveryFlow() async {
    return startTrace('order_delivery_flow');
  }

  /// Trace location update
  static Future<NamedTrace> traceLocationUpdate() async {
    return startTrace('location_update');
  }

  /// Trace document upload
  static Future<NamedTrace> traceDocumentUpload(String documentType) async {
    final nt = await startTrace('document_upload');
    setTraceAttribute(nt, 'document_type', documentType);
    return nt;
  }

  /// Trace withdrawal request
  static Future<NamedTrace> traceWithdrawalRequest() async {
    return startTrace('withdrawal_request');
  }

  /// Trace order list load
  static Future<NamedTrace> traceOrderListLoad() async {
    return startTrace('order_list_load');
  }

  /// Trace earnings calculation
  static Future<NamedTrace> traceEarningsCalculation() async {
    return startTrace('earnings_calculation');
  }

  /// Trace route calculation
  static Future<NamedTrace> traceRouteCalculation() async {
    return startTrace('route_calculation');
  }

  /// Trace IFSC verification
  static Future<NamedTrace> traceIFSCVerification() async {
    return startTrace('ifsc_verification');
  }

  /// Trace Firebase initialization
  static Future<NamedTrace> traceFirebaseInit() async {
    return startTrace('firebase_init');
  }

  /// Create HTTP metric
  static HttpMetric createHttpMetric({
    required String url,
    required HttpMethod method,
  }) {
    final metric = _performance.newHttpMetric(url, method);
    debugPrint('HTTP metric created: $method $url');
    return metric;
  }

  /// Helper to trace async operation with automatic cleanup
  static Future<T> traceOperation<T>({
    required String traceName,
    required Future<T> Function(Trace trace) operation,
    Map<String, String>? attributes,
    Map<String, int>? metrics,
  }) async {
    final nt = await startTrace(traceName);

    try {
      // Set attributes if provided
      if (attributes != null) {
        for (final entry in attributes.entries) {
          setTraceAttribute(nt, entry.key, entry.value);
        }
      }

      // Execute operation (pass raw Trace to user callback for API compat)
      final result = await operation(nt.trace);

      // Set metrics if provided
      if (metrics != null) {
        for (final entry in metrics.entries) {
          setTraceMetric(nt, entry.key, entry.value);
        }
      }

      return result;
    } finally {
      await stopTrace(nt);
    }
  }

  /// Trace order acceptance with metrics
  static Future<T> traceOrderAcceptance<T>({
    required String orderId,
    required Future<T> Function() operation,
  }) async {
    return traceOperation(
      traceName: 'order_acceptance',
      operation: (trace) async {
        final startTime = DateTime.now();

        final result = await operation();

        final duration = DateTime.now().difference(startTime).inMilliseconds;
        trace.putAttribute('order_id', orderId);
        trace.setMetric('duration_ms', duration);

        return result;
      },
    );
  }

  /// Trace location tracking with metrics
  static Future<T> traceLocationTracking<T>({
    required String partnerId,
    required Future<T> Function() operation,
  }) async {
    return traceOperation(
      traceName: 'location_tracking',
      operation: (trace) async {
        final startTime = DateTime.now();
        final result = await operation();

        final duration = DateTime.now().difference(startTime).inMilliseconds;
        trace.putAttribute('partner_id', partnerId);
        trace.setMetric('update_duration_ms', duration);

        return result;
      },
    );
  }

  /// Trace Firestore operation
  static Future<T> traceFirestoreOperation<T>({
    required String operationName,
    required String collection,
    required Future<T> Function() operation,
  }) async {
    return traceOperation(
      traceName: 'firestore_$operationName',
      operation: (trace) async {
        final startTime = DateTime.now();
        final result = await operation();

        final duration = DateTime.now().difference(startTime).inMilliseconds;
        trace.putAttribute('collection', collection);
        trace.setMetric('operation_duration_ms', duration);

        return result;
      },
    );
  }
}
