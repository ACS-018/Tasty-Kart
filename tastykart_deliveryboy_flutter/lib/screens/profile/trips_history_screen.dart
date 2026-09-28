import 'package:flutter/material.dart';

import '../../constants/color_constants.dart';
import '../../constants/trip_filters.dart';
import '../../models/delivery_order.dart';
import '../../models/delivery_partner.dart';
import '../../services/order_service.dart';
import '../../utils/app_feedback.dart';
import '../../utils/formatters.dart';
import '../../widgets/async_state_message.dart';
import '../../widgets/page_header.dart';
import 'components/trip_filter_sheet.dart';

class TripsHistoryScreen extends StatefulWidget {
  const TripsHistoryScreen({super.key, required this.partner});

  final DeliveryPartner partner;

  @override
  State<TripsHistoryScreen> createState() => _TripsHistoryScreenState();
}

class _TripsHistoryScreenState extends State<TripsHistoryScreen> {
  late DateTime _month;
  TripFilter _filter = TripFilter.all;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = DateTime(now.year, now.month);
  }

  List<DateTime> get _months {
    final now = DateTime.now();
    return List.generate(12, (i) {
      final d = DateTime(now.year, now.month - i);
      return DateTime(d.year, d.month);
    });
  }

  Future<void> _pickMonth() async {
    final picked = await showModalBottomSheet<DateTime>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) {
        final bottom = MediaQuery.paddingOf(context).bottom;
        return Padding(
          padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + bottom),
          child: Material(
            color: AppColors.white,
            borderRadius: BorderRadius.circular(16),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 12),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Select Month',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textDark,
                    ),
                  ),
                  const SizedBox(height: 8),
                  ConstrainedBox(
                    constraints: BoxConstraints(
                      maxHeight: MediaQuery.sizeOf(context).height * 0.45,
                    ),
                    child: ListView(
                      shrinkWrap: true,
                      children: [
                        for (final month in _months)
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(
                              formatMonthYear(month),
                              style: TextStyle(
                                fontWeight: month == _month
                                    ? FontWeight.w800
                                    : FontWeight.w500,
                                color: AppColors.textDark,
                              ),
                            ),
                            trailing: month == _month
                                ? const Icon(
                                    Icons.check,
                                    color: AppColors.primary,
                                  )
                                : null,
                            onTap: () => Navigator.pop(context, month),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
    if (picked == null) return;
    setState(() => _month = picked);
  }

  Future<void> _pickFilter() async {
    final picked = await TripFilterSheet.show(context, selected: _filter);
    if (picked == null) return;
    setState(() => _filter = picked);
  }

  bool _inSelectedMonth(DeliveryOrder order) {
    final time = order.sortTime;
    return time.year == _month.year && time.month == _month.month;
  }

  bool _matchesFilter(DeliveryOrder order) {
    final ownDelivery = order.deliveryPartnerId == widget.partner.id;
    final deniedByMe = order.deniedBy(widget.partner.id) && !ownDelivery;
    switch (_filter) {
      case TripFilter.all:
        return (ownDelivery && order.isHistoryItem) || deniedByMe;
      case TripFilter.denials:
        return deniedByMe || (ownDelivery && order.isDenied);
      case TripFilter.cancellation:
        return ownDelivery && order.isCancelled;
      case TripFilter.foodNotDelivered:
        return ownDelivery && order.isFoodNotDelivered;
    }
  }

  List<DeliveryOrder> _visible(List<DeliveryOrder> all) {
    final items = all.where((o) {
      if (!_inSelectedMonth(o)) return false;
      return _matchesFilter(o);
    }).toList()..sort((a, b) => b.sortTime.compareTo(a.sortTime));
    return items;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: Column(
        children: [
          const PageHeader(title: 'Trip History', branded: true),
          Expanded(
            child: StreamBuilder<List<DeliveryOrder>>(
              stream: OrderService.watchHistoryForPartner(widget.partner.id),
              builder: (context, snapshot) {
                final trips = _visible(snapshot.data ?? const []);
                if (snapshot.connectionState == ConnectionState.waiting &&
                    snapshot.data == null) {
                  return const AsyncStateMessage.loading();
                }

                final earnings = trips.fold<int>(0, (sum, o) {
                  if (!o.isDelivered) return sum;
                  if (o.deliveryPartnerId != widget.partner.id) return sum;
                  return sum + o.payout;
                });
                final groups = _groupByDate(trips);

                return ListView(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                  children: [
                    Row(
                      children: [
                        _DropdownChip(
                          label: formatMonthYear(_month),
                          onTap: _pickMonth,
                        ),
                        const SizedBox(width: 10),
                        _DropdownChip(label: _filter.label, onTap: _pickFilter),
                      ],
                    ),
                    const SizedBox(height: 14),
                    _StatsRow(trips: trips.length, earnings: earnings),
                    if (trips.isEmpty)
                      const SizedBox(
                        height: 280,
                        child: AsyncStateMessage(
                          icon: Icons.route_outlined,
                          message: 'No trips for this filter.',
                        ),
                      )
                    else
                      for (final entry in groups.entries) ...[
                        const SizedBox(height: 18),
                        Text(
                          entry.key,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textDark,
                          ),
                        ),
                        const SizedBox(height: 10),
                        for (final order in entry.value) ...[
                          _TripCard(order: order, partnerId: widget.partner.id),
                          const SizedBox(height: 10),
                        ],
                      ],
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Map<String, List<DeliveryOrder>> _groupByDate(List<DeliveryOrder> trips) {
    final map = <String, List<DeliveryOrder>>{};
    for (final trip in trips) {
      final key = formatDayMonthYear(trip.sortTime);
      map.putIfAbsent(key, () => []).add(trip);
    }
    return map;
  }
}

class _DropdownChip extends StatelessWidget {
  const _DropdownChip({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        onTap: () {
          AppFeedback.selection();
          onTap();
        },
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          decoration: BoxDecoration(
            color: AppColors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFFE6E6E6)),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textDark,
                  ),
                ),
              ),
              const Icon(
                Icons.keyboard_arrow_down,
                color: AppColors.textMedium,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatsRow extends StatelessWidget {
  const _StatsRow({required this.trips, required this.earnings});

  final int trips;
  final int earnings;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _StatCard(
          icon: Icons.work_outline,
          iconColor: AppColors.primary,
          iconBg: const Color(0xFFFCE8E8),
          value: '$trips',
          label: 'Total Trips',
        ),
        _StatCard(
          icon: Icons.account_balance_wallet_outlined,
          iconColor: AppColors.success,
          iconBg: const Color(0xFFE8F5E9),
          value: rupee(earnings),
          label: 'Total Earnings',
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.iconColor,
    required this.iconBg,
    required this.value,
    required this.label,
  });

  final IconData icon;
  final Color iconColor;
  final Color iconBg;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 3),
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
        decoration: BoxDecoration(
          color: AppColors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          children: [
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: iconBg,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: iconColor, size: 16),
            ),
            const SizedBox(height: 8),
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 13,
                color: AppColors.textDark,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 9,
                height: 1.2,
                color: AppColors.textMedium,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TripCard extends StatefulWidget {
  const _TripCard({required this.order, required this.partnerId});

  final DeliveryOrder order;
  final String partnerId;

  @override
  State<_TripCard> createState() => _TripCardState();
}

class _TripCardState extends State<_TripCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final partnerId = widget.partnerId;
    final pickupTime = order.pickedAt ?? order.createdAt ?? order.sortTime;
    final dropTime = order.deliveredAt ?? order.sortTime;
    final own = order.deliveryPartnerId == partnerId;
    final payout = own && order.isDelivered ? order.payout : 0;
    final collected = own ? order.collectedMoney : 0;
    final pickupName = order.restaurantName.isEmpty
        ? 'Restaurant'
        : order.restaurantName;

    return GestureDetector(
      onTap: () {
        AppFeedback.selection();
        setState(() => _expanded = !_expanded);
      },
      child: Container(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
        decoration: BoxDecoration(
          color: AppColors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Always-visible row: stops + payout ────────────────
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _StopRow(
                        title: pickupName,
                        time: formatTimeAmPm(pickupTime),
                        isFirst: true,
                      ),
                      _StopRow(
                        title: order.dropStopName,
                        time: formatTimeAmPm(dropTime),
                        isFirst: false,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                // Payout + chevron
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      rupee(payout),
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textDark,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Icon(
                      _expanded
                          ? Icons.keyboard_arrow_up
                          : Icons.keyboard_arrow_down,
                      size: 18,
                      color: AppColors.textMedium,
                    ),
                  ],
                ),
              ],
            ),

            // ── Expandable breakdown ───────────────────────────────
            if (_expanded) ...[
              const SizedBox(height: 10),
              const Divider(height: 1),
              const SizedBox(height: 10),
              _BreakdownRow(
                label: 'Delivery Fee',
                value: rupee(order.isDelivered && own ? order.deliveryFee : 0),
              ),
              const SizedBox(height: 6),
              _BreakdownRow(label: 'Order Total', value: rupee(order.total)),
              const SizedBox(height: 6),
              if (order.tip > 0) ...[
                _BreakdownRow(
                  label: 'Tip 🙏',
                  value: rupee(order.tip),
                  valueColor: AppColors.success,
                ),
                const SizedBox(height: 6),
              ],
              _BreakdownRow(label: 'Collected (Cash)', value: rupee(collected)),
              if (order.tripKm > 0) ...[
                const SizedBox(height: 6),
                _BreakdownRow(
                  label: 'Distance',
                  value: '${order.tripKm.toStringAsFixed(1)} km',
                ),
              ],
              if (order.isCancelled) ...[
                const SizedBox(height: 6),
                _BreakdownRow(
                  label: 'Status',
                  value: 'Cancelled',
                  valueColor: AppColors.error,
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

class _BreakdownRow extends StatelessWidget {
  const _BreakdownRow({
    required this.label,
    required this.value,
    this.valueColor,
  });

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 12, color: AppColors.textMedium),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: valueColor ?? AppColors.textDark,
          ),
        ),
      ],
    );
  }
}

class _StopRow extends StatelessWidget {
  const _StopRow({
    required this.title,
    required this.time,
    required this.isFirst,
  });

  final String title;
  final String time;
  final bool isFirst;

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 16,
            child: Column(
              children: [
                Container(
                  width: 10,
                  height: 10,
                  margin: const EdgeInsets.only(top: 4),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isFirst ? AppColors.primary : AppColors.white,
                    border: Border.all(color: AppColors.primary, width: 2),
                  ),
                ),
                if (isFirst)
                  Expanded(
                    child: Container(
                      width: 2,
                      margin: const EdgeInsets.symmetric(vertical: 2),
                      color: const Color(0xFFE0E0E0),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isFirst ? 10 : 0),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        color: AppColors.textDark,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    time,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textMedium,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
