import 'package:flutter/material.dart';

import '../../constants/color_constants.dart';
import '../../models/delivery_partner.dart';
import '../../services/cash_deposit_service.dart';
import '../../utils/app_feedback.dart';
import '../../utils/formatters.dart';

class CashDepositScreen extends StatefulWidget {
  const CashDepositScreen({
    super.key,
    required this.partner,
    required this.cashLimit,
  });

  final DeliveryPartner partner;
  final int cashLimit;

  @override
  State<CashDepositScreen> createState() => _CashDepositScreenState();
}

class _CashDepositScreenState extends State<CashDepositScreen> {
  final _payments = CashDepositService();
  bool _busy = false;

  @override
  void dispose() {
    _payments.dispose();
    super.dispose();
  }

  Future<void> _pay() async {
    if (_busy) return;
    final due = widget.partner.cashDue(widget.cashLimit);
    if (due <= 0) {
      Navigator.pop(context, true);
      return;
    }
    setState(() => _busy = true);
    final result = await _payments.payExcess(
      partnerId: widget.partner.id,
      name: widget.partner.name,
      phone: widget.partner.phone,
      email: widget.partner.email,
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (result.isFullyVerified) {
      AppFeedback.showSuccess(
        context,
        'Payment verified. Cash in hand is updated. You can go online.',
      );
      Navigator.pop(context, true);
      return;
    }
    AppFeedback.showError(
      context,
      result.reason == null || result.reason!.isEmpty
          ? 'Payment was not verified'
          : result.reason!,
    );
  }

  @override
  Widget build(BuildContext context) {
    final due = widget.partner.cashDue(widget.cashLimit);
    final held = widget.partner.cashInHandRupees;
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.white,
        foregroundColor: AppColors.textDark,
        elevation: 0,
        title: const Text(
          'Pay excess cash',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF3E0),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Cash in hand ${rupee(held)}',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                Text(
                  'Limit ${rupee(widget.cashLimit)}. Pay ${rupee(due)} to TastyKart, then you can go online.',
                  style: const TextStyle(
                    color: AppColors.textMedium,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Text(
            rupee(due),
            style: const TextStyle(fontSize: 36, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          const Text(
            'This payment uses the TastyKart account. After it is verified, the extra amount is removed from your cash in hand.',
            style: TextStyle(color: AppColors.textMedium, height: 1.4),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _busy || due <= 0 ? null : _pay,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: Text(_busy ? 'Waiting for payment...' : 'Pay ${rupee(due)}'),
            ),
          ),
        ],
      ),
    );
  }
}
