import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../constants/color_constants.dart';
import '../../global_widgets/app_button.dart';
import '../../models/delivery_order.dart';
import '../../models/delivery_partner.dart';
import '../../services/delivery_partner_service.dart';
import '../../services/order_service.dart';
import '../../utils/app_feedback.dart';
import '../../utils/formatters.dart';
import 'cancel_order_sheet.dart';
import 'order_chat_screen.dart';
import 'select_payment_screen.dart';

class CustomerDetailsScreen extends StatefulWidget {
  const CustomerDetailsScreen({
    super.key,
    required this.order,
    required this.partner,
  });

  final DeliveryOrder order;
  final DeliveryPartner partner;

  @override
  State<CustomerDetailsScreen> createState() => _CustomerDetailsScreenState();
}

class _CustomerDetailsScreenState extends State<CustomerDetailsScreen> {
  // 4-digit OTP entry
  static const _otpLength = 4;
  final List<TextEditingController> _ctrl = List.generate(
    _otpLength,
    (_) => TextEditingController(),
  );
  final List<FocusNode> _focus = List.generate(_otpLength, (_) => FocusNode());

  bool _busy = false;
  bool _otpError = false;

  @override
  void dispose() {
    for (final c in _ctrl) {
      c.dispose();
    }
    for (final f in _focus) {
      f.dispose();
    }
    super.dispose();
  }

  String get _enteredOtp => _ctrl.map((c) => c.text).join();

  void _onDigit(String value, int index) {
    if (value.length > 1) {
      final digits = value.replaceAll(RegExp(r'\D'), '');
      for (var i = 0; i < _otpLength; i++) {
        _ctrl[i].text = i < digits.length ? digits[i] : '';
      }
      final next =
          (digits.length >= _otpLength ? _otpLength - 1 : digits.length).clamp(
            0,
            _otpLength - 1,
          );
      _focus[next].requestFocus();
      setState(() => _otpError = false);
      return;
    }
    if (value.length == 1 && index < _otpLength - 1) {
      _focus[index + 1].requestFocus();
    }
    if (value.isEmpty && index > 0) {
      _focus[index - 1].requestFocus();
    }
    setState(() => _otpError = false);
  }

  Future<void> _cancel() async {
    if (_busy) return;
    final reason = await CancelOrderSheet.show(
      context,
      reasons: const [
        'Customer not available',
        'Customer refused delivery',
        'Address not found',
        'Other',
      ],
    );
    if (reason == null || !mounted) return;
    setState(() => _busy = true);
    try {
      await OrderService.cancelByPartner(
        order: widget.order,
        partnerId: widget.partner.id,
        reason: reason,
        phase: 'customer',
      );
      await DeliveryPartnerService.setAvailable(partnerId: widget.partner.id);
      if (mounted) {
        AppFeedback.showSnackBar(context, message: 'Order cancelled');
      }
    } catch (_) {
      if (mounted) {
        AppFeedback.showError(context, 'Could not cancel this order');
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _verifyAndProceed() async {
    if (_busy) return;

    // Validate OTP length
    if (_enteredOtp.length < _otpLength) {
      setState(() => _otpError = true);
      AppFeedback.showError(context, 'Please enter the 4-digit delivery OTP');
      return;
    }

    // Validate against order's deliveryOtp field
    final expected = widget.order.deliveryOtp;
    if (expected.isNotEmpty && _enteredOtp != expected) {
      setState(() => _otpError = true);
      AppFeedback.showError(context, 'Incorrect OTP — please ask the customer');
      return;
    }

    // OTP correct — navigate to payment/completion
    if (!mounted) return;
    AppFeedback.light();
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) =>
            SelectPaymentScreen(order: widget.order, partner: widget.partner),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
      ),
    );

    final top = MediaQuery.paddingOf(context).top;
    final order = widget.order;
    final width = MediaQuery.sizeOf(context).width;
    final boxW = ((width - 48 - 36) / _otpLength).clamp(52.0, 68.0);

    return Scaffold(
      backgroundColor: AppColors.white,
      body: Column(
        children: [
          // ── Header ────────────────────────────────────────────────
          Container(
            width: double.infinity,
            color: AppColors.white,
            padding: EdgeInsets.fromLTRB(4, top + 4, 16, 12),
            child: Row(
              children: [
                IconButton(
                  onPressed: _busy ? null : _cancel,
                  icon: const Icon(Icons.arrow_back, color: AppColors.textDark),
                ),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Verify Delivery',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textDark,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Enter the OTP shown by the customer',
                        style: TextStyle(
                          fontSize: 13,
                          color: AppColors.textMedium,
                        ),
                      ),
                    ],
                  ),
                ),
                // Chat button
                IconButton(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => DeliveryOrderChatScreen(
                        order: widget.order,
                        partner: widget.partner,
                      ),
                    ),
                  ),
                  icon: const Icon(
                    Icons.chat_rounded,
                    color: AppColors.primary,
                  ),
                  tooltip: 'Chat with customer',
                ),
              ],
            ),
          ),

          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
              children: [
                // ── Customer + address info ────────────────────────
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.divider),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.04),
                        blurRadius: 10,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      _row(
                        icon: Icons.person_outline,
                        title: order.customerName.isEmpty
                            ? 'Customer'
                            : order.customerName,
                      ),
                      const SizedBox(height: 16),
                      _row(
                        icon: Icons.location_on_outlined,
                        title: order.addressPrimary,
                        subtitle: order.addressSecondary,
                      ),
                      const Divider(height: 24),
                      _detail('Order ID', order.displayOrderNumber),
                      const Divider(height: 20),
                      _detail('Order Amount', rupee(order.total)),
                      const Divider(height: 20),
                      Row(
                        children: [
                          const Text(
                            'Payment',
                            style: TextStyle(
                              color: AppColors.textMedium,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const Spacer(),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: order.isOnlinePaid
                                  ? const Color(0xFFE8F5E9)
                                  : const Color(0xFFFFF3E0),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              order.isOnlinePaid ? 'Online Paid' : 'COD',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: order.isOnlinePaid
                                    ? AppColors.success
                                    : const Color(0xFFEF6C00),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 28),

                // ── OTP instruction ────────────────────────────────
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.06),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: AppColors.primary.withValues(alpha: 0.2),
                    ),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.info_outline_rounded,
                        color: AppColors.primary,
                        size: 18,
                      ),
                      const SizedBox(width: 10),
                      const Expanded(
                        child: Text(
                          'Ask the customer to show their delivery OTP from the app and enter it below.',
                          style: TextStyle(
                            fontSize: 13,
                            color: AppColors.primary,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // ── 4-digit OTP input boxes ───────────────────────
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: List.generate(_otpLength, (i) {
                    return SizedBox(
                      width: boxW,
                      height: boxW,
                      child: TextField(
                        controller: _ctrl[i],
                        focusNode: _focus[i],
                        textAlign: TextAlign.center,
                        keyboardType: TextInputType.number,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                        ],
                        maxLength: i == 0 ? _otpLength : 1,
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w800,
                          color: _otpError
                              ? AppColors.error
                              : AppColors.textDark,
                        ),
                        decoration: InputDecoration(
                          counterText: '',
                          filled: true,
                          fillColor: _otpError
                              ? AppColors.error.withValues(alpha: 0.05)
                              : AppColors.white,
                          contentPadding: EdgeInsets.zero,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(
                              color: _otpError
                                  ? AppColors.error
                                  : AppColors.inputBorder,
                            ),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(
                              color: _otpError
                                  ? AppColors.error
                                  : AppColors.inputBorder,
                            ),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(
                              color: _otpError
                                  ? AppColors.error
                                  : AppColors.primary,
                              width: 1.5,
                            ),
                          ),
                        ),
                        onChanged: (v) => _onDigit(v, i),
                      ),
                    );
                  }),
                ),

                if (_otpError) ...[
                  const SizedBox(height: 8),
                  const Text(
                    'Incorrect OTP — please try again',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.error,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ],
            ),
          ),

          // ── Verify button ─────────────────────────────────────────
          Padding(
            padding: EdgeInsets.fromLTRB(
              24,
              8,
              24,
              16 + MediaQuery.paddingOf(context).bottom,
            ),
            child: AppButton(
              label: 'Verify & Collect',
              isLoading: _busy,
              onPressed: _verifyAndProceed,
            ),
          ),
        ],
      ),
    );
  }

  Widget _row({
    required IconData icon,
    required String title,
    String? subtitle,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: AppColors.primary, size: 26),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textDark,
                ),
              ),
              if (subtitle != null && subtitle.isNotEmpty)
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textMedium,
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _detail(String label, String value) {
    return Row(
      children: [
        Text(
          label,
          style: const TextStyle(
            color: AppColors.textMedium,
            fontWeight: FontWeight.w500,
          ),
        ),
        const Spacer(),
        Text(
          value,
          style: const TextStyle(
            color: AppColors.textDark,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}
