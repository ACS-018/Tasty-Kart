import 'package:flutter/material.dart';

import '../constants/color_constants.dart';
import '../utils/app_feedback.dart';

class DateChipStrip extends StatelessWidget {
  const DateChipStrip({
    super.key,
    required this.days,
    required this.selected,
    required this.onSelected,
    this.filled = false,
  });

  final List<DateTime> days;
  final DateTime selected;
  final ValueChanged<DateTime> onSelected;
  final bool filled;

  static bool sameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;

  @override
  Widget build(BuildContext context) {
    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    final today = DateTime.now();

    return SizedBox(
      height: 72,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: days.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (context, index) {
          final day = days[index];
          final isToday = sameDay(day, today);
          final isSelected = sameDay(day, selected);
          return InkWell(
            onTap: () {
              AppFeedback.selection();
              onSelected(day);
            },
            borderRadius: BorderRadius.circular(12),
            child: Container(
              width: filled ? 58 : 64,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: filled && isSelected
                    ? AppColors.primary
                    : AppColors.white,
                borderRadius: BorderRadius.circular(filled ? 28 : 12),
                border: filled
                    ? null
                    : Border.all(
                        color: isSelected ? AppColors.primary : AppColors.divider,
                        width: isSelected ? 1.6 : 1,
                      ),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    isToday ? 'Today' : weekdays[day.weekday - 1],
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: filled && isSelected
                          ? AppColors.white
                          : (isSelected
                              ? AppColors.primary
                              : AppColors.textMedium),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${day.day}',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: filled && isSelected
                          ? AppColors.white
                          : (isSelected
                              ? AppColors.primary
                              : AppColors.textDark),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
