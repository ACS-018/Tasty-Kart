import 'package:flutter/material.dart';

import '../../../constants/color_constants.dart';
import '../../../services/settings_service.dart';
import '../../../utils/formatters.dart';

class IncentivesCard extends StatelessWidget {
  const IncentivesCard({super.key, required this.trips, required this.slots});

  final int trips;

  /// Live incentive tiers from admin settings.
  final List<IncentiveSlot> slots;

  @override
  Widget build(BuildContext context) {
    if (slots.isEmpty) return const SizedBox.shrink();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Weekly Incentives',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 15,
              color: AppColors.textDark,
            ),
          ),
          const SizedBox(height: 12),

          // Bonus amount row
          Row(
            children: slots
                .map(
                  (slot) => Expanded(
                    child: Column(
                      children: [
                        Text(
                          rupee(slot.amount),
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            color: trips >= slot.trips
                                ? AppColors.primary
                                : AppColors.textDark,
                          ),
                        ),
                      ],
                    ),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 6),
          const Text(
            'Incentives',
            style: TextStyle(fontSize: 11, color: AppColors.textMedium),
          ),
          const SizedBox(height: 10),

          // Trip count row
          Row(
            children: slots
                .map(
                  (slot) => Expanded(
                    child: Column(
                      children: [
                        // Progress indicator dot
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 300),
                          width: 8,
                          height: 8,
                          margin: const EdgeInsets.only(bottom: 4),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: trips >= slot.trips
                                ? AppColors.primary
                                : AppColors.divider,
                          ),
                        ),
                        Text(
                          '${slot.trips}',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                            color: trips >= slot.trips
                                ? AppColors.primary
                                : AppColors.textDark,
                          ),
                        ),
                      ],
                    ),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 4),
          const Text(
            'Trips Count',
            style: TextStyle(fontSize: 11, color: AppColors.textMedium),
          ),

          // Progress bar across all tiers
          if (slots.isNotEmpty) ...[
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(
                minHeight: 6,
                value: (trips / slots.last.trips).clamp(0.0, 1.0),
                backgroundColor: AppColors.divider,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              trips >= slots.last.trips
                  ? 'All tiers unlocked! 🎉'
                  : '${slots.last.trips - trips} more trips to max weekly bonus',
              style: const TextStyle(fontSize: 11, color: AppColors.textMedium),
            ),
          ],

        ],
      ),
    );
  }
}
