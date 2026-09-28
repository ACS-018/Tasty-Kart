import 'package:flutter/material.dart';

import '../../../constants/color_constants.dart';
import '../../../utils/formatters.dart';

class StatCardsRow extends StatelessWidget {
  const StatCardsRow({
    super.key,
    required this.earnings,
    required this.trips,
    required this.hours,
    required this.incentives,
  });

  final int earnings;
  final int trips;
  final int hours;
  final int incentives;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _card(
          Icons.account_balance_wallet_outlined,
          'Todays Earnings',
          rupee(earnings),
        ),
        _card(Icons.work_outline, 'Your Trips', '$trips'),
        _card(Icons.schedule, 'Time On Orders', '${hours}h'),
        _card(
          Icons.emoji_events_outlined,
          'Your Incentives',
          rupee(incentives),
        ),
      ],
    );
  }

  Widget _card(IconData icon, String label, String value) {
    return Expanded(
      child: Container(
        height: 118,
        margin: const EdgeInsets.symmetric(horizontal: 4),
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
        alignment: Alignment.center,
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
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: AppColors.primary, size: 22),
            const SizedBox(height: 8),
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                value,
                maxLines: 1,
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 14,
                  color: AppColors.textDark,
                ),
              ),
            ),
            const SizedBox(height: 4),
            SizedBox(
              height: 24,
              child: Text(
                label,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 9,
                  height: 1.2,
                  color: AppColors.textMedium,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
