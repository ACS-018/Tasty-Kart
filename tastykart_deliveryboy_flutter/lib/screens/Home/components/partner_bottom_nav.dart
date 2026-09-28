import 'package:flutter/material.dart';

import '../../../constants/color_constants.dart';
import '../../../utils/app_feedback.dart';

class PartnerBottomNav extends StatelessWidget {
  const PartnerBottomNav({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  final int currentIndex;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.white,
      elevation: 12,
      shadowColor: Colors.black.withValues(alpha: 0.12),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 62,
          child: Row(
            children: [
              _item(0, Icons.home_outlined, Icons.home_rounded, 'Home'),
              _item(
                1,
                Icons.receipt_long_outlined,
                Icons.receipt_long,
                'Orders',
              ),
              _item(
                2,
                Icons.account_balance_wallet_outlined,
                Icons.account_balance_wallet,
                'Earnings',
              ),
              _item(3, Icons.person_outline, Icons.person, 'Profile'),
            ],
          ),
        ),
      ),
    );
  }

  Widget _item(int index, IconData icon, IconData active, String label) {
    final selected = currentIndex == index;
    final color = selected ? AppColors.primary : AppColors.textLight;
    return Expanded(
      child: InkWell(
        onTap: () {
          AppFeedback.selection();
          onTap(index);
        },
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(selected ? active : icon, color: color, size: 24),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
