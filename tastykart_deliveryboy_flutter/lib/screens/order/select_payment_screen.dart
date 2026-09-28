import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../constants/color_constants.dart';
import '../../models/delivery_order.dart';
import '../../models/delivery_partner.dart';
import '../../services/delivery_partner_service.dart';
import '../../services/order_service.dart';
import '../../services/transaction_service.dart';
import '../../utils/app_feedback.dart';
import 'partner_review_screen.dart';
import '../../utils/formatters.dart';
import '../../widgets/app_check_box.dart';
import '../../widgets/page_header.dart';
import '../../widgets/slide_to_pay.dart';

class SelectPaymentScreen extends StatefulWidget {
  const SelectPaymentScreen({
    super.key,
    required this.order,
    required this.partner,
  });

  final DeliveryOrder order;
  final DeliveryPartner partner;

  @override
  State<SelectPaymentScreen> createState() => _SelectPaymentScreenState();
}

class _SelectPaymentScreenState extends State<SelectPaymentScreen> {
  /// `cash` or `qr`. Stays empty until the partner picks one.
  String? _method;
  bool _busy = false;

  bool get _cash => _method == 'cash';

  String get _upiId => widget.partner.upiId.trim().toLowerCase();

  bool get _hasUpi => _upiId.contains('@');

  /// NPCI UPI link. The VPA is left unencoded so `@` survives the scan.
  String get _upiPayload {
    if (!_hasUpi || widget.order.total <= 0) return '';
    final name = _upiLabel(
      widget.partner.name.isEmpty ? 'TastyKart' : widget.partner.name,
    );
    final note = _upiLabel(widget.order.displayOrderNumber);
    final amount = widget.order.total.toStringAsFixed(2);
    return 'upi://pay?pa=$_upiId&pn=${Uri.encodeComponent(name)}&am=$amount&cu=INR&tn=${Uri.encodeComponent(note)}';
  }

  String _upiLabel(String raw) {
    final cleaned = raw.replaceAll(RegExp(r'[^A-Za-z0-9 ]'), ' ').trim();
    final compact = cleaned.replaceAll(RegExp(r'\s+'), ' ');
    if (compact.isEmpty) return 'TastyKart';
    return compact.length > 40 ? compact.substring(0, 40) : compact;
  }

  bool _allowPay() {
    if (_method == null) {
      AppFeedback.showError(context, 'Select cash or QR payment first');
      return false;
    }
    if (_method == 'qr' && !_hasUpi) {
      AppFeedback.showError(
        context,
        'Add your UPI ID in bank details to collect by QR',
      );
      return false;
    }
    if (_method == 'qr' && widget.order.total <= 0) {
      AppFeedback.showError(context, 'This order has no amount to collect');
      return false;
    }
    return true;
  }

  Future<void> _confirm() async {
    if (_busy) return;
    if (!_allowPay()) return;
    setState(() => _busy = true);
    try {
      await OrderService.completeDelivery(
        order: widget.order,
        partnerId: widget.partner.id,
        collectedVia: _cash ? 'cash' : 'upi',
      );
      var cashLimitReached = false;
      if (_cash) {
        cashLimitReached = await DeliveryPartnerService.recordCashCollected(
          partnerId: widget.partner.id,
          amount: widget.order.total,
        );
      }
      await DeliveryPartnerService.completeTrip(
        partnerId: widget.partner.id,
        payout: widget.order.payout,
      );
      try {
        await TransactionService.add(
          partnerId: widget.partner.id,
          type: 'order',
          title: 'From Order ${widget.order.displayOrderNumber}',
          amount: widget.order.payout,
          method: _cash ? 'cash' : 'upi',
          orderNumber: widget.order.orderNumber,
        );
      } catch (_) {}
      if (mounted) {
        AppFeedback.showSuccess(
          context,
          cashLimitReached
              ? 'Delivery completed. Cash limit reached, so you are offline until the extra cash is paid.'
              : 'Delivery completed',
        );
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(
            builder: (_) => PartnerReviewScreen(
              order: widget.order,
              partner: widget.partner,
            ),
          ),
          (route) => route.isFirst,
        );
      }
    } catch (_) {
      if (mounted) {
        AppFeedback.showError(context, 'Could not complete payment');
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

    final amount = rupee(widget.order.total);
    final upi = _upiPayload;

    return Scaffold(
      backgroundColor: AppColors.white,
      body: Column(
        children: [
          const PageHeader(
            title: 'Select Payment',
            subtitle: 'Your Money Receiving Method',
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
              children: [
                Text(
                  'Collect $amount',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textDark,
                  ),
                ),
                const SizedBox(height: 20),
                Center(
                  child: _method != 'qr'
                      ? const SizedBox(height: 8)
                      : upi.isEmpty
                      ? Container(
                          width: 220,
                          height: 220,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            border: Border.all(color: AppColors.divider),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: const Padding(
                            padding: EdgeInsets.all(16),
                            child: Text(
                              'Add your UPI ID in bank details to show a QR code.',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: AppColors.textMedium),
                            ),
                          ),
                        )
                      : Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: AppColors.divider),
                          ),
                          child: QrImageView(
                            data: upi,
                            size: 220,
                            backgroundColor: AppColors.white,
                            gapless: false,
                            errorCorrectionLevel: QrErrorCorrectLevel.M,
                          ),
                        ),
                ),
                const SizedBox(height: 16),
                InkWell(
                  onTap: () {
                    AppFeedback.selection();
                    setState(() => _method = 'qr');
                  },
                  borderRadius: BorderRadius.circular(12),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.qr_code_2,
                          color: AppColors.primary,
                          size: 28,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'Collect By QR $amount',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textDark,
                            ),
                          ),
                        ),
                        AppCheckBox(selected: _method == 'qr'),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                const Row(
                  children: [
                    Expanded(child: Divider()),
                    Padding(
                      padding: EdgeInsets.symmetric(horizontal: 12),
                      child: Text(
                        'Or',
                        style: TextStyle(
                          color: AppColors.textMedium,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    Expanded(child: Divider()),
                  ],
                ),
                const SizedBox(height: 16),
                InkWell(
                  onTap: () {
                    AppFeedback.selection();
                    setState(() => _method = 'cash');
                  },
                  borderRadius: BorderRadius.circular(12),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.payments_outlined,
                          color: AppColors.primary,
                          size: 28,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'Collect Cash $amount',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textDark,
                            ),
                          ),
                        ),
                        AppCheckBox(selected: _cash),
                      ],
                    ),
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
            child: SlideToPay(
              label: 'Payment',
              loading: _busy,
              allowConfirm: _allowPay,
              onConfirm: _confirm,
            ),
          ),
        ],
      ),
    );
  }
}
