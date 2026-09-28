import 'package:flutter/material.dart';

import '../../constants/color_constants.dart';
import '../../constants/medal_levels.dart';
import '../../models/delivery_order.dart';
import '../../models/delivery_partner.dart';
import '../../services/order_service.dart';
import '../../widgets/page_header.dart';

class ScoringLevelScreen extends StatelessWidget {
  const ScoringLevelScreen({super.key, required this.partner});

  final DeliveryPartner partner;

  int _deliveryCount(List<DeliveryOrder> orders) {
    final delivered = orders.where((o) => o.isDelivered).length;
    return delivered > partner.completedOrders
        ? delivered
        : partner.completedOrders;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: Column(
        children: [
          const PageHeader(title: 'Levels Of Medals'),
          Expanded(
            child: StreamBuilder<List<DeliveryOrder>>(
              stream: OrderService.watchForPartner(partner.id),
              builder: (context, snapshot) {
                final count = _deliveryCount(snapshot.data ?? const []);
                final current = MedalLevels.currentFor(count);
                final next = MedalLevels.nextAfter(current);
                return ListView(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                  children: [
                    _MedalPath(count: count, current: current),
                    const SizedBox(height: 18),
                    _StatusCard(
                      count: count,
                      current: current,
                      next: next,
                    ),
                    const SizedBox(height: 22),
                    const Text(
                      'Partner Level Benefits',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textDark,
                      ),
                    ),
                    const SizedBox(height: 12),
                    const _BenefitsGrid(),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _MedalPath extends StatelessWidget {
  const _MedalPath({required this.count, required this.current});

  final int count;
  final MedalLevel current;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < MedalLevels.all.length; i++) ...[
            if (i > 0)
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(top: 22),
                  child: _DottedLine(
                    filled: count >= MedalLevels.all[i].minDeliveries,
                  ),
                ),
              ),
            _MedalNode(
              level: MedalLevels.all[i],
              reached: MedalLevels.all[i].reachedBy(count),
              active: MedalLevels.all[i].id == current.id,
            ),
          ],
        ],
      ),
    );
  }
}

class _MedalNode extends StatelessWidget {
  const _MedalNode({
    required this.level,
    required this.reached,
    required this.active,
  });

  final MedalLevel level;
  final bool reached;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final size = active ? 52.0 : 42.0;
    return SizedBox(
      width: 72,
      child: Column(
        children: [
          Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: reached ? level.color : level.color.withValues(alpha: 0.35),
              boxShadow: [
                BoxShadow(
                  color: level.color.withValues(alpha: active ? 0.35 : 0.15),
                  blurRadius: active ? 12 : 6,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: Icon(level.icon, color: AppColors.white, size: active ? 28 : 22),
          ),
          const SizedBox(height: 8),
          Text(
            level.name,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12,
              fontWeight: active ? FontWeight.w800 : FontWeight.w700,
              color: AppColors.textDark,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            level.requirementLabel,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 10,
              height: 1.2,
              color: AppColors.textMedium,
            ),
          ),
        ],
      ),
    );
  }
}

class _DottedLine extends StatelessWidget {
  const _DottedLine({required this.filled});

  final bool filled;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        const dashWidth = 4.0;
        const dashSpace = 3.0;
        final count = (constraints.maxWidth / (dashWidth + dashSpace)).floor();
        return Row(
          children: List.generate(count, (index) {
            return Container(
              width: dashWidth,
              height: 2,
              margin: const EdgeInsets.only(right: dashSpace),
              color: filled ? AppColors.textDark : const Color(0xFFD0D0D0),
            );
          }),
        );
      },
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({
    required this.count,
    required this.current,
    required this.next,
  });

  final int count;
  final MedalLevel current;
  final MedalLevel? next;

  @override
  Widget build(BuildContext context) {
    final target = next?.minDeliveries ?? count;
    final remaining = next == null ? 0 : (target - count).clamp(0, target);
    final progress = next == null
        ? 1.0
        : (count / target).clamp(0.0, 1.0).toDouble();
    final goalText = next == null
        ? "You're at the top partner level"
        : '$remaining More Deliveries To Reach ${next!.name}';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          SizedBox(
            width: 64,
            height: 64,
            child: Stack(
              alignment: Alignment.center,
              children: [
                CircularProgressIndicator(
                  value: progress,
                  strokeWidth: 6,
                  color: current.color,
                  backgroundColor: const Color(0xFFE8E8E8),
                ),
                Icon(current.icon, color: current.color, size: 26),
              ],
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${current.name} Partner',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textDark,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  next == null
                      ? '$count Deliveries This Month'
                      : '$count/$target Deliveries This Month',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textMedium,
                  ),
                ),
              ],
            ),
          ),
          Container(
            width: 1,
            height: 48,
            margin: const EdgeInsets.symmetric(horizontal: 10),
            color: const Color(0xFFE0E0E0),
          ),
          SizedBox(
            width: 88,
            child: Text(
              goalText,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 11,
                height: 1.3,
                fontWeight: FontWeight.w600,
                color: AppColors.textDark,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BenefitsGrid extends StatelessWidget {
  const _BenefitsGrid();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: const [
            Expanded(child: _BenefitCard(level: MedalLevels.bronze)),
            SizedBox(width: 10),
            Expanded(child: _BenefitCard(level: MedalLevels.silver)),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: const [
            Expanded(child: _BenefitCard(level: MedalLevels.gold)),
            SizedBox(width: 10),
            Expanded(child: _BenefitCard(level: MedalLevels.platinum)),
          ],
        ),
      ],
    );
  }
}

class _BenefitCard extends StatelessWidget {
  const _BenefitCard({required this.level});

  final MedalLevel level;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: level.background,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(level.icon, color: level.color, size: 22),
          const SizedBox(height: 8),
          Text(
            level.name,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: AppColors.textDark,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            level.rangeLabel,
            style: const TextStyle(
              fontSize: 11,
              color: AppColors.textMedium,
            ),
          ),
          const SizedBox(height: 10),
          for (final benefit in level.benefits)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.only(top: 2),
                    child: Icon(
                      Icons.check,
                      size: 14,
                      color: AppColors.textDark,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      benefit,
                      style: const TextStyle(
                        fontSize: 11,
                        height: 1.3,
                        color: AppColors.textDark,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
