import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';

import '../models/partner_transaction.dart';
import 'firestore_paths.dart';
import 'settings_service.dart';

/// Service for partner financial transactions.
///
/// Firestore path: transactions/{txnId}
///
/// Fields per requirements: id, partnerId, type, title, orderNumber, orderId,
/// amount, method, status, utr, balanceBefore, balanceAfter,
/// createdAt, processedAt, remarks
class TransactionService {
  TransactionService._();

  static final FirebaseFirestore _db = FirebaseFirestore.instance;

  static CollectionReference<Map<String, dynamic>> get _txs =>
      _db.collection(FirestorePaths.transactions);

  /// Watch all transactions for a partner, sorted by createdAt descending.
  /// Per requirements: composite index on (partnerId ASC, createdAt DESC)
  static Stream<List<PartnerTransaction>> watchForPartner(String partnerId,
      {int limit = 50}) {
    return _txs
        .where('partnerId', isEqualTo: partnerId)
        .orderBy('createdAt', descending: true)
        .limit(limit)
        .snapshots()
        .map((snap) => snap.docs.map(PartnerTransaction.fromDoc).toList());
  }

  /// Get transactions (one-time fetch, paginated).
  static Future<List<PartnerTransaction>> getForPartner(
    String partnerId, {
    int limit = 50,
    DocumentSnapshot? startAfter,
  }) async {
    try {
      var query = _txs
          .where('partnerId', isEqualTo: partnerId)
          .orderBy('createdAt', descending: true)
          .limit(limit);

      if (startAfter != null) {
        query = query.startAfterDocument(startAfter);
      }

      final snap = await query.get();
      return snap.docs.map(PartnerTransaction.fromDoc).toList();
    } catch (e) {
      debugPrint('Error getting transactions: $e');
      return [];
    }
  }

  /// Watch only payout/withdrawal transactions.
  static Stream<List<PartnerTransaction>> watchPayouts(String partnerId) {
    return watchForPartner(partnerId).map((list) =>
        list.where((t) => t.isPayout || t.type == 'deduction').toList());
  }

  /// Watch only earnings (order_earning + tip) transactions.
  static Stream<List<PartnerTransaction>> watchEarnings(String partnerId) {
    return watchForPartner(partnerId).map((list) => list
        .where((t) => t.type == 'order_earning' || t.isTip)
        .toList());
  }

  /// Creates a pending withdrawal the admin can approve.
  ///
  /// Writes `transactions/{id}` (what the partner app watches) and
  /// `payoutRequests/{id}` (what the admin Withdraw Requests screen watches).
  static Future<void> requestWithdrawal({
    required String partnerId,
    required String partnerName,
    required int amount,
    required String upiId,
    String phone = '',
    int pocketAmount = 0,
    int tipAmount = 0,
  }) async {
    final settings = await SettingsService.getSettings(forceRefresh: true);
    final minAmount = settings.deliveryPartner.withdrawalMinAmount;
    final maxAmount = settings.deliveryPartner.withdrawalMaxAmount;
    if (minAmount > 0 && amount < minAmount) {
      throw Exception('Minimum withdrawal is ₹$minAmount');
    }
    if (maxAmount > 0 && amount > maxAmount) {
      throw Exception('Maximum withdrawal is ₹$maxAmount');
    }
    final id = 'wd_${partnerId}_${DateTime.now().millisecondsSinceEpoch}';
    final now = FieldValue.serverTimestamp();
    final requestedAt = DateTime.now().toIso8601String();

    final fromPocket = pocketAmount > 0 ? pocketAmount : amount;
    final fromTips = tipAmount > 0 ? tipAmount : 0;
    final remarks = fromTips > 0
        ? 'Awaiting admin approval (Pocket ₹$fromPocket + Tips ₹$fromTips)'
        : 'Awaiting admin approval';

    await _txs.doc(id).set({
      'id': id,
      'partnerId': partnerId,
      'partnerName': partnerName,
      'type': 'payout',
      'title': 'UPI Withdrawal → $upiId',
      'amount': amount,
      'pocketAmount': fromPocket,
      'tipAmount': fromTips,
      'method': 'upi',
      'upiId': upiId,
      'status': 'pending',
      'utr': '',
      'orderId': '',
      'orderNumber': '',
      'balanceBefore': 0,
      'balanceAfter': 0,
      'remarks': remarks,
      'payoutRequestId': id,
      'createdAt': now,
      'processedAt': null,
    });

    try {
      await _db.collection(FirestorePaths.payoutRequests).doc(id).set({
        'id': id,
        'deliveryBoyId': partnerId,
        'partnerId': partnerId,
        'partnerName': partnerName,
        'phone': phone,
        'requestedAmount': amount,
        'pocketAmount': fromPocket,
        'tipAmount': fromTips,
        'requestedAt': requestedAt,
        'status': 'PENDING',
        'upiId': upiId,
        'processingMethod': 'UPI',
        'transactionId': id,
        'idempotencyKey': id,
        'createdAt': requestedAt,
        'updatedAt': requestedAt,
      });
    } catch (e) {
      debugPrint('payoutRequests write failed, transaction is still pending: $e');
    }
  }

  /// Add a new transaction.
  ///
  /// Per requirements, Cloud Functions normally create transactions.
  /// This method exists for local testing / optimistic UI.
  static Future<void> add({
    required String partnerId,
    required String type,
    required String title,
    required int amount,
    String method = '',
    String orderId = '',
    String orderNumber = '',
    String status = 'completed',
    String utr = '',
    int balanceBefore = 0,
    int balanceAfter = 0,
    String remarks = '',
  }) {
    final id = 'tx_${partnerId}_${DateTime.now().millisecondsSinceEpoch}';
    final now = FieldValue.serverTimestamp();
    final autoUtr = utr.isNotEmpty
        ? utr
        : (type == 'payout' || type == 'withdrawal'
            ? 'UTR${DateTime.now().millisecondsSinceEpoch}'
            : '');
    return _txs.doc(id).set({
      'id': id,
      'partnerId': partnerId,
      'type': type,
      'title': title,
      'amount': amount,
      'method': method,
      'orderId': orderId,
      'orderNumber': orderNumber,
      'status': status,
      'utr': autoUtr,
      'balanceBefore': balanceBefore,
      'balanceAfter': balanceAfter,
      'remarks': remarks,
      'createdAt': now,
      'processedAt': status == 'completed' ? now : null,
    });
  }

  /// Calculate sum of credits for given transactions.
  static int sumCredits(List<PartnerTransaction> txs) => txs
      .where((t) => t.isCredit)
      .fold(0, (acc, t) => acc + t.amount.abs());

  /// Calculate sum of debits for given transactions.
  static int sumDebits(List<PartnerTransaction> txs) => txs
      .where((t) => !t.isCredit)
      .fold(0, (acc, t) => acc + t.amount.abs());

  /// Get net balance change for given transactions.
  static int netChange(List<PartnerTransaction> txs) =>
      sumCredits(txs) - sumDebits(txs);
}
