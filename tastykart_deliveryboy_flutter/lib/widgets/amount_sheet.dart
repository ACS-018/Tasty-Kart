import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../constants/color_constants.dart';
import '../global_widgets/app_button.dart';
import '../global_widgets/app_text_field.dart';
import '../utils/formatters.dart';

Future<int?> showAmountSheet(
  BuildContext context, {
  required String title,
  required int maxAmount,
}) {
  return showModalBottomSheet<int>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _AmountSheet(title: title, maxAmount: maxAmount),
  );
}

class _AmountSheet extends StatefulWidget {
  const _AmountSheet({required this.title, required this.maxAmount});

  final String title;
  final int maxAmount;

  @override
  State<_AmountSheet> createState() => _AmountSheetState();
}

class _AmountSheetState extends State<_AmountSheet> {
  late final TextEditingController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(
      text: widget.maxAmount > 0 ? '${widget.maxAmount}' : '',
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + bottom),
      child: Material(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                widget.title,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textDark,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Available ${rupee(widget.maxAmount)}',
                style: const TextStyle(color: AppColors.textMedium),
              ),
              const SizedBox(height: 16),
              AppTextField(
                label: 'Amount',
                controller: _ctrl,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              ),
              const SizedBox(height: 16),
              AppButton(
                label: 'Confirm',
                onPressed: () {
                  final value = int.tryParse(_ctrl.text.trim()) ?? 0;
                  if (value <= 0) return;
                  Navigator.pop(context, value);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
