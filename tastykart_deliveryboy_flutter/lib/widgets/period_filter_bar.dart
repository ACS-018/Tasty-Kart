import 'package:flutter/material.dart';

import '../constants/color_constants.dart';
import '../utils/app_feedback.dart';
import '../utils/formatters.dart';

enum PeriodFilter { today, week, month, date }

bool matchesPeriod(
  DateTime? created,
  PeriodFilter filter,
  DateTime? custom,
) {
  if (created == null) return filter == PeriodFilter.week;
  final now = DateTime.now();
  switch (filter) {
    case PeriodFilter.today:
      return !created.isBefore(startOfDay(now));
    case PeriodFilter.week:
      return !created.isBefore(startOfWeek(now));
    case PeriodFilter.month:
      return !created.isBefore(startOfMonth(now));
    case PeriodFilter.date:
      if (custom == null) return true;
      return created.year == custom.year &&
          created.month == custom.month &&
          created.day == custom.day;
  }
}

class PeriodFilterBar extends StatelessWidget {
  const PeriodFilterBar({
    super.key,
    required this.selected,
    required this.onSelected,
    required this.onPickDate,
  });

  final PeriodFilter selected;
  final ValueChanged<PeriodFilter> onSelected;
  final VoidCallback onPickDate;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          _chip(context, 'Today', PeriodFilter.today),
          _chip(context, 'This Week', PeriodFilter.week),
          _chip(context, 'Month', PeriodFilter.month),
          _chip(
            context,
            'Select By Date',
            PeriodFilter.date,
            icon: Icons.calendar_today_outlined,
            onTap: onPickDate,
          ),
        ],
      ),
    );
  }

  Widget _chip(
    BuildContext context,
    String label,
    PeriodFilter value, {
    IconData? icon,
    VoidCallback? onTap,
  }) {
    final isSelected = selected == value;
    return Padding(
      padding: const EdgeInsets.only(right: 12),
      child: InkWell(
        onTap: () {
          AppFeedback.selection();
          if (onTap != null) {
            onTap();
            return;
          }
          onSelected(value);
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(
            children: [
              if (icon != null) ...[
                Icon(
                  icon,
                  size: 14,
                  color: isSelected ? AppColors.primary : AppColors.textMedium,
                ),
                const SizedBox(width: 4),
              ],
              Text(
                label,
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: isSelected ? AppColors.primary : AppColors.textMedium,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

Future<DateTime?> pickPeriodDate(
  BuildContext context, {
  DateTime? initial,
}) {
  return showDatePicker(
    context: context,
    initialDate: initial ?? DateTime.now(),
    firstDate: DateTime(2024),
    lastDate: DateTime.now(),
  );
}
