import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../../constants/color_constants.dart';

/// A lightweight order reference shown in the picker.
class PickableOrder {
  final String id;
  final String orderNumber;
  final String restaurantName;
  final String status;
  final bool partnerAccepted;
  final String deliveryPartnerId;
  final int total;
  final DateTime? createdAt;

  const PickableOrder({
    required this.id,
    required this.orderNumber,
    required this.restaurantName,
    required this.status,
    required this.total,
    this.partnerAccepted = false,
    this.deliveryPartnerId = '',
    this.createdAt,
  });

  factory PickableOrder.fromDoc(QueryDocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>? ?? {};
    DateTime? created;
    final raw = d['createdAt'];
    if (raw is Timestamp) created = raw.toDate();

    return PickableOrder(
      id: doc.id,
      orderNumber: d['orderNumber']?.toString() ?? doc.id,
      restaurantName: d['restaurantName']?.toString() ?? '—',
      status: (d['status'] ?? '').toString().toLowerCase(),
      partnerAccepted: d['partnerAccepted'] == true,
      deliveryPartnerId: (d['deliveryPartnerId'] ?? d['riderId'] ?? '')
          .toString(),
      total: (d['total'] as num? ?? d['grandTotal'] as num? ?? 0).toInt(),
      createdAt: created,
    );
  }

  /// True when an order is assigned to a partner but they haven't accepted yet.
  bool get isAwaitingAcceptance =>
      (status == 'accepted' || status == 'pending') &&
      deliveryPartnerId.isNotEmpty &&
      !partnerAccepted;

  /// Human-readable status label.
  String get statusLabel {
    if (isAwaitingAcceptance) return 'Waiting to Accept';
    switch (status) {
      case 'delivered':
        return 'Delivered';
      case 'cancelled':
        return 'Cancelled';
      case 'refunded':
        return 'Refunded';
      case 'picked':
        return 'Picked';
      case 'preparing':
        return 'Preparing';
      case 'accepted':
        return 'Accepted';
      default:
        return 'Pending';
    }
  }

  Color get statusColor {
    if (isAwaitingAcceptance) return const Color(0xFFF57C00); // amber
    switch (status) {
      case 'delivered':
        return const Color(0xFF2E7D32);
      case 'cancelled':
      case 'refunded':
        return const Color(0xFFB32B2C);
      case 'picked':
        return const Color(0xFF6A1B9A);
      case 'preparing':
        return const Color(0xFF1565C0);
      case 'accepted':
        return const Color(0xFF1565C0);
      default:
        return const Color(0xFFF57C00);
    }
  }
}

/// Bottom sheet that shows the last 10 orders for a delivery partner.
/// Returns the chosen [PickableOrder] via [Navigator.pop], or null if dismissed.
class OrderPickerSheet extends StatefulWidget {
  const OrderPickerSheet({super.key, required this.partnerId});

  final String partnerId;

  /// Convenience helper — shows the sheet and returns the selected order.
  static Future<PickableOrder?> show(
    BuildContext context, {
    required String partnerId,
  }) {
    return showModalBottomSheet<PickableOrder>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => OrderPickerSheet(partnerId: partnerId),
    );
  }

  @override
  State<OrderPickerSheet> createState() => _OrderPickerSheetState();
}

class _OrderPickerSheetState extends State<OrderPickerSheet> {
  late final Future<List<PickableOrder>> _future = _fetchOrders();

  Future<List<PickableOrder>> _fetchOrders() async {
    final db = FirebaseFirestore.instance;

    // Try both field names — admin writes 'deliveryPartnerId',
    // older docs may use 'riderId'.
    Future<List<QueryDocumentSnapshot<Map<String, dynamic>>>> queryByField(
      String field,
    ) async {
      try {
        // Try with orderBy first (requires composite index).
        final snap = await db
            .collection('orders')
            .where(field, isEqualTo: widget.partnerId)
            .orderBy('createdAt', descending: true)
            .limit(20)
            .get();
        if (snap.docs.isNotEmpty) return snap.docs;
      } catch (_) {}

      try {
        // Fallback: no orderBy — works without any index.
        final snap = await db
            .collection('orders')
            .where(field, isEqualTo: widget.partnerId)
            .limit(30)
            .get();
        return snap.docs;
      } catch (_) {}

      return [];
    }

    // Fetch by both field names and merge.
    final byPartner = await queryByField('deliveryPartnerId');
    final byRider = await queryByField('riderId');

    final seen = <String>{};
    final allDocs = <QueryDocumentSnapshot<Map<String, dynamic>>>[];
    for (final doc in [...byPartner, ...byRider]) {
      if (seen.add(doc.id)) allDocs.add(doc);
    }

    if (allDocs.isEmpty) return [];

    final orders = allDocs.map(PickableOrder.fromDoc).toList();

    // Sort newest first client-side.
    orders.sort((a, b) {
      final ta = a.createdAt?.millisecondsSinceEpoch ?? 0;
      final tb = b.createdAt?.millisecondsSinceEpoch ?? 0;
      return tb.compareTo(ta);
    });

    final terminal = {'delivered', 'cancelled', 'refunded'};
    final active = <PickableOrder>[];
    final past = <PickableOrder>[];

    for (final o in orders) {
      if (!terminal.contains(o.status)) {
        if (active.isEmpty) active.add(o);
      } else {
        if (past.length < 10) past.add(o);
      }
      if (active.isNotEmpty && past.length >= 10) break;
    }

    return [...active, ...past];
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    return DraggableScrollableSheet(
      initialChildSize: 0.65,
      minChildSize: 0.4,
      maxChildSize: 0.92,
      builder: (_, controller) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            // Handle
            Container(
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),

            // Title
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: const Color(0xFFFCE8E8),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.receipt_long_rounded,
                      color: AppColors.primary,
                      size: 18,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Select Order',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textDark,
                          ),
                        ),
                        Text(
                          'Current order + last 10 deliveries',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppColors.textMedium,
                          ),
                        ),
                      ],
                    ),
                  ),
                  GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: const Icon(Icons.close, color: AppColors.textMedium),
                  ),
                ],
              ),
            ),

            const Divider(height: 1),

            // Order list
            Expanded(
              child: FutureBuilder<List<PickableOrder>>(
                future: _future,
                builder: (context, snap) {
                  if (snap.connectionState == ConnectionState.waiting) {
                    return const Center(
                      child: CircularProgressIndicator(
                        color: AppColors.primary,
                        strokeWidth: 2,
                      ),
                    );
                  }

                  if (snap.hasError) {
                    return Center(
                      child: Padding(
                        padding: const EdgeInsets.all(32),
                        child: Text(
                          'Error loading orders:\n${snap.error}',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                    );
                  }

                  final orders = snap.data ?? [];

                  if (orders.isEmpty) {
                    return Center(
                      child: Padding(
                        padding: const EdgeInsets.all(32),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.inbox_rounded,
                              size: 48,
                              color: Colors.grey.shade300,
                            ),
                            const SizedBox(height: 12),
                            const Text(
                              'No orders found',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textMedium,
                              ),
                            ),
                            const SizedBox(height: 6),
                            const Text(
                              'You have no deliveries assigned yet.',
                              style: TextStyle(
                                fontSize: 13,
                                color: AppColors.textMedium,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                    );
                  }

                  return ListView.separated(
                    controller: controller,
                    padding: EdgeInsets.fromLTRB(16, 8, 16, 16 + bottom),
                    itemCount: orders.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final order = orders[index];
                      final isActive =
                          order.status != 'delivered' &&
                          order.status != 'cancelled' &&
                          order.status != 'refunded';

                      return GestureDetector(
                        onTap: () => Navigator.pop(context, order),
                        child: Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: isActive
                                  ? AppColors.primary.withValues(alpha: 0.4)
                                  : Colors.grey.shade200,
                              width: isActive ? 1.5 : 1,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.04),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Row(
                            children: [
                              // Status dot
                              Container(
                                width: 40,
                                height: 40,
                                decoration: BoxDecoration(
                                  color: order.statusColor.withValues(
                                    alpha: 0.12,
                                  ),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Icon(
                                  isActive
                                      ? Icons.delivery_dining_rounded
                                      : Icons.check_circle_outline_rounded,
                                  color: order.statusColor,
                                  size: 20,
                                ),
                              ),
                              const SizedBox(width: 12),

                              // Order info
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Expanded(
                                          child: Text(
                                            order.orderNumber.startsWith('#')
                                                ? order.orderNumber
                                                : '#${order.orderNumber}',
                                            style: const TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.w800,
                                              color: AppColors.textDark,
                                            ),
                                          ),
                                        ),
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 8,
                                            vertical: 2,
                                          ),
                                          decoration: BoxDecoration(
                                            color: order.statusColor.withValues(
                                              alpha: 0.12,
                                            ),
                                            borderRadius: BorderRadius.circular(
                                              6,
                                            ),
                                          ),
                                          child: Text(
                                            isActive
                                                ? '● ${order.statusLabel}'
                                                : order.statusLabel,
                                            style: TextStyle(
                                              fontSize: 10,
                                              fontWeight: FontWeight.w700,
                                              color: order.statusColor,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 3),
                                    Text(
                                      order.restaurantName,
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.textMedium,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 8),

                              // Amount + date
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text(
                                    '₹${order.total}',
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.textDark,
                                    ),
                                  ),
                                  if (order.createdAt != null) ...[
                                    const SizedBox(height: 2),
                                    Text(
                                      _fmtDate(order.createdAt!),
                                      style: const TextStyle(
                                        fontSize: 10,
                                        color: AppColors.textMedium,
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Formats a DateTime as "dd MMM" without requiring the intl package.
String _fmtDate(DateTime dt) {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return '${dt.day.toString().padLeft(2, '0')} ${months[dt.month - 1]}';
}
