import 'package:flutter/material.dart';

import '../../../constants/color_constants.dart';
import '../../../constants/trip_filters.dart';
import '../../../global_widgets/app_button.dart';
import '../../../utils/app_feedback.dart';
import '../../../widgets/app_radio_option.dart';

class TripFilterSheet {
  TripFilterSheet._();

  static Future<TripFilter?> show(
    BuildContext context, {
    required TripFilter selected,
  }) {
    return showModalBottomSheet<TripFilter>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _TripFilterSheetBody(selected: selected),
    );
  }
}

class _TripFilterSheetBody extends StatefulWidget {
  const _TripFilterSheetBody({required this.selected});

  final TripFilter selected;

  @override
  State<_TripFilterSheetBody> createState() => _TripFilterSheetBodyState();
}

class _TripFilterSheetBodyState extends State<_TripFilterSheetBody> {
  late TripFilter _draft;

  @override
  void initState() {
    super.initState();
    _draft = widget.selected;
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + bottom),
      child: Material(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Filter',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textDark,
                ),
              ),
              const SizedBox(height: 8),
              for (final filter in TripFilters.values)
                AppRadioOption(
                  label: filter.label,
                  selected: _draft == filter,
                  onTap: () {
                    AppFeedback.selection();
                    setState(() => _draft = filter);
                  },
                ),
              const SizedBox(height: 12),
              Row(
                children: [
                  TextButton(
                    onPressed: () {
                      AppFeedback.selection();
                      Navigator.pop(context, TripFilter.all);
                    },
                    child: const Text(
                      'Clear Filter',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: AppColors.textDark,
                      ),
                    ),
                  ),
                  const Spacer(),
                  SizedBox(
                    width: 120,
                    child: AppButton(
                      label: 'Apply',
                      onPressed: () => Navigator.pop(context, _draft),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
