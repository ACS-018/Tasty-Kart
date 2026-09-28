import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import 'analytics_service.dart';
import 'crashlytics_service.dart';
import 'firestore_paths.dart';

/// Enhanced location service with background tracking and history.
///
/// Dual-trigger update strategy:
/// 1. Time-based: every 30-60 seconds during active tracking
/// 2. Distance-based: immediately when partner moves > 50 meters
///
/// Firestore write format (flat fields — matches deployed admin UI + types):
///   deliveryPartners/{partnerUid}.update({
///     'currentLat': position.latitude,
///     'currentLng': position.longitude,
///     'lastLocationUpdate': FieldValue.serverTimestamp(),
///     'lastSeen': FieldValue.serverTimestamp(),
///   });
class LocationService {
  LocationService._();

  static Timer? _backgroundTimer;
  static bool _isTracking = false;
  static String? _activeOrderId;
  static String? _activePartnerId;
  static StreamSubscription<Position>? _positionStreamSubscription;
  static Position? _lastUpdatedPosition;
  static DateTime? _lastUpdatedAt;
  static const double _distanceThresholdMeters = 50.0;
  static const int _timerIntervalSeconds = 45;

  /// Check if location service is enabled
  static Future<bool> isLocationServiceEnabled() async {
    return await Geolocator.isLocationServiceEnabled();
  }

  /// Check location permission status
  static Future<LocationPermission> checkPermission() async {
    return await Geolocator.checkPermission();
  }

  /// Request location permission
  static Future<LocationPermission> requestPermission() async {
    return await Geolocator.requestPermission();
  }

  /// Ensure location permission is granted
  static Future<bool> ensurePermission() async {
    final enabled = await Geolocator.isLocationServiceEnabled();
    if (!enabled) {
      debugPrint('Location services are disabled');
      return false;
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();

      // Track permission result
      if (permission == LocationPermission.whileInUse ||
          permission == LocationPermission.always) {
        if (_activePartnerId != null) {
          await AnalyticsService.logLocationPermission(
            partnerId: _activePartnerId!,
            granted: true,
          );
        }
      } else {
        if (_activePartnerId != null) {
          await AnalyticsService.logLocationPermission(
            partnerId: _activePartnerId!,
            granted: false,
          );
        }
      }
    }

    if (permission == LocationPermission.deniedForever) {
      debugPrint('Location permissions are permanently denied');
      return false;
    }

    return permission == LocationPermission.always ||
        permission == LocationPermission.whileInUse;
  }

  /// Get current location
  static Future<LatLng?> current() async {
    if (!await ensurePermission()) return null;

    try {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 8),
        ),
      );
      return LatLng(pos.latitude, pos.longitude);
    } catch (e, stackTrace) {
      debugPrint('Error getting current location: $e');

      // Try to get last known position
      try {
        final last = await Geolocator.getLastKnownPosition();
        if (last != null) {
          return LatLng(last.latitude, last.longitude);
        }
      } catch (e2) {
        debugPrint('Error getting last known location: $e2');
      }

      // Log error to Crashlytics
      if (_activePartnerId != null) {
        await CrashlyticsService.recordLocationUpdateError(
          partnerId: _activePartnerId!,
          error: e,
          stackTrace: stackTrace,
        );
      }

      return null;
    }
  }

  /// Get current position with full details
  static Future<Position?> getCurrentPosition() async {
    if (!await ensurePermission()) return null;

    try {
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 8),
        ),
      );
    } catch (e) {
      debugPrint('Error getting position: $e');
      return await Geolocator.getLastKnownPosition();
    }
  }

  /// Watch location changes (real-time stream)
  static Stream<LatLng> watch() {
    return Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 25, // Update every 25 meters
      ),
    ).map((pos) => LatLng(pos.latitude, pos.longitude));
  }

  /// Watch position changes with full details
  static Stream<Position> watchPosition() {
    return Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 25,
      ),
    );
  }

  /// Start background location tracking with dual-trigger strategy:
  /// - Time-based: every [_timerIntervalSeconds] seconds (30-60s range)
  /// - Distance-based: immediately when partner moves > [_distanceThresholdMeters] (50m)
  static Future<void> startBackgroundTracking({
    required String partnerId,
    String? orderId,
  }) async {
    if (_isTracking) {
      debugPrint('Background tracking already active');
      return;
    }

    _activePartnerId = partnerId;
    _activeOrderId = orderId;
    _isTracking = true;
    _lastUpdatedPosition = null;
    _lastUpdatedAt = null;

    debugPrint(
      'Starting background location tracking for partner: $partnerId '
      '(timer: ${_timerIntervalSeconds}s, distance: ${_distanceThresholdMeters}m)',
    );

    // Initial location update
    await _updateLocationToFirestore();

    // 1) Set up periodic timer-based updates (fallback, every 45 seconds)
    _backgroundTimer = Timer.periodic(
      const Duration(seconds: _timerIntervalSeconds),
      (timer) async {
        if (_isTracking) {
          debugPrint('Timer fired → location update');
          await _updateLocationToFirestore();
        }
      },
    );

    // 2) Set up distance-based trigger via real-time position stream
    try {
      _positionStreamSubscription = Geolocator.getPositionStream(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 10, // Emit every 10 meters for distance checks
        ),
      ).listen((Position position) async {
        if (!_isTracking) return;

        final distance = _distanceSinceLastUpdate(position);
        final timeSince = _secondsSinceLastUpdate();

        if (distance >= _distanceThresholdMeters) {
          debugPrint(
            'Distance trigger: moved ${distance.toStringAsFixed(1)}m '
            '(>= ${_distanceThresholdMeters}m), elapsed: ${timeSince}s → update',
          );
          await _updateLocationToFirestore(candidatePosition: position);
        }
      });
    } catch (e, stackTrace) {
      debugPrint('Error starting position stream: $e');
      if (_activePartnerId != null) {
        await CrashlyticsService.recordLocationUpdateError(
          partnerId: _activePartnerId!,
          error: e,
          stackTrace: stackTrace,
        );
      }
    }
  }

  /// Stop background location tracking
  static void stopBackgroundTracking() {
    if (!_isTracking) return;

    debugPrint('Stopping background location tracking');

    _backgroundTimer?.cancel();
    _backgroundTimer = null;
    _positionStreamSubscription?.cancel();
    _positionStreamSubscription = null;
    _isTracking = false;
    _activeOrderId = null;
    _activePartnerId = null;
    _lastUpdatedPosition = null;
    _lastUpdatedAt = null;
  }

  /// Distance (in meters) from the last Firestore-updated position.
  static double _distanceSinceLastUpdate(Position current) {
    final last = _lastUpdatedPosition;
    if (last == null) return double.infinity;
    return Geolocator.distanceBetween(
      last.latitude,
      last.longitude,
      current.latitude,
      current.longitude,
    );
  }

  /// Seconds elapsed since the last Firestore update.
  static int _secondsSinceLastUpdate() {
    final last = _lastUpdatedAt;
    if (last == null) return 999999;
    return DateTime.now().difference(last).inSeconds;
  }

  /// Check if currently tracking
  static bool get isTracking => _isTracking;

  /// Update location to Firestore (partner document + location history).
  ///
  /// Uses flat field format matching deployed readers:
  ///   currentLat, currentLng, lastLocationUpdate, lastSeen
  ///
  /// Optional [candidatePosition] avoids re-fetching GPS when the caller
  /// already has a fresh position from the distance-trigger stream.
  static Future<void> _updateLocationToFirestore({
    Position? candidatePosition,
  }) async {
    if (_activePartnerId == null) return;

    try {
      final position = candidatePosition ?? await getCurrentPosition();
      if (position == null) {
        debugPrint('No location available for update');
        return;
      }

      final batch = FirebaseFirestore.instance.batch();

      // Update current location in partner document
      // NOTE: Uses FLAT fields (currentLat / currentLng), NOT nested location.*
      // This matches the deployed React admin, TypeScript types, and firebaseService.
      final partnerRef = FirebaseFirestore.instance
          .collection(FirestorePaths.deliveryPartners)
          .doc(_activePartnerId);

      batch.update(partnerRef, {
        'currentLat': position.latitude,
        'currentLng': position.longitude,
        'lastLocationUpdate': FieldValue.serverTimestamp(),
        'lastSeen': FieldValue.serverTimestamp(),
      });

      // Store location in history subcollection
      final locationRef = partnerRef
          .collection(FirestorePaths.partnerLocations)
          .doc(); // Auto-generate ID

      batch.set(locationRef, {
        'lat': position.latitude,
        'lng': position.longitude,
        'accuracy': position.accuracy,
        'orderId': _activeOrderId ?? '',
        'timestamp': FieldValue.serverTimestamp(),
        'battery': await _getBatteryLevel(),
        'isMoving': position.speed > 0.5, // Moving if speed > 0.5 m/s
      });

      await batch.commit();

      // Track last written position & time for distance-based dedupe
      _lastUpdatedPosition = position;
      _lastUpdatedAt = DateTime.now();

      debugPrint(
        'Location updated: ${position.latitude.toStringAsFixed(6)}, '
        '${position.longitude.toStringAsFixed(6)} '
        '(acc: ${position.accuracy.toStringAsFixed(1)}m)',
      );
    } catch (e, stackTrace) {
      debugPrint('Error updating location to Firestore: $e');

      if (_activePartnerId != null) {
        await CrashlyticsService.recordLocationUpdateError(
          partnerId: _activePartnerId!,
          error: e,
          stackTrace: stackTrace,
        );
      }
    }
  }

  /// Update location once (without starting background tracking).
  /// Also writes the required `lastSeen` field.
  static Future<void> updateLocationOnce({
    required String partnerId,
    String? orderId,
  }) async {
    final oldPartnerId = _activePartnerId;
    final oldOrderId = _activeOrderId;
    final oldIsTracking = _isTracking;
    final oldLastPos = _lastUpdatedPosition;
    final oldLastAt = _lastUpdatedAt;

    _activePartnerId = partnerId;
    _activeOrderId = orderId;
    _isTracking = true;

    await _updateLocationToFirestore();

    _activePartnerId = oldPartnerId;
    _activeOrderId = oldOrderId;
    _isTracking = oldIsTracking;
    _lastUpdatedPosition = oldLastPos;
    _lastUpdatedAt = oldLastAt;
  }

  /// Get battery level (stub - implement with battery_plus package if needed)
  static Future<int> _getBatteryLevel() async {
    // TODO: Implement battery level detection
    // Requires battery_plus package
    return 100;
  }

  /// Calculate distance between two coordinates (in kilometers)
  static double calculateDistance({
    required double startLat,
    required double startLng,
    required double endLat,
    required double endLng,
  }) {
    return Geolocator.distanceBetween(startLat, startLng, endLat, endLng) /
        1000; // Convert meters to kilometers
  }

  /// Get distance in meters
  static double calculateDistanceInMeters({
    required double startLat,
    required double startLng,
    required double endLat,
    required double endLng,
  }) {
    return Geolocator.distanceBetween(startLat, startLng, endLat, endLng);
  }

  /// Calculate bearing between two points (in degrees)
  static double calculateBearing({
    required double startLat,
    required double startLng,
    required double endLat,
    required double endLng,
  }) {
    return Geolocator.bearingBetween(startLat, startLng, endLat, endLng);
  }

  /// Open device location settings
  static Future<bool> openLocationSettings() async {
    return await Geolocator.openLocationSettings();
  }

  /// Open app settings
  static Future<bool> openAppSettings() async {
    return await Geolocator.openAppSettings();
  }

  /// Clean up old location history (older than 90 days)
  static Future<void> cleanOldLocationHistory(String partnerId) async {
    try {
      final cutoffDate = DateTime.now().subtract(const Duration(days: 90));
      final cutoffTimestamp = Timestamp.fromDate(cutoffDate);

      final locationsRef = FirebaseFirestore.instance
          .collection(FirestorePaths.deliveryPartners)
          .doc(partnerId)
          .collection(FirestorePaths.partnerLocations);

      final oldLocations = await locationsRef
          .where('timestamp', isLessThan: cutoffTimestamp)
          .limit(100)
          .get();

      if (oldLocations.docs.isEmpty) {
        debugPrint('No old locations to clean');
        return;
      }

      final batch = FirebaseFirestore.instance.batch();
      for (final doc in oldLocations.docs) {
        batch.delete(doc.reference);
      }

      await batch.commit();
      debugPrint('Deleted ${oldLocations.docs.length} old location records');
    } catch (e) {
      debugPrint('Error cleaning old location history: $e');
    }
  }

  /// Dispose resources
  static void dispose() {
    stopBackgroundTracking();
  }

  // =========================================================================
  // Mobile App Update Logic — exact contract from requirements:
  // Writes to Firestore every 30-60 seconds (or when partner moves > 50m):
  //
  //   FirebaseFirestore.instance
  //     .collection('deliveryPartners')
  //     .doc(partnerUid)
  //     .update({
  //       'currentLat': position.latitude,
  //       'currentLng': position.longitude,
  //       'lastLocationUpdate': FieldValue.serverTimestamp(),
  //       'lastSeen': FieldValue.serverTimestamp(),
  //     });
  //
  // NOTE: Do NOT migrate to nested location.{latitude,longitude,timestamp,accuracy}
  // without first updating all readers (React admin, distance helpers, TS types).
  // The current deployed codebase uses the FLAT currentLat/currentLng fields.
  // =========================================================================
}
