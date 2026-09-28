import 'package:cloud_firestore/cloud_firestore.dart';

/// Financial transaction for a delivery partner.
///
/// Firestore path: transactions/{txnId}
///
/// Types per FIREBASE_BACKEND_REQUIREMENTS.md:
///   order_earning, payout, withdrawal, deduction, late_delivery, tip, tip_deduction
class PartnerTransaction {
  const PartnerTransaction({
    required this.id,
    this.partnerId = '',
    this.type = '',
    this.title = '',
    this.orderId = '',
    this.orderNumber = '',
    this.amount = 0,
    this.method = '',
    this.status = '',
    this.utr = '',
    this.balanceBefore = 0,
    this.balanceAfter = 0,
    this.remarks = '',
    this.createdAt,
    this.processedAt,
  });

  final String id;
  final String partnerId;
  final String type;
  final String title;
  final String orderId;
  final String orderNumber;
  final int amount;
  final String method;
  final String status;
  final String utr;
  final int balanceBefore;
  final int balanceAfter;
  final String remarks;
  final DateTime? createdAt;
  final DateTime? processedAt;

  bool get isCredit {
    switch (type) {
      case 'payout':
      case 'withdrawal':
      case 'deduction':
      case 'late_delivery':
      case 'tip_deduction':
        return false;
      default:
        return true;
    }
  }

  bool get isPayout => type == 'payout' || type == 'withdrawal';

  bool get isDeduction =>
      type == 'deduction' || type == 'late_delivery' || isPayout;

  bool get isTipDeduction => type == 'tip_deduction';

  bool get isTip => type == 'tip';

  bool get isFailed => status.toLowerCase() == 'failed';

  bool get isPending => status.toLowerCase() == 'pending';

  int get displayAmount => isCredit ? amount.abs() : -amount.abs();

  factory PartnerTransaction.fromDoc(DocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>? ?? {};

    DateTime? created;
    final createdRaw = d['createdAt'];
    if (createdRaw is Timestamp) created = createdRaw.toDate();

    DateTime? processed;
    final processedRaw = d['processedAt'];
    if (processedRaw is Timestamp) processed = processedRaw.toDate();

    return PartnerTransaction(
      id: d['id']?.toString() ?? doc.id,
      partnerId: d['partnerId']?.toString() ?? '',
      type: d['type']?.toString() ?? '',
      title: d['title']?.toString() ?? d['customerName']?.toString() ?? '',
      orderId: d['orderId']?.toString() ?? '',
      orderNumber: d['orderNumber']?.toString() ?? '',
      amount: (d['amount'] as num? ?? 0).toInt(),
      method: d['method']?.toString() ?? '',
      status: d['status']?.toString() ?? 'completed',
      utr: d['utr']?.toString() ?? '',
      balanceBefore: (d['balanceBefore'] as num? ?? 0).toInt(),
      balanceAfter: (d['balanceAfter'] as num? ?? 0).toInt(),
      remarks: d['remarks']?.toString() ?? '',
      createdAt: created,
      processedAt: processed,
    );
  }
}
