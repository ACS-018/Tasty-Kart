import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';

import '../constants/app_constants.dart';
import '../models/delivery_partner.dart';
import 'fcm_service.dart';
import 'firestore_paths.dart';
import 'settings_service.dart';

/// Resolves Admin `deliveryPartners` docs and enforces block status.
class DeliveryPartnerService {
  DeliveryPartnerService._();

  static final FirebaseFirestore _db = FirebaseFirestore.instance;

  static CollectionReference<Map<String, dynamic>> get _partners =>
      _db.collection(FirestorePaths.deliveryPartners);

  static Future<DeliveryPartner?> resolveForUser(
    User user, {
    Source source = Source.serverAndCache,
  }) async {
    final byUid = await _partners.doc(user.uid).get(GetOptions(source: source));
    if (byUid.exists && byUid.data() != null) {
      return DeliveryPartner.fromMap(byUid.id, byUid.data()!);
    }

    final phone = user.phoneNumber?.trim();
    if (phone != null && phone.isNotEmpty) {
      final byPhone = await _partners
          .where('phone', isEqualTo: phone)
          .limit(1)
          .get(GetOptions(source: source));
      if (byPhone.docs.isNotEmpty) {
        final doc = byPhone.docs.first;
        return DeliveryPartner.fromMap(doc.id, doc.data());
      }

      final digits = phone.replaceAll(RegExp(r'\D'), '');
      if (digits.length >= 10) {
        final last10 = digits.substring(digits.length - 10);
        final variants = <String>{
          phone,
          '+$digits',
          digits,
          last10,
          '+91$last10',
        };
        for (final variant in variants) {
          final snap = await _partners
              .where('phone', isEqualTo: variant)
              .limit(1)
              .get(GetOptions(source: source));
          if (snap.docs.isNotEmpty) {
            final doc = snap.docs.first;
            return DeliveryPartner.fromMap(doc.id, doc.data());
          }
        }
      }
    }

    return null;
  }

  static Future<String> docIdFor(User user) async {
    final resolved = await resolveForUser(user);
    return resolved?.id ?? user.uid;
  }

  static Stream<DeliveryPartner?> watchForUser(User user) async* {
    final phone = user.phoneNumber?.trim();
    if (phone == null || phone.isEmpty) {
      yield* watchById(user.uid);
      return;
    }
    final resolved = await resolveForUser(user);
    yield* watchById(resolved?.id ?? user.uid);
  }

  static Stream<DeliveryPartner?> watchById(String partnerId) {
    return _partners.doc(partnerId).snapshots().map((snap) {
      if (!snap.exists || snap.data() == null) return null;
      return DeliveryPartner.fromMap(snap.id, snap.data()!);
    });
  }

  static Future<DeliveryPartner?> assertNotBlocked(User user) async {
    // Always fetch from the server so an admin unblock is reflected immediately
    // — the local Firestore cache may still hold the old `status: 'blocked'`
    // value and would incorrectly force-logout a partner who was just unblocked.
    final snap = await _partners
        .doc(user.uid)
        .get(const GetOptions(source: Source.server));
    DeliveryPartner? partner;
    if (snap.exists && snap.data() != null) {
      partner = DeliveryPartner.fromMap(snap.id, snap.data()!);
    } else {
      // Fallback: uid-based lookup failed — try phone matching.
      // Force server-only here too so a stale cached 'blocked' doc
      // doesn't prevent a partner who was just unblocked from logging in.
      partner = await resolveForUser(user, source: Source.server);
    }
    if (partner != null && partner.isBlocked) {
      throw PartnerBlockedException(partner);
    }
    return partner;
  }

  static bool isBlockedPartner(DeliveryPartner? partner) =>
      partner != null && partner.isBlocked;

  static Future<void> _merge(String partnerId, Map<String, dynamic> data) {
    return _partners.doc(partnerId).set({
      'id': partnerId,
      ...data,
      'updatedAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  }

  static Future<void> updateCity({
    required String partnerId,
    required String city,
  }) {
    return _merge(partnerId, {'city': city.trim()});
  }

  /// Streams active city names from the admin `cities` collection.
  /// Returns null when the collection is empty so callers can fall back to
  /// [AppConstants.cities].
  static Stream<List<String>?> streamActiveCityNames() {
    return _db
        .collection(FirestorePaths.cities)
        .where('isActive', isEqualTo: true)
        .snapshots()
        .map((snap) {
          if (snap.docs.isEmpty) return null;
          final names =
              snap.docs
                  .map((d) {
                    final name = (d.data()['name'] as String? ?? '').trim();
                    final display = (d.data()['displayName'] as String? ?? '')
                        .trim();
                    return display.isNotEmpty ? display : name;
                  })
                  .where((n) => n.isNotEmpty)
                  .toList()
                ..sort();
          return names.isEmpty ? null : names;
        });
  }

  static Future<void> updatePersonalDetails({
    required String partnerId,
    required String name,
    required String dateOfBirth,
    required String gender,
  }) async {
    await _merge(partnerId, {
      'name': name.trim(),
      'dateOfBirth': dateOfBirth.trim(),
      'gender': gender.trim(),
    });
    await _db.collection(FirestorePaths.users).doc(partnerId).set({
      'name': name.trim(),
      'updatedAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  }

  static Future<void> updateVehicle({
    required String partnerId,
    required String vehicle,
  }) {
    return _merge(partnerId, {'vehicle': vehicle.trim()});
  }

  /// Clears vehicle so AuthGate steps back to PersonalDetailsScreen.
  static Future<void> clearVehicle({required String partnerId}) {
    return _merge(partnerId, {'vehicle': ''});
  }

  /// Clears documentsComplete so AuthGate steps back to UploadDocumentsScreen.
  static Future<void> clearDocumentsComplete({required String partnerId}) {
    return _merge(partnerId, {'documentsComplete': false});
  }

  /// Clears all uploaded document URLs AND documentsComplete — used when the
  /// partner goes back from the upload screen so it starts fresh next time.
  static Future<void> clearDocuments({required String partnerId}) {
    return _merge(partnerId, {
      'documentsComplete': false,
      'documents': <String, dynamic>{},
    });
  }

  /// Clears bank details so AuthGate steps back to BankDetailsScreen.
  static Future<void> clearBankDetails({required String partnerId}) {
    return _merge(partnerId, {
      'accountHolderName': '',
      'bankAccount': '',
      'ifsc': '',
      'upiId': '',
      'ifscVerified': false,
    });
  }

  /// Clears trainingComplete so AuthGate steps back to OnlineTrainingScreen.
  static Future<void> clearTrainingComplete({required String partnerId}) {
    return _merge(partnerId, {'trainingComplete': false});
  }

  static Future<void> saveDocumentUrl({
    required String partnerId,
    required String documentId,
    required String url,
  }) {
    return _partners.doc(partnerId).update({
      'documents.$documentId': url,
      if (documentId == 'profilePhoto') 'avatar': url,
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  static Future<void> markDocumentsComplete({required String partnerId}) {
    return _merge(partnerId, {'documentsComplete': true});
  }

  static Future<void> updateBankDetails({
    required String partnerId,
    required String accountHolderName,
    required String bankAccount,
    required String ifsc,
    required String upiId,
    required bool ifscVerified,
  }) {
    return _merge(partnerId, {
      'accountHolderName': accountHolderName.trim(),
      'bankAccount': bankAccount.trim(),
      'ifsc': ifsc.trim().toUpperCase(),
      'upiId': upiId.trim(),
      'ifscVerified': ifscVerified,
    });
  }

  static Future<void> markTrainingModule({
    required String partnerId,
    required String moduleId,
  }) {
    return _merge(partnerId, {
      'trainingCompleted': FieldValue.arrayUnion([moduleId]),
    });
  }

  static Future<void> markTrainingComplete({required String partnerId}) {
    final ids = AppConstants.trainingModules.map((m) => m.id).toList();
    return _merge(partnerId, {
      'trainingComplete': true,
      'trainingCompleted': ids,
    });
  }

  static Future<void> acceptLegalPage({
    required String partnerId,
    required String pageId,
    bool completeTerms = false,
  }) {
    return _merge(partnerId, {
      'legalAccepted': FieldValue.arrayUnion([pageId]),
      if (completeTerms) ...{
        'termsAccepted': true,
        'termsAcceptedAt': FieldValue.serverTimestamp(),
      },
    });
  }

  static Future<void> acceptTerms({required String partnerId}) {
    return _merge(partnerId, {
      'termsAccepted': true,
      'termsAcceptedAt': FieldValue.serverTimestamp(),
    });
  }

  /// Removes [pageId] from `legalAccepted` so AuthGate steps back to that
  /// legal page. Also resets termsAccepted when clearing the final page.
  static Future<void> clearLegalPage({
    required String partnerId,
    required String pageId,
    bool resetTerms = false,
  }) {
    return _merge(partnerId, {
      'legalAccepted': FieldValue.arrayRemove([pageId]),
      if (resetTerms) ...{
        'termsAccepted': false,
      },
    });
  }

  /// Clears all legal acceptance — steps AuthGate back to OnlineTrainingScreen.
  static Future<void> clearAllLegal({required String partnerId}) {
    return _merge(partnerId, {
      'legalAccepted': <String>[],
      'termsAccepted': false,
    });
  }

  static Future<void> acknowledgeActivation({required String partnerId}) {
    return _merge(partnerId, {'activationAcknowledged': true});
  }

  static String _dayKey(DateTime time) {
    return '${time.year}-${time.month.toString().padLeft(2, '0')}-${time.day.toString().padLeft(2, '0')}';
  }

  static bool _isOnDuty(String status) {
    final value = status.toLowerCase().trim();
    return value == 'online' || value == 'busy' || value == 'available';
  }

  /// Fields that keep today's online minutes in sync with a duty change.
  static Map<String, dynamic> _clockPatch({
    required Map<String, dynamic> data,
    required bool goingOffline,
    required bool startingSession,
  }) {
    final now = DateTime.now();
    final today = _dayKey(now);
    final startOfToday = DateTime(now.year, now.month, now.day);
    final storedDay = (data['onlineMinutesDate'] ?? '').toString();
    var minutes = storedDay == today
        ? ((data['onlineMinutesToday'] as num?)?.toInt() ?? 0)
        : 0;
    final sinceRaw = data['onlineSince'];
    final since = sinceRaw is Timestamp ? sinceRaw.toDate() : null;

    if (goingOffline && since != null) {
      final start = since.isBefore(startOfToday) ? startOfToday : since;
      final extra = now.difference(start).inMinutes;
      if (extra > 0) minutes += extra;
    }

    return {
      'onlineMinutesDate': today,
      'onlineMinutesToday': minutes,
      if (goingOffline) 'onlineSince': FieldValue.delete(),
      if (startingSession && since == null)
        'onlineSince': FieldValue.serverTimestamp(),
    };
  }

  static Future<void> _writeDuty({
    required String partnerId,
    required String status,
    Map<String, dynamic> extra = const {},
  }) async {
    final ref = _partners.doc(partnerId);
    await _db.runTransaction((tx) async {
      final snap = await tx.get(ref);
      final data = snap.data() ?? {};
      final wasOnDuty = _isOnDuty((data['status'] ?? '').toString());
      final goingOffline = !_isOnDuty(status);
      final patch = _clockPatch(
        data: data,
        goingOffline: goingOffline,
        startingSession: !goingOffline && !wasOnDuty,
      );
      tx.set(ref, {
        'status': status,
        ...patch,
        ...extra,
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
    });
  }

  /// Starts today's clock if the partner is already online and no session
  /// start was saved yet.
  static Future<void> touchOnlineSession(String partnerId) async {
    final ref = _partners.doc(partnerId);
    await _db.runTransaction((tx) async {
      final snap = await tx.get(ref);
      final data = snap.data() ?? {};
      if (!_isOnDuty((data['status'] ?? '').toString())) return;
      if (data['onlineSince'] is Timestamp) return;
      final patch = _clockPatch(
        data: data,
        goingOffline: false,
        startingSession: true,
      );
      tx.set(ref, {
        ...patch,
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
    });
  }

  /// Credits the admin daily-target bonus into the wallet once per day.
  static Future<void> creditDailyTargetBonus({
    required String partnerId,
    required String partnerName,
    required int earnedToday,
  }) async {
    if (earnedToday <= 0) return;
    // Force a fresh server read so we always use the latest admin-configured
    // target and bonus — stale cached settings with dailyTargetBonus=0 would
    // cause the early-return guard below to silently skip the credit.
    final settings = await SettingsService.getSettings(forceRefresh: true);
    final target = settings.deliveryPartner.dailyTarget;
    final bonus = settings.deliveryPartner.dailyTargetBonus;
    if (target <= 0 || bonus <= 0 || earnedToday < target) return;

    final today = _dayKey(DateTime.now());
    final ref = _partners.doc(partnerId);
    // Shared with the onOrderDeliveredDailyBonus Cloud Function: whichever
    // runs first creates this doc, the other sees it and skips.
    final bonusRef = _db
        .collection(FirestorePaths.transactions)
        .doc('bonus_${partnerId}_$today');
    try {
      await _db.runTransaction((tx) async {
        final snap = await tx.get(ref);
        final existing = await tx.get(bonusRef);
        if (existing.exists) return;
        final data = snap.data() ?? {};
        final balance = (data['pocketBalance'] as num?)?.toInt() ?? 0;
        final storedDay = (data['dailyTargetBonusDate'] ?? '').toString();
        tx.set(ref, {
          if (storedDay.compareTo(today) < 0) 'dailyTargetBonusDate': today,
          'pocketBalance': FieldValue.increment(bonus),
          'updatedAt': FieldValue.serverTimestamp(),
        }, SetOptions(merge: true));
        tx.set(bonusRef, {
          'id': bonusRef.id,
          'partnerId': partnerId,
          'partnerName': partnerName,
          'type': 'bonus',
          'title': 'Daily target reward',
          'amount': bonus,
          'method': 'wallet',
          'status': 'completed',
          'orderId': '',
          'orderNumber': '',
          'balanceBefore': balance,
          'balanceAfter': balance + bonus,
          'remarks': 'Today\'s target completed',
          'createdAt': FieldValue.serverTimestamp(),
          'processedAt': FieldValue.serverTimestamp(),
        });
      });
    } catch (e) {
      debugPrint('[DailyBonus] credit failed: $e');
    }
  }

  static Future<void> setOnline({
    required String partnerId,
    required bool online,
    required String currentStatus,
  }) async {
    final value = currentStatus.toLowerCase().trim();
    if (value == 'blocked') return;
    if (online && await isOverCashLimit(partnerId)) {
      await _writeDuty(partnerId: partnerId, status: 'offline');
      throw const CashLimitException();
    }
    final next = online ? (value == 'busy' ? 'busy' : 'online') : 'offline';
    await _writeDuty(partnerId: partnerId, status: next);
  }

  /// Adds collected COD to cash in hand. Returns true when that crosses the limit
  /// and the partner has been set offline.
  static Future<bool> recordCashCollected({
    required String partnerId,
    required int amount,
  }) async {
    if (amount <= 0) return false;
    final settings = await SettingsService.getSettings(forceRefresh: true);
    final adminDefault = settings.deliveryPartner.cashLimitDefault;
    final ref = _partners.doc(partnerId);
    var over = false;
    await _db.runTransaction((tx) async {
      final snap = await tx.get(ref);
      final data = snap.data() ?? {};
      final personal = (data['cashLimit'] as num?)?.toInt() ?? 0;
      final limit = personal > 0 ? personal : adminDefault;
      final current = (data['cashInHand'] as num?)?.toInt() ?? 0;
      final next = current + amount;
      over = limit > 0 && next >= limit;
      final clock = over
          ? _clockPatch(data: data, goingOffline: true, startingSession: false)
          : const <String, dynamic>{};
      tx.set(ref, {
        'cashInHand': next,
        if (over) 'status': 'offline',
        ...clock,
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
    });
    return over;
  }

  static Future<bool> isOverCashLimit(String partnerId) async {
    final settings = await SettingsService.getSettings(forceRefresh: true);
    final snap = await _partners.doc(partnerId).get();
    final data = snap.data() ?? {};
    final personal = (data['cashLimit'] as num?)?.toInt() ?? 0;
    final limit = personal > 0
        ? personal
        : settings.deliveryPartner.cashLimitDefault;
    if (limit <= 0) return false;
    final held = (data['cashInHand'] as num?)?.toInt() ?? 0;
    return held > 0 && held >= limit;
  }

  /// Sets an online (not mid-trip) partner offline when their cash in hand has
  /// reached the limit. Returns true when the partner was taken offline.
  static Future<bool> enforceCashLimit(String partnerId) async {
    final snap = await _partners.doc(partnerId).get();
    final status = (snap.data()?['status'] ?? '').toString().toLowerCase().trim();
    if (status != 'online' && status != 'available') return false;
    if (!await isOverCashLimit(partnerId)) return false;
    await _writeDuty(partnerId: partnerId, status: 'offline');
    return true;
  }

  static const _terminalOrderStatuses = <String>{'delivered', 'cancelled', 'refunded'};

  /// If the partner doc still shows BUSY and/or currentOrder pointing at a
  /// terminal (or missing) order, clear BUSY back to ONLINE and drop the
  /// stale currentOrder reference. This runs on every app launch / partner
  /// stream emission and is the client-side safety net that matches the
  /// admin-side reconciliation.
  static Future<bool> reconcileStuckBusy(String partnerId) async {
    try {
      final partnerSnap = await _partners.doc(partnerId).get();
      if (!partnerSnap.exists) return false;
      final p = partnerSnap.data() ?? {};
      final status = (p['status'] as String? ?? 'offline').toLowerCase().trim();
      final currentOrderId = (p['currentOrder'] as String? ?? '').trim();

      // Quick-return: partner is not BUSY and has no dangling currentOrder.
      final looksStuck = status == 'busy' || currentOrderId.isNotEmpty;
      if (!looksStuck) return false;

      // Pull the order pointed to by currentOrderId (or any recent order
      // assigned to this partner) to check if it's still live.
      bool hasLiveOrder = false;
      if (currentOrderId.isNotEmpty) {
        try {
          final orderSnap = await _db.collection('orders').doc(currentOrderId).get();
          if (orderSnap.exists) {
            final orderData = orderSnap.data() ?? {};
            final orderStatus = (orderData['status'] as String? ?? '').toLowerCase().trim();
            hasLiveOrder = !_terminalOrderStatuses.contains(orderStatus) &&
                (orderData['deliveryPartnerId'] as String? ?? '') == partnerId;
          }
        } catch (_) { /* assume stale */ }
      }

      // Fallback check: scan last 20 assigned orders for any non-terminal one.
      if (!hasLiveOrder) {
        try {
          final recent = await _db
              .collection('orders')
              .where('deliveryPartnerId', isEqualTo: partnerId)
              .limit(20)
              .get();
          hasLiveOrder = recent.docs.any((d) {
            final s = (d.data()['status'] as String? ?? '').toLowerCase().trim();
            return !_terminalOrderStatuses.contains(s);
          });
        } catch (_) { /* missing idx -> ignore */ }
      }

      if (hasLiveOrder) return false; // legitimately BUSY — leave alone

      // No live order found but doc says BUSY / has currentOrder — unstick.
      final over = await isOverCashLimit(partnerId);
      final nextStatus = over ? 'offline' : (status == 'blocked' ? 'blocked' : 'online');
      await _writeDuty(
        partnerId: partnerId,
        status: nextStatus,
        extra: {'currentOrder': FieldValue.delete()},
      );
      return true;
    } catch (e) {
      // Network blip / offline — skip this round; the periodic call will retry.
      return false;
    }
  }

  static Future<void> setBusy({
    required String partnerId,
    required String orderId,
  }) async {
    // Before marking BUSY, validate that the order exists AND is assigned to
    // this partner. If not, this is a stray click and we shouldn't lock them
    // into BUSY for eternity.
    try {
      final orderSnap = await _db.collection('orders').doc(orderId).get();
      if (orderSnap.exists) {
        final data = orderSnap.data() ?? {};
        final assigned = (data['deliveryPartnerId'] as String? ?? '') == partnerId ||
            (data['deliveryPartnerId'] as String? ?? '').isEmpty;
        if (!assigned) {
          throw StateError('Order $orderId is assigned to a different partner');
        }
        final s = (data['status'] as String? ?? '').toLowerCase();
        if (_terminalOrderStatuses.contains(s)) {
          throw StateError('Cannot go BUSY on a $s order');
        }
      }
    } catch (e) {
      rethrow;
    }
    return _writeDuty(
      partnerId: partnerId,
      status: 'busy',
      extra: {'currentOrder': orderId},
    );
  }

  static Future<void> setAvailable({required String partnerId}) async {
    final over = await isOverCashLimit(partnerId);
    return _writeDuty(
      partnerId: partnerId,
      status: over ? 'offline' : 'online',
      extra: {'currentOrder': FieldValue.delete()},
    );
  }

  static Future<void> completeTrip({
    required String partnerId,
    required int payout,
  }) async {
    final over = await isOverCashLimit(partnerId);
    final ref = _partners.doc(partnerId);
    await _db.runTransaction((tx) async {
      final snap = await tx.get(ref);
      final data = snap.data() ?? {};
      final clock = over
          ? _clockPatch(data: data, goingOffline: true, startingSession: false)
          : const <String, dynamic>{};
      tx.set(ref, {
        'status': over ? 'offline' : 'online',
        'currentOrder': FieldValue.delete(),
        'completedOrders': FieldValue.increment(1),
        'earnings': FieldValue.increment(payout),
        'pocketBalance': FieldValue.increment(payout),
        ...clock,
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
    });
  }

  static Future<void> updateProfile({
    required String partnerId,
    required String name,
    required String email,
    required String phone,
    String? avatar,
  }) async {
    final data = {
      'name': name.trim(),
      'email': email.trim(),
      'phone': phone.trim(),
      if (avatar != null && avatar.isNotEmpty) 'avatar': avatar,
    };
    await Future.wait([
      _merge(partnerId, data),
      _db
          .collection(FirestorePaths.users)
          .doc(partnerId)
          .set({
            ...data,
            'updatedAt': FieldValue.serverTimestamp(),
          }, SetOptions(merge: true))
          .catchError((_) {}),
    ]);
  }

  static Future<void> setNotificationsEnabled({
    required String partnerId,
    required bool enabled,
  }) async {
    // 1. Update the Firestore flag so the admin panel's loggedIn/token filter
    //    and this field are both consistent.
    await _merge(partnerId, {'notificationsEnabled': enabled});
    await FCMService.syncPartnerPreference(
      partnerId: partnerId,
      enabled: enabled,
    );
  }

  static Future<void> adjustWallet({
    required String partnerId,
    required int delta,
    int tipDelta = 0,
  }) {
    return _merge(partnerId, {
      'pocketBalance': FieldValue.increment(delta),
      if (tipDelta != 0) 'tipBalance': FieldValue.increment(tipDelta),
    });
  }

  static Future<String> supportEmail() async {
    final snap = await _db
        .collection(FirestorePaths.settings)
        .doc(FirestorePaths.settingsAdminDoc)
        .get();
    final general = snap.data()?['general'];
    if (general is Map) {
      final email = (general['supportEmail'] ?? '').toString().trim();
      if (email.isNotEmpty) return email;
    }
    return '';
  }

  static Future<String> supportPhone() async {
    final snap = await _db
        .collection(FirestorePaths.settings)
        .doc(FirestorePaths.settingsAdminDoc)
        .get();
    final general = snap.data()?['general'];
    if (general is Map) {
      final phone = (general['supportPhone'] ?? '').toString().trim();
      if (phone.isNotEmpty) return phone;
    }
    return '112';
  }
}

class CashLimitException implements Exception {
  const CashLimitException();
}
