import 'package:cloud_firestore/cloud_firestore.dart';

import 'booked_slot.dart';

/// Admin `deliveryPartners/{id}` account used for onboarding and block checks.
///
/// Flat location fields (NOT nested location.*) match the deployed admin UI:
///   currentLat / currentLng / lastLocationUpdate / lastSeen
class DeliveryPartner {
  final String id;
  final String uid;
  final String name;
  final String phone;
  final String email;
  final String city;
  final String gender;
  final String dateOfBirth;
  final String status;
  final bool approved;
  final String? blockedAt;
  final String? blockedReason;
  final String? avatar;
  final String vehicle;
  final String vehicleNumber;
  final Map<String, String> documents;
  final bool documentsComplete;
  final String accountHolderName;
  final String bankAccount;
  final String ifsc;
  final String upiId;
  final bool ifscVerified;
  final List<String> trainingCompleted;
  final bool trainingComplete;
  final bool termsAccepted;
  final List<String> legalAccepted;
  final bool activationAcknowledged;
  final bool bankDetailsConfirmed;
  final double rating;
  final int completedOrders;
  final int cancelledOrders;
  final num earnings;
  final List<BookedSlot> bookedSlots;
  final bool notificationsEnabled;
  final num pocketBalance;
  final num cashLimit;

  /// COD cash the partner is still holding for TastyKart.
  final num cashInHand;
  final num tipBalance;
  final double acceptRate;

  // Flat location fields (matches deployed readers — NOT nested location.*)
  final double? currentLat;
  final double? currentLng;
  final DateTime? lastLocationUpdate;
  final DateTime? lastSeen;

  /// When the current online session started. Cleared when they go offline.
  final DateTime? onlineSince;

  /// Minutes already completed in earlier sessions today.
  final int onlineMinutesToday;

  /// Calendar day those minutes belong to, `YYYY-MM-DD`.
  final String onlineMinutesDate;

  // FCM tokens (for push notifications)
  final List<String> fcmTokens;

  // Metadata
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const DeliveryPartner({
    required this.id,
    this.uid = '',
    this.name = '',
    this.phone = '',
    this.email = '',
    this.city = '',
    this.gender = '',
    this.dateOfBirth = '',
    this.status = 'offline',
    this.approved = false,
    this.blockedAt,
    this.blockedReason,
    this.avatar,
    this.vehicle = '',
    this.vehicleNumber = '',
    this.documents = const {},
    this.documentsComplete = false,
    this.accountHolderName = '',
    this.bankAccount = '',
    this.ifsc = '',
    this.upiId = '',
    this.ifscVerified = false,
    this.trainingCompleted = const [],
    this.trainingComplete = false,
    this.termsAccepted = false,
    this.legalAccepted = const [],
    this.activationAcknowledged = false,
    this.bankDetailsConfirmed = true,
    this.rating = 0,
    this.completedOrders = 0,
    this.cancelledOrders = 0,
    this.earnings = 0,
    this.bookedSlots = const [],
    this.notificationsEnabled = true,
    this.pocketBalance = 0,
    this.cashLimit = 0,
    this.cashInHand = 0,
    this.tipBalance = 0,
    this.acceptRate = 0,
    this.currentLat,
    this.currentLng,
    this.lastLocationUpdate,
    this.lastSeen,
    this.onlineSince,
    this.onlineMinutesToday = 0,
    this.onlineMinutesDate = '',
    this.fcmTokens = const [],
    this.createdAt,
    this.updatedAt,
  });

  bool get isBlocked => status.toLowerCase().trim() == 'blocked';

  bool get isOnline {
    final value = status.toLowerCase().trim();
    return value == 'available' || value == 'busy' || value == 'online';
  }

  bool get isBusy => status.toLowerCase().trim() == 'busy';

  String get firstName {
    final parts = name.trim().split(RegExp(r'\s+'));
    return parts.isEmpty ? '' : parts.first;
  }

  bool get hasCity => city.trim().isNotEmpty;

  bool get hasPersonalDetails =>
      name.trim().isNotEmpty &&
      dateOfBirth.trim().isNotEmpty &&
      gender.trim().isNotEmpty;

  bool get hasVehicle => vehicle.trim().isNotEmpty;

  bool get hasBankDetails =>
      bankDetailsConfirmed &&
      accountHolderName.trim().isNotEmpty &&
      bankAccount.trim().isNotEmpty &&
      ifsc.trim().isNotEmpty;

  bool get hasCompletedOnboarding =>
      hasCity &&
      hasPersonalDetails &&
      hasVehicle &&
      documentsComplete &&
      hasBankDetails &&
      trainingComplete &&
      termsAccepted;

  bool isDocumentUploaded(String id) {
    final url = documents[id];
    return url != null && url.trim().isNotEmpty;
  }

  bool hasAcceptedLegal(String id) => legalAccepted.contains(id);

  bool get awaitingApproval => termsAccepted && !approved;

  bool get showActivation => approved && !activationAcknowledged;

  String get blockMessage {
    final reason = blockedReason?.trim();
    if (reason != null && reason.isNotEmpty) {
      return 'Your account has been blocked. Contact support.\nReason: $reason';
    }
    return 'Your account has been blocked. Contact support.';
  }

  String get displayId {
    if (id.toUpperCase().startsWith('TS') && id.length >= 4) {
      return id.toUpperCase();
    }
    final digits = phone.replaceAll(RegExp(r'\D'), '');
    final tail = digits.length >= 6
        ? digits.substring(digits.length - 6)
        : (id.length >= 6 ? id.substring(id.length - 6) : id).toUpperCase();
    return 'TS$tail';
  }

  int get displayPocket => pocketBalance.round();

  int get cashInHandRupees => cashInHand.round();

  /// Partner-specific limit when set, otherwise the admin default.
  int effectiveCashLimit(int adminDefault) {
    if (cashLimit > 0) return cashLimit.round();
    return adminDefault > 0 ? adminDefault : 0;
  }

  /// COD cash held above the allowed limit — only this excess must be paid
  /// to TastyKart (not the full cash in hand). Cash in hand is not earnings.
  ///
  /// Master Formula Implementation:
  /// - Pocket Balance = Delivery Earnings + Bonuses + Incentives
  /// - Tip Balance = Tips (tracked separately)
  /// - Total Withdrawable = Pocket Balance + Tip Balance
  /// - Excess Cash = MAX(0, Cash In Hand - Cash Limit - Total Withdrawable)
  int cashDue(int limit) {
    if (limit <= 0) return 0;
    final held = cashInHandRupees;

    // Total withdrawable earnings (Pocket + Tips)
    // Partner can use ALL their earnings to offset what they owe
    final totalWithdrawable = displayPocket + tipBalance.round();

    // Excess Cash = MAX(0, Cash In Hand - Cash Limit - Total Earnings)
    final due = held - limit - totalWithdrawable;
    return due > 0 ? due : 0;
  }

  bool cashLimitExceeded(int limit) => cashDue(limit) > 0;

  /// Online minutes so far today, including the session that is still running.
  int onlineMinutesNow() {
    final now = DateTime.now();
    final today =
        '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    var minutes = onlineMinutesDate == today ? onlineMinutesToday : 0;
    final since = onlineSince;
    if (isOnline && since != null) {
      final startOfToday = DateTime(now.year, now.month, now.day);
      final start = since.isBefore(startOfToday) ? startOfToday : since;
      final extra = now.difference(start).inMinutes;
      if (extra > 0) minutes += extra;
    }
    return minutes;
  }

  bool isSlotBooked(String slotId, DateTime day) {
    final key =
        '${day.year}-${day.month.toString().padLeft(2, '0')}-${day.day.toString().padLeft(2, '0')}';
    return bookedSlots.any((slot) => slot.slotId == slotId && slot.date == key);
  }

  factory DeliveryPartner.fromMap(String id, Map<String, dynamic> map) {
    return DeliveryPartner(
      id: (map['id'] as String?)?.trim().isNotEmpty == true
          ? (map['id'] as String).trim()
          : id,
      uid: (map['uid'] as String?)?.trim().isNotEmpty == true
          ? (map['uid'] as String).trim()
          : id,
      name: (map['name'] as String? ?? '').trim(),
      phone: (map['phone'] as String? ?? '').trim(),
      email: (map['email'] as String? ?? '').trim(),
      city: (map['city'] as String? ?? '').trim(),
      gender: (map['gender'] as String? ?? '').trim(),
      dateOfBirth: (map['dateOfBirth'] as String? ?? '').trim(),
      status: (map['status'] as String? ?? 'offline').trim(),
      approved: map['approved'] == true,
      blockedAt: map['blockedAt']?.toString(),
      blockedReason: map['blockedReason'] as String?,
      avatar: map['avatar'] as String?,
      vehicle: (map['vehicle'] as String? ?? '').trim(),
      vehicleNumber: (map['vehicleNumber'] as String? ?? '').trim(),
      documents: _stringMap(map['documents']),
      documentsComplete: map['documentsComplete'] == true,
      accountHolderName: (map['accountHolderName'] as String? ?? '').trim(),
      bankAccount: (map['bankAccount'] as String? ?? '').trim(),
      ifsc: (map['ifsc'] as String? ?? '').trim(),
      upiId: (map['upiId'] as String? ?? '').trim(),
      ifscVerified: map['ifscVerified'] == true,
      trainingCompleted: _stringList(map['trainingCompleted']),
      trainingComplete: map['trainingComplete'] == true,
      termsAccepted: map['termsAccepted'] == true,
      legalAccepted: _stringList(map['legalAccepted']),
      activationAcknowledged: map['activationAcknowledged'] == true,
      rating: (map['rating'] as num? ?? 0).toDouble(),
      completedOrders: (map['completedOrders'] as num? ?? 0).toInt(),
      cancelledOrders: (map['cancelledOrders'] as num? ?? 0).toInt(),
      earnings: map['earnings'] as num? ?? 0,
      bookedSlots: _bookedSlots(map['bookedSlots']),
      notificationsEnabled: map['notificationsEnabled'] != false,
      pocketBalance:
          map['pocketBalance'] as num? ?? (map['earnings'] as num? ?? 0),
      cashLimit: map['cashLimit'] as num? ?? 0,
      cashInHand: map['cashInHand'] as num? ?? 0,
      tipBalance: map['tipBalance'] as num? ?? 0,
      acceptRate: (map['acceptRate'] as num? ?? 0).toDouble(),
      // Flat location fields (NOT nested location.*)
      currentLat: _asDouble(map['currentLat']),
      currentLng: _asDouble(map['currentLng']),
      lastLocationUpdate: _asDate(map['lastLocationUpdate']),
      lastSeen: _asDate(map['lastSeen']),
      onlineSince: _asDate(map['onlineSince']),
      onlineMinutesToday: (map['onlineMinutesToday'] as num?)?.toInt() ?? 0,
      onlineMinutesDate: (map['onlineMinutesDate'] as String? ?? '').trim(),
      bankDetailsConfirmed: map['bankDetailsConfirmed'] != false,
      // FCM tokens
      fcmTokens: _stringList(map['fcmTokens']),
      // Metadata
      createdAt: _asDate(map['createdAt']),
      updatedAt: _asDate(map['updatedAt']),
    );
  }

  static DateTime? _asDate(dynamic raw) {
    if (raw is Timestamp) return raw.toDate();
    return null;
  }

  static double? _asDouble(dynamic value) {
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value);
    return null;
  }

  static List<BookedSlot> _bookedSlots(dynamic raw) {
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map((e) => BookedSlot.fromMap(Map<String, dynamic>.from(e)))
        .where((slot) => slot.slotId.isNotEmpty && slot.date.isNotEmpty)
        .toList();
  }

  static Map<String, String> _stringMap(dynamic raw) {
    if (raw is! Map) return {};
    final out = <String, String>{};
    raw.forEach((key, value) {
      final url = value?.toString().trim() ?? '';
      if (url.isNotEmpty) out[key.toString()] = url;
    });
    return out;
  }

  static List<String> _stringList(dynamic raw) {
    if (raw is! List) return const [];
    return raw.map((e) => e.toString()).where((e) => e.isNotEmpty).toList();
  }
}

/// Thrown when Admin blocked this delivery partner.
class PartnerBlockedException implements Exception {
  PartnerBlockedException(this.partner);

  final DeliveryPartner partner;

  String get message => partner.blockMessage;

  @override
  String toString() => message;
}

/// Thrown when the signed-in Auth user is not a delivery partner.
class WrongAppRoleException implements Exception {
  WrongAppRoleException(this.role);

  final String role;

  String get message =>
      'This account is not registered as a delivery partner. Use the TastyKart customer or admin app.';

  @override
  String toString() => message;
}
