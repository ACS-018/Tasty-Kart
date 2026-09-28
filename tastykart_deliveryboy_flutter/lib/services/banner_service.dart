import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';

import '../models/app_banner.dart';
import 'firestore_paths.dart';

/// Service for fetching promotional banners.
///
/// Firestore path: banners/{bannerId}
/// Fields per requirements: id, title, description, imageUrl, targetScreen,
///   actionUrl, active, priority, startDate, endDate, createdAt
class BannerService {
  BannerService._();

  static final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  /// Get banners collection reference
  static CollectionReference get _bannersCollection =>
      _firestore.collection(FirestorePaths.banners);

  /// Watch active banners stream (date-range filtered).
  static Stream<List<AppBanner>> watchActiveBanners() {
    return _bannersCollection
        .where('active', isEqualTo: true)
        .orderBy('priority', descending: true)
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map(AppBanner.fromDoc)
            .where((b) => b.isCurrentlyActive)
            .toList());
  }

  /// Get active banners (one-time fetch, date-range filtered).
  static Future<List<AppBanner>> getActiveBanners() async {
    try {
      final snapshot = await _bannersCollection
          .where('active', isEqualTo: true)
          .orderBy('priority', descending: true)
          .orderBy('createdAt', descending: true)
          .get();

      return snapshot.docs
          .map(AppBanner.fromDoc)
          .where((b) => b.isCurrentlyActive)
          .toList();
    } catch (e) {
      debugPrint('Error getting active banners: $e');
      return [];
    }
  }

  /// Get banners for specific screen (targetScreen filter).
  static Future<List<AppBanner>> getBannersForScreen(String screenName) async {
    try {
      final snapshot = await _bannersCollection
          .where('active', isEqualTo: true)
          .where('targetScreen', isEqualTo: screenName)
          .orderBy('priority', descending: true)
          .get();

      return snapshot.docs
          .map(AppBanner.fromDoc)
          .where((b) => b.isCurrentlyActive)
          .toList();
    } catch (e) {
      debugPrint('Error getting banners for screen $screenName: $e');
      return [];
    }
  }

  /// Get banner by ID
  static Future<AppBanner?> getBannerById(String bannerId) async {
    try {
      final doc = await _bannersCollection.doc(bannerId).get();
      if (!doc.exists) return null;
      return AppBanner.fromDoc(doc);
    } catch (e) {
      debugPrint('Error getting banner: $e');
      return null;
    }
  }

  /// Track banner view (optional analytics)
  static Future<void> trackBannerView(String bannerId) async {
    try {
      await _bannersCollection.doc(bannerId).update({
        'views': FieldValue.increment(1),
      });
    } catch (e) {
      debugPrint('Error tracking banner view: $e');
    }
  }

  /// Track banner click (optional analytics)
  static Future<void> trackBannerClick(String bannerId) async {
    try {
      await _bannersCollection.doc(bannerId).update({
        'clicks': FieldValue.increment(1),
      });
    } catch (e) {
      debugPrint('Error tracking banner click: $e');
    }
  }
}
