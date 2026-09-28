import 'package:flutter/material.dart';

import '../../constants/color_constants.dart';
import '../../global_widgets/app_button.dart';
import '../../utils/app_feedback.dart';
import '../../widgets/app_radio_option.dart';

class CancelOrderSheet {
  CancelOrderSheet._();

  static Future<String?> show(
    BuildContext context, {
    required List<String> reasons,
  }) {
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _CancelOrderSheetBody(reasons: reasons),
    );
  }
}

class _CancelOrderSheetBody extends StatefulWidget {
  const _CancelOrderSheetBody({required this.reasons});

  final List<String> reasons;

  @override
  State<_CancelOrderSheetBody> createState() => _CancelOrderSheetBodyState();
}

class _CancelOrderSheetBodyState extends State<_CancelOrderSheetBody> {
  String? _selected;

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
                'Cancel Order',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textDark,
                ),
              ),
              const SizedBox(height: 8),
              ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.sizeOf(context).height * 0.5,
                ),
                child: ListView(
                  shrinkWrap: true,
                  children: [
                    for (final reason in widget.reasons)
                      AppRadioOption(
                        label: reason,
                        selected: _selected == reason,
                        onTap: () {
                          AppFeedback.selection();
                          setState(() => _selected = reason);
                        },
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              AppButton(
                label: 'Cancel',
                onPressed: _selected == null
                    ? null
                    : () {
                        AppFeedback.light();
                        Navigator.pop(context, _selected);
                      },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
