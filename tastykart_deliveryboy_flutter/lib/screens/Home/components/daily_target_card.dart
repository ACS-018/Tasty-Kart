import 'package:flutter/material.dart';

import '../../../constants/color_constants.dart';
import '../../../utils/formatters.dart';

class DailyTargetCard extends StatelessWidget {
  const DailyTargetCard({
    super.key,
    required this.earned,
    required this.target,
    this.bonus = 0,
  });

  final int earned;

  /// Live daily target from admin settings.
  final int target;

  /// Bonus amount credited when the partner hits the daily target.
  /// 0 means no bonus is configured.
  final int bonus;

  @override
  Widget build(BuildContext context) {
    final safeTarget = target > 0 ? target : 1;
    final remaining = (safeTarget - earned).clamp(0, safeTarget);
    final progress = (earned / safeTarget).clamp(0.0, 1.0);
    final achieved = progress >= 1.0;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
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
          // ── Header row ──────────────────────────────────────────────
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Today\'s Target',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                    color: AppColors.textDark,
                  ),
                ),
              ),
              Text(
                rupee(safeTarget),
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(width: 8),
              const Icon(Icons.emoji_events, color: Color(0xFFFFC107)),
            ],
          ),
          const SizedBox(height: 12),

          // ── Progress bar ────────────────────────────────────────────
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              minHeight: 8,
              value: progress,
              backgroundColor: AppColors.divider,
              color: achieved ? AppColors.success : AppColors.primary,
            ),
          ),
          const SizedBox(height: 8),

          // ── Status text ─────────────────────────────────────────────
          Text(
            achieved
                ? '🎉 Target achieved! ${rupee(earned)} earned'
                : '${rupee(earned)} earned · ${rupee(remaining)} remaining',
            style: const TextStyle(fontSize: 12, color: AppColors.textMedium),
          ),

          // ── Bonus section ────────────────────────────────────────────
          if (bonus > 0) ...[
            const SizedBox(height: 10),
            achieved
                ? _BonusAchievedBanner(bonus: bonus)
                : _BonusPendingChip(bonus: bonus),
          ],
        ],
      ),
    );
  }
}

// ── Shown when target is NOT yet reached ──────────────────────────────────────

class _BonusPendingChip extends StatelessWidget {
  const _BonusPendingChip({required this.bonus});
  final int bonus;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF8E1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: const Color(0xFFFFCA28).withValues(alpha: 0.5),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.card_giftcard_rounded,
            size: 14,
            color: Color(0xFFF57F17),
          ),
          const SizedBox(width: 6),
          Text(
            '+ ${rupee(bonus)} bonus on completion',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: Color(0xFFF57F17),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Shown when target IS reached ──────────────────────────────────────────────

class _BonusAchievedBanner extends StatelessWidget {
  const _BonusAchievedBanner({required this.bonus});
  final int bonus;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFE8F5E9),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.success.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: AppColors.success.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.emoji_events_rounded,
              color: Color(0xFFFFC107),
              size: 18,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Bonus Credited! 🎊',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF1B5E20),
                  ),
                ),
                Text(
                  '${rupee(bonus)} added to your wallet',
                  style: const TextStyle(
                    fontSize: 11,
                    color: Color(0xFF388E3C),
                  ),
                ),
              ],
            ),
          ),
          Text(
            rupee(bonus),
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w900,
              color: Color(0xFF2E7D32),
            ),
          ),
        ],
      ),
    );
  }
}
