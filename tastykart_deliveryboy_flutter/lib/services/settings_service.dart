import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';

import 'firestore_paths.dart';

/// A single trip-count → bonus-amount incentive tier.
class IncentiveSlot {
  final int trips;
  final int amount;
  const IncentiveSlot({required this.trips, required this.amount});
}

/// A training module from admin settings.
class AdminTrainingModule {
  final String id;
  final String title;
  final String body;
  final String videoUrl;
  const AdminTrainingModule({
    required this.id,
    required this.title,
    required this.body,
    this.videoUrl = '',
  });
}

/// Platform settings from admin
class PlatformSettings {
  final DeliveryPartnerSettings deliveryPartner;
  final String supportPhone;
  final String supportEmail;
  final String termsUrl;
  final String privacyUrl;
  final String partnerAgreementUrl;
  final Map<String, bool> features;

  /// Minutes the delivery partner waits at restaurant after the prep timer
  /// expires before the "Transfer Order" option appears.
  /// Sourced from `settings/admin → delivery.partnerWaitMinutes`.
  final int partnerWaitMinutes;

  const PlatformSettings({
    required this.deliveryPartner,
    this.supportPhone = '',
    this.supportEmail = '',
    this.termsUrl = '',
    this.privacyUrl = '',
    this.partnerAgreementUrl = '',
    this.features = const {},
    this.partnerWaitMinutes = 10,
  });

  factory PlatformSettings.fromMap(Map<String, dynamic> map) {
    final dpData = DeliveryPartnerSettings.mapOf(map['deliveryPartner']);
    final featuresData = DeliveryPartnerSettings.mapOf(map['features']);
    final general = DeliveryPartnerSettings.mapOf(map['general']);
    final delivery = DeliveryPartnerSettings.mapOf(map['delivery']);

    final rawWait = delivery['partnerWaitMinutes'];
    final waitMin = rawWait is num ? rawWait.toInt().clamp(1, 120) : 10;

    return PlatformSettings(
      deliveryPartner: DeliveryPartnerSettings.fromMap(dpData),
      supportPhone: (general['supportPhone'] ?? map['supportPhone'] ?? '')
          .toString(),
      supportEmail: (general['supportEmail'] ?? map['supportEmail'] ?? '')
          .toString(),
      termsUrl: map['termsUrl']?.toString() ?? '',
      privacyUrl: map['privacyUrl']?.toString() ?? '',
      partnerAgreementUrl: map['partnerAgreementUrl']?.toString() ?? '',
      features: featuresData.map(
        (key, value) => MapEntry(key.toString(), value == true),
      ),
      partnerWaitMinutes: waitMin,
    );
  }

  bool isFeatureEnabled(String feature) => features[feature] ?? false;
}

/// Delivery partner specific settings
class DeliveryPartnerSettings {
  final int baseFee;
  final int perKmRate;
  final double minDistance;
  final double maxDistance;
  final int acceptanceTimeout;
  final int lateDeliveryThreshold;
  final int lateDeliveryPenalty;
  final int cashLimitDefault;
  final int withdrawalMinAmount;
  final int withdrawalMaxAmount;
  final int slotDuration;
  final List<String> requiredDocuments;

  /// Daily earnings target shown on the partner home screen progress bar.
  final int dailyTarget;

  /// Bonus credited when the partner hits the daily earnings target.
  final int dailyTargetBonus;

  /// Trip-count → bonus-amount tiers configured by admin.
  final List<IncentiveSlot> incentiveSlots;

  /// Training modules shown during onboarding — managed by admin.
  /// Empty means no modules were configured; callers fall back to AppConstants.
  final List<AdminTrainingModule> trainingModules;

  const DeliveryPartnerSettings({
    this.baseFee = 30,
    this.perKmRate = 8,
    this.minDistance = 1.0,
    this.maxDistance = 10.0,
    this.acceptanceTimeout = 120,
    this.lateDeliveryThreshold = 45,
    this.lateDeliveryPenalty = 20,
    this.cashLimitDefault = 10000,
    this.withdrawalMinAmount = 500,
    this.withdrawalMaxAmount = 50000,
    this.slotDuration = 4,
    this.requiredDocuments = const [],
    this.dailyTarget = 2000,
    this.dailyTargetBonus = 0,
    this.incentiveSlots = const [
      IncentiveSlot(trips: 15, amount: 110),
      IncentiveSlot(trips: 22, amount: 170),
      IncentiveSlot(trips: 25, amount: 225),
      IncentiveSlot(trips: 35, amount: 450),
    ],
    this.trainingModules = const [],
  });

  factory DeliveryPartnerSettings.fromMap(Map<String, dynamic> map) {
    List<String> docs = [];
    if (map['requiredDocuments'] is List) {
      docs = (map['requiredDocuments'] as List)
          .map((e) => e.toString())
          .toList();
    }

    // Parse incentiveSlots from Firestore list of maps
    final rawSlots = map['incentiveSlots'];
    final List<IncentiveSlot> slots;
    if (rawSlots is List && rawSlots.isNotEmpty) {
      slots =
          rawSlots
              .whereType<Map>()
              .map(
                (s) => IncentiveSlot(
                  trips: (s['trips'] as num?)?.toInt() ?? 0,
                  amount: (s['amount'] as num?)?.toInt() ?? 0,
                ),
              )
              .toList()
            ..sort((a, b) => a.trips.compareTo(b.trips));
    } else {
      slots = const [
        IncentiveSlot(trips: 15, amount: 110),
        IncentiveSlot(trips: 22, amount: 170),
        IncentiveSlot(trips: 25, amount: 225),
        IncentiveSlot(trips: 35, amount: 450),
      ];
    }

    return DeliveryPartnerSettings(
      baseFee: (map['baseFee'] as num?)?.toInt() ?? 30,
      perKmRate: (map['perKmRate'] as num?)?.toInt() ?? 8,
      minDistance: (map['minDistance'] as num?)?.toDouble() ?? 1.0,
      maxDistance: (map['maxDistance'] as num?)?.toDouble() ?? 10.0,
      acceptanceTimeout: (map['acceptanceTimeout'] as num?)?.toInt() ?? 120,
      lateDeliveryThreshold:
          (map['lateDeliveryThreshold'] as num?)?.toInt() ?? 45,
      lateDeliveryPenalty: (map['lateDeliveryPenalty'] as num?)?.toInt() ?? 20,
      cashLimitDefault: _asInt(map['cashLimitDefault'], 10000),
      withdrawalMinAmount: _asInt(map['withdrawalMinAmount'], 500),
      withdrawalMaxAmount: _asInt(map['withdrawalMaxAmount'], 50000),
      slotDuration: (map['slotDuration'] as num?)?.toInt() ?? 4,
      requiredDocuments: docs,
      dailyTarget: (map['dailyTarget'] as num?)?.toInt() ?? 2000,
      dailyTargetBonus: (map['dailyTargetBonus'] as num?)?.toInt() ?? 0,
      incentiveSlots: slots,
      trainingModules: _parseTrainingModules(map['trainingModules']),
    );
  }

  static Map<String, dynamic> mapOf(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) {
      return value.map((key, item) => MapEntry(key.toString(), item));
    }
    return {};
  }

  static int _asInt(dynamic value, int fallback) {
    if (value is num) return value.toInt();
    if (value is String) {
      final parsed = num.tryParse(value.trim());
      if (parsed != null) return parsed.toInt();
    }
    return fallback;
  }

  static List<AdminTrainingModule> _parseTrainingModules(dynamic raw) {
    if (raw is! List || raw.isEmpty) return const [];
    return raw
        .whereType<Map>()
        .map(
          (m) => AdminTrainingModule(
            id: (m['id'] as String? ?? '').trim(),
            title: (m['title'] as String? ?? '').trim(),
            body: (m['body'] as String? ?? '').trim(),
            videoUrl: (m['videoUrl'] as String? ?? '').trim(),
          ),
        )
        .where((m) => m.id.isNotEmpty && m.title.isNotEmpty)
        .toList();
  }

  int calculateDeliveryFee(double distance) {
    if (distance < minDistance) distance = minDistance;
    if (distance > maxDistance) distance = maxDistance;
    return baseFee + (perKmRate * distance).round();
  }

  /// Returns the bonus amount for the highest qualifying incentive tier,
  /// or 0 if no tier is reached.
  int incentiveFor(int trips) {
    var bonus = 0;
    for (final slot in incentiveSlots) {
      if (trips >= slot.trips) bonus = slot.amount;
    }
    return bonus;
  }
}

/// Service for fetching platform settings
class SettingsService {
  SettingsService._();

  static final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  static PlatformSettings? _cachedSettings;

  /// Get settings document reference
  static DocumentReference get _settingsDoc => _firestore
      .collection(FirestorePaths.settings)
      .doc(FirestorePaths.settingsAdminDoc);

  /// Watch settings stream
  static Stream<PlatformSettings> watchSettings() {
    return _settingsDoc.snapshots().map((doc) {
      if (!doc.exists) {
        debugPrint('Settings document does not exist');
        return const PlatformSettings(
          deliveryPartner: DeliveryPartnerSettings(),
        );
      }

      final data = DeliveryPartnerSettings.mapOf(doc.data());
      final settings = PlatformSettings.fromMap(data);
      _cachedSettings = settings;
      return settings;
    });
  }

  /// Get settings (one-time fetch)
  static Future<PlatformSettings> getSettings({
    bool forceRefresh = false,
  }) async {
    if (_cachedSettings != null && !forceRefresh) {
      return _cachedSettings!;
    }

    try {
      final doc = await _settingsDoc.get(
        GetOptions(
          source: forceRefresh ? Source.server : Source.serverAndCache,
        ),
      );

      if (!doc.exists) {
        debugPrint('Settings document does not exist');
        const defaultSettings = PlatformSettings(
          deliveryPartner: DeliveryPartnerSettings(),
        );
        _cachedSettings = defaultSettings;
        return defaultSettings;
      }

      final data = DeliveryPartnerSettings.mapOf(doc.data());
      final settings = PlatformSettings.fromMap(data);
      _cachedSettings = settings;
      return settings;
    } catch (e) {
      debugPrint('Error getting settings: $e');

      // Return cached settings if available
      if (_cachedSettings != null) {
        return _cachedSettings!;
      }

      // Return default settings
      const defaultSettings = PlatformSettings(
        deliveryPartner: DeliveryPartnerSettings(),
      );
      return defaultSettings;
    }
  }

  /// Get delivery partner settings only
  static Future<DeliveryPartnerSettings> getDeliveryPartnerSettings() async {
    final settings = await getSettings();
    return settings.deliveryPartner;
  }

  /// Check if feature is enabled
  static Future<bool> isFeatureEnabled(String feature) async {
    final settings = await getSettings();
    return settings.isFeatureEnabled(feature);
  }

  /// Get support contact info
  static Future<Map<String, String>> getSupportContact() async {
    final settings = await getSettings();
    return {'phone': settings.supportPhone, 'email': settings.supportEmail};
  }

  /// Get legal document URLs
  static Future<Map<String, String>> getLegalUrls() async {
    final settings = await getSettings();
    return {
      'terms': settings.termsUrl,
      'privacy': settings.privacyUrl,
      'partnerAgreement': settings.partnerAgreementUrl,
    };
  }

  /// Clear cached settings
  static void clearCache() {
    _cachedSettings = null;
  }
}
