import 'package:flutter/material.dart';

import '../constants/color_constants.dart';
import 'completed_check.dart';

class OnboardingNavTile extends StatelessWidget {
  const OnboardingNavTile({
    super.key,
    required this.title,
    this.subtitle,
    required this.onTap,
    this.completed = false,
    this.busy = false,
    this.showChevronWhenComplete = false,
  });

  final String title;
  final String? subtitle;
  final VoidCallback onTap;
  final bool completed;
  final bool busy;
  final bool showChevronWhenComplete;

  @override
  Widget build(BuildContext context) {
    final Widget trailing = busy
        ? const SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(strokeWidth: 2.4),
          )
        : completed && !showChevronWhenComplete
        ? const CompletedCheck()
        : const Icon(Icons.chevron_right, color: AppColors.textDark, size: 26);

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textDark,
                    ),
                  ),
                  if (subtitle != null && subtitle!.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitle!,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textMedium,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            trailing,
          ],
        ),
      ),
    );
  }
}
