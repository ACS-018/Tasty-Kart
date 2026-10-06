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
        // Only the order amount (items + tax + platform fee) belongs to
        // TastyKart and goes into cashInHand.
        // Delivery fee + tip belong to the partner and are credited separately
        // to pocketBalance / tipBalance via completeTrip().
        final orderAmount =
            widget.order.total - widget.order.deliveryFee - widget.order.tip;
        cashLimitReached = await DeliveryPartnerService.recordCashCollected(
          partnerId: widget.partner.id,
          amount: orderAmount > 0 ? orderAmount : 0,
        );
      }
      await DeliveryPartnerService.completeTrip(
        partnerId: widget.partner.id,
        payout: widget.order.payout,
        tip: widget.order.tip,
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
              ? 'Delivery completed. Cash limit exceeded — pay the excess above your limit to TastyKart to go online again.'
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

    // Breakdown amounts
    final orderAmt =
        widget.order.total - widget.order.deliveryFee - widget.order.tip;
    final deliveryFee = widget.order.deliveryFee;
    final tip = widget.order.tip;

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
                const SizedBox(height: 12),

                // ── Zomato-style money breakdown card ───────────────
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8F9FA),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFE0E0E0)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'PAYMENT BREAKDOWN',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.8,
                          color: Color(0xFF757575),
                        ),
                      ),
                      const SizedBox(height: 10),

                      // Total collected row
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Customer Pays',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textDark,
                            ),
                          ),
                          Text(
                            amount,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                              color: AppColors.textDark,
                            ),
                          ),
                        ],
                      ),
                      const Divider(height: 16),

                      // TastyKart's share
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: const BoxDecoration(
                                  color: Color(0xFFE65100),
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 8),
                              const Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Order Amount',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFFE65100),
                                    ),
                                  ),
                                  Text(
                                    'Goes to TastyKart (deposit when due)',
                                    style: TextStyle(
                                      fontSize: 10,
                                      color: Color(0xFFBF360C),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          Text(
                            rupee(orderAmt > 0 ? orderAmt : 0),
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFFE65100),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),

                      // Delivery fee — partner's earnings
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: const BoxDecoration(
                                  color: Color(0xFF2E7D32),
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 8),
                              const Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Delivery Fee',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFF2E7D32),
                                    ),
                                  ),
                                  Text(
                                    'Your earnings → Pocket Balance',
                                    style: TextStyle(
                                      fontSize: 10,
                                      color: Color(0xFF388E3C),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          Text(
                            rupee(deliveryFee),
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF2E7D32),
                            ),
                          ),
                        ],
                      ),

                      // Tip row — only show if tip > 0
                      if (tip > 0) ...[
                        const SizedBox(height: 10),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                Container(
                                  width: 8,
                                  height: 8,
                                  decoration: const BoxDecoration(
                                    color: Color(0xFF6A1B9A),
                                    shape: BoxShape.circle,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                const Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Tip',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: Color(0xFF6A1B9A),
                                      ),
                                    ),
                                    Text(
                                      'Customer tip → Tip Balance',
                                      style: TextStyle(
                                        fontSize: 10,
                                        color: Color(0xFF7B1FA2),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                            Text(
                              rupee(tip),
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF6A1B9A),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
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
