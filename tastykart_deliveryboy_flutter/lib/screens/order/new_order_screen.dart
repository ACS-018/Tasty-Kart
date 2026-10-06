import 'dart:async';

import 'package:flutter/material.dart';

import '../../constants/color_constants.dart';
import '../../models/delivery_order.dart';
import '../../models/delivery_partner.dart';
import '../../services/audio_service.dart';
import '../../services/delivery_partner_service.dart';
import '../../services/order_service.dart';
import '../../utils/app_feedback.dart';
import '../../utils/formatters.dart';

class NewOrderScreen extends StatefulWidget {
  const NewOrderScreen({super.key, required this.order, required this.partner});

  final DeliveryOrder order;
  final DeliveryPartner partner;

  @override
  State<NewOrderScreen> createState() => _NewOrderScreenState();
}

class _NewOrderScreenState extends State<NewOrderScreen> {
  static const _seconds = 30;
  int _left = _seconds;
  Timer? _timer;
  bool _busy = false;

  @override
  void initState() {
    super.initState();

    // Start playing the buzzer when new order appears
    _startBuzzer();

    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_left <= 1) {
        timer.cancel();
        _stopBuzzer();
        _reject(auto: true);
      } else {
        setState(() => _left--);
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _stopBuzzer();
    super.dispose();
  }

  /// Start playing the buzzer in loop
  Future<void> _startBuzzer() async {
    try {
      await AudioService.playNewOrderBuzzer();
    } catch (e) {
      debugPrint('Failed to start buzzer: $e');
    }
  }

  /// Stop the buzzer
  Future<void> _stopBuzzer() async {
    try {
      await AudioService.stopBuzzer();
    } catch (e) {
      debugPrint('Failed to stop buzzer: $e');
    }
  }

  Future<void> _accept() async {
    if (_busy) return;
    setState(() => _busy = true);
    _timer?.cancel();
    _stopBuzzer(); // Stop buzzer when order is accepted
    bool orderWritten = false;
    try {
      // 1. Mark partner BUSY *first*. If the assignment write later fails, we
      //    can always clear BUSY again — but leaving them ONLINE while the
      //    order is already marked "accepted" allows them to be reassigned
      //    (admin's nearest-partner finder picks ONLINE+AVAILABLE only).
      await DeliveryPartnerService.setBusy(
        partnerId: widget.partner.id,
        orderId: widget.order.id,
      );

      // 2. Then write the order.accepted flag atomically.
      await OrderService.accept(
        order: widget.order,
        partnerId: widget.partner.id,
        partnerName: widget.partner.name,
      );
      orderWritten = true;

      if (mounted) AppFeedback.showSuccess(context, 'Order accepted');
    } catch (e) {
      // 🔧 Rollback / rescue: if we already marked BUSY but the order
      // write failed, clear BUSY immediately so the partner isn't locked
      // out of future assignments until their next offline→online toggle.
      if (!orderWritten) {
        DeliveryPartnerService.reconcileStuckBusy(
          widget.partner.id,
        ).catchError((_) => false);
      }
      if (mounted) {
        AppFeedback.showError(context, 'Could not accept this order');
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reject({bool auto = false}) async {
    if (_busy) return;
    setState(() => _busy = true);
    _timer?.cancel();
    _stopBuzzer(); // Stop buzzer when order is rejected
    try {
      await OrderService.reject(
        order: widget.order,
        partnerId: widget.partner.id,
        reason: auto ? 'Auto-rejected (timeout)' : 'Partner declined',
      );

      // 🔧 Defensive: after any rejection, immediately clear BUSY + currentOrder
      // on the partner doc so the admin auto-assigner can pick this partner
      // for a subsequent order without the user having to toggle offline.
      await DeliveryPartnerService.reconcileStuckBusy(widget.partner.id);
      await DeliveryPartnerService.setAvailable(partnerId: widget.partner.id);

      if (mounted && !auto) {
        AppFeedback.showSnackBar(context, message: 'Order rejected');
      }
    } catch (_) {
      // Even if the OrderService.reject call failed (network / permission),
      // best-effort clear the partner status so they don't get stuck on screen.
      DeliveryPartnerService.reconcileStuckBusy(
        widget.partner.id,
      ).catchError((_) => false);
      if (mounted) {
        AppFeedback.showError(context, 'Could not reject this order');
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final pickup = order.restaurantAddress.isEmpty
        ? order.restaurantName
        : '${order.restaurantName}, ${order.restaurantAddress}';
    final drop = order.address.isEmpty ? order.customerName : order.address;

    return Scaffold(
      // Primary colour fills the status-bar safe-area region at the top.
      backgroundColor: AppColors.primary,
      body: Column(
        children: [
          // ── Top: header with primary background (covers status bar) ──────
          Container(
            color: AppColors.primary,
            child: SafeArea(
              bottom: false,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(8, 8, 16, 12),
                child: Row(
                  children: [
                    IconButton(
                      onPressed: _busy ? null : () => _reject(),
                      icon: const Icon(
                        Icons.arrow_back,
                        color: AppColors.white,
                      ),
                    ),
                    const Text(
                      'New Order',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: AppColors.white,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // ── Body ─────────────────────────────────────────────────────────
          Expanded(
            child: Container(
              color: AppColors.surface,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                children: [
                  Container(
                    decoration: BoxDecoration(
                      color: AppColors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.06),
                          blurRadius: 10,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    child: Column(
                      children: [
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: const BoxDecoration(
                            color: AppColors.success,
                            borderRadius: BorderRadius.vertical(
                              top: Radius.circular(16),
                            ),
                          ),
                          child: const Text(
                            'New Order',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: AppColors.white,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
                          child: Column(
                            children: [
                              Row(
                                children: [
                                  Text(
                                    rupee(order.payout),
                                    style: const TextStyle(
                                      fontSize: 32,
                                      fontWeight: FontWeight.w800,
                                      color: AppColors.textDark,
                                    ),
                                  ),
                                  const Spacer(),
                                  if (order.totalDistanceLabel.isNotEmpty)
                                    Text(
                                      order.totalDistanceLabel,
                                      style: const TextStyle(
                                        color: AppColors.textMedium,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                ],
                              ),
                              const SizedBox(height: 18),
                              _Stop(
                                icon: Icons.storefront,
                                title: pickup.isEmpty ? 'Restaurant' : pickup,
                                distance: order.pickupKm > 0
                                    ? '${order.pickupKm.toStringAsFixed(1)} Km'
                                    : '',
                                isLast: false,
                              ),
                              _Stop(
                                icon: Icons.person_outline,
                                title: drop.isEmpty ? 'Customer' : drop,
                                distance: order.dropKm > 0
                                    ? '${order.dropKm.toStringAsFixed(1)} Km'
                                    : '',
                                isLast: true,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
              ),
            ),
          ),

          // ── Bottom action bar ─────────────────────────────────────────────
          Container(
            color: AppColors.surface,
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '$_left Sec',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textDark,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: _busy ? null : () => _reject(),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: AppColors.primary,
                              side: const BorderSide(
                                color: AppColors.primary,
                                width: 1.5,
                              ),
                              minimumSize: const Size.fromHeight(52),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            child: const Text(
                              'Reject',
                              style: TextStyle(fontWeight: FontWeight.w700),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: _busy ? null : _accept,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.success,
                              foregroundColor: AppColors.white,
                              minimumSize: const Size.fromHeight(52),
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            child: const Text(
                              'Accept',
                              style: TextStyle(fontWeight: FontWeight.w700),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Stop extends StatelessWidget {
  const _Stop({
    required this.icon,
    required this.title,
    required this.distance,
    required this.isLast,
  });

  final IconData icon;
  final String title;
  final String distance;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            Icon(icon, color: AppColors.primary, size: 22),
            if (!isLast)
              Container(
                width: 2,
                height: 36,
                margin: const EdgeInsets.symmetric(vertical: 4),
                color: AppColors.divider,
              ),
          ],
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    color: AppColors.textDark,
                  ),
                ),
                if (distance.isNotEmpty)
                  Text(
                    distance,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textMedium,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
