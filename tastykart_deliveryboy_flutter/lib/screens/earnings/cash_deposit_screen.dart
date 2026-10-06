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
    final held = widget.partner.cashInHandRupees;
    if (due <= 0) {
      Navigator.pop(context, true);
      return;
    }
    setState(() => _busy = true);
    final result = await _payments.payCashInHand(
      partnerId: widget.partner.id,
      name: widget.partner.name,
      phone: widget.partner.phone,
      email: widget.partner.email,
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (result.isFullyVerified) {
      final remaining = (held - due).clamp(0, held);
      AppFeedback.showSuccess(
        context,
        remaining > 0
            ? 'Payment verified. Excess cleared — ${rupee(remaining)} cash in hand remains (within your limit). You can go online.'
            : 'Payment verified. You can go online again.',
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
          'Pay cash to TastyKart',
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
                  'Cash in hand ${rupee(held)} (not your earnings)',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                Text(
                  'This is COD you collected for TastyKart — separate from Pocket Balance and tips. '
                  'Your limit is ${rupee(widget.cashLimit)}. Pay only the excess ${rupee(due)} above that limit to go online again.',
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
            'Pay securely with Razorpay (UPI, card or net banking). Only the excess above your cash limit is collected — the rest stays as cash in hand. Pocket Balance and tips are not touched.',
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
