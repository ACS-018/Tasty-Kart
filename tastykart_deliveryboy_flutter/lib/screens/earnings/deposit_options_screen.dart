import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../constants/color_constants.dart';
import '../../global_widgets/app_button.dart';
import '../../models/delivery_partner.dart';
import '../../services/delivery_partner_service.dart';
import '../../services/transaction_service.dart';
import '../../utils/app_feedback.dart';
import '../../widgets/amount_sheet.dart';
import '../../widgets/app_radio_option.dart';
import '../../widgets/page_header.dart';

class DepositOptionsScreen extends StatefulWidget {
  const DepositOptionsScreen({super.key, required this.partner});

  final DeliveryPartner partner;

  @override
  State<DepositOptionsScreen> createState() => _DepositOptionsScreenState();
}

class _DepositOptionsScreenState extends State<DepositOptionsScreen> {
  String _method = 'upi';
  bool _busy = false;

  Future<void> _continue() async {
    if (_method == 'qr') {
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => _DepositQrScreen(partner: widget.partner),
        ),
      );
      return;
    }
    await _recordDeposit();
  }

  Future<void> _recordDeposit({int? preset}) async {
    final amount = preset ??
        await showAmountSheet(
          context,
          title: 'Deposite',
          maxAmount: 5000,
        );
    if (amount == null || amount <= 0 || !mounted) return;
    setState(() => _busy = true);
    try {
      await TransactionService.add(
        partnerId: widget.partner.id,
        type: 'deposit',
        title: _method == 'qr' ? 'Deposite By QR Code' : 'Pay By UPI / Debit Card',
        amount: amount,
        method: _method,
      );
      await DeliveryPartnerService.adjustWallet(
        partnerId: widget.partner.id,
        delta: amount,
      );
      if (mounted) {
        AppFeedback.showSuccess(context, 'Deposit recorded');
        Navigator.pop(context);
      }
    } catch (_) {
      if (mounted) {
        AppFeedback.showError(context, 'Could not deposit');
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
      ),
    );

    return Scaffold(
      backgroundColor: AppColors.white,
      body: Column(
        children: [
          const PageHeader(
            title: 'Deposite Options',
            subtitle: 'Choose Your Payment Option',
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              children: [
                Container(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  decoration: BoxDecoration(
                    color: AppColors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.divider),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.04),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Deposit Options',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                          color: AppColors.textDark,
                        ),
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'Preferred Payment Method',
                        style: TextStyle(
                          fontSize: 12,
                          color: AppColors.textMedium,
                        ),
                      ),
                      const SizedBox(height: 8),
                      _option(
                        id: 'upi',
                        label: 'Pay By UPI / Debit Card',
                        icon: Icons.credit_card,
                      ),
                      _option(
                        id: 'qr',
                        label: 'Deposite By QR Code',
                        icon: Icons.qr_code_2,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              24,
              8,
              24,
              16 + MediaQuery.paddingOf(context).bottom,
            ),
            child: AppButton(
              label: 'Continue',
              isLoading: _busy,
              onPressed: _continue,
            ),
          ),
        ],
      ),
    );
  }

  Widget _option({
    required String id,
    required String label,
    required IconData icon,
  }) {
    final selected = _method == id;
    return InkWell(
      onTap: () {
        AppFeedback.selection();
        setState(() => _method = id);
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(
          children: [
            Icon(icon, color: AppColors.primary),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  color: AppColors.textDark,
                ),
              ),
            ),
            AppRadioDot(selected: selected),
          ],
        ),
      ),
    );
  }
}

class _DepositQrScreen extends StatelessWidget {
  const _DepositQrScreen({required this.partner});

  final DeliveryPartner partner;

  String get _payload {
    final upi = partner.upiId.trim();
    if (upi.isEmpty) return '';
    final name = Uri.encodeComponent(
      partner.name.isEmpty ? 'TastyKart' : partner.name,
    );
    return 'upi://pay?pa=$upi&pn=$name&cu=INR';
  }

  @override
  Widget build(BuildContext context) {
    final payload = _payload;
    return Scaffold(
      backgroundColor: AppColors.white,
      body: Column(
        children: [
          const PageHeader(
            title: 'Deposite By QR Code',
            subtitle: 'Customer Or Bank App Can Scan This Code',
          ),
          Expanded(
            child: Center(
              child: payload.isEmpty
                  ? const Padding(
                      padding: EdgeInsets.all(24),
                      child: Text(
                        'Add your UPI ID in bank details to show a QR code.',
                        textAlign: TextAlign.center,
                      ),
                    )
                  : QrImageView(data: payload, size: 220),
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              24,
              8,
              24,
              16 + MediaQuery.paddingOf(context).bottom,
            ),
            child: AppButton(
              label: 'I Have Paid',
              onPressed: () async {
                final amount = await showAmountSheet(
                  context,
                  title: 'Deposite Amount',
                  maxAmount: 5000,
                );
                if (amount == null || amount <= 0 || !context.mounted) return;
                try {
                  await TransactionService.add(
                    partnerId: partner.id,
                    type: 'deposit',
                    title: 'Deposite By QR Code',
                    amount: amount,
                    method: 'qr',
                  );
                  await DeliveryPartnerService.adjustWallet(
                    partnerId: partner.id,
                    delta: amount,
                  );
                  if (context.mounted) {
                    AppFeedback.showSuccess(context, 'Deposit recorded');
                    Navigator.pop(context);
                    Navigator.pop(context);
                  }
                } catch (_) {
                  if (context.mounted) {
                    AppFeedback.showError(context, 'Could not deposit');
                  }
                }
              },
            ),
          ),
        ],
      ),
    );
  }
}
