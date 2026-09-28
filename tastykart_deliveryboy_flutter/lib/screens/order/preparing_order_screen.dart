import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../constants/color_constants.dart';
import '../../global_widgets/app_button.dart';
import '../../models/delivery_order.dart';
import '../../models/delivery_partner.dart';
import '../../services/delivery_partner_service.dart';
import '../../services/order_service.dart';
import '../../services/settings_service.dart';
import '../../utils/app_feedback.dart';
import 'cancel_order_sheet.dart';

// ── Phase enum ────────────────────────────────────────────────────────────────

/// The three phases the partner cycles through while waiting at the restaurant.
enum _Phase {
  /// Prep countdown is running (5 min hardcoded, same as before).
  preparing,

  /// Prep timer hit 00:00 — show "Restaurant Delaying" help button.
  delayPrompt,

  /// Partner tapped the help button — admin-set waiting countdown is running.
  waitingCountdown,

  /// Waiting countdown also hit 00:00 — show "Transfer Order" button.
  transferPrompt,
}

class PreparingOrderScreen extends StatefulWidget {
  const PreparingOrderScreen({
    super.key,
    required this.order,
    required this.partner,
    required this.cancelReasons,
  });

  final DeliveryOrder order;
  final DeliveryPartner partner;
  final List<String> cancelReasons;

  @override
  State<PreparingOrderScreen> createState() => _PreparingOrderScreenState();
}

class _PreparingOrderScreenState extends State<PreparingOrderScreen> {
  // ── Prep timer ──────────────────────────────────────────────────────────────
  static const _prepTotalSeconds = 5 * 60;
  int _prepLeft = _prepTotalSeconds;
  Timer? _prepTimer;

  // ── Waiting timer (admin-driven) ────────────────────────────────────────────
  int _waitTotalSeconds = 10 * 60; // overwritten from Firestore
  int _waitLeft = 10 * 60;
  Timer? _waitTimer;

  _Phase _phase = _Phase.preparing;
  bool _busy = false;
  bool _settingsLoaded = false;

  @override
  void initState() {
    super.initState();
    _loadWaitSetting();
    _startPrepTimer();
  }

  // ── Load admin setting ──────────────────────────────────────────────────────

  Future<void> _loadWaitSetting() async {
    try {
      final settings = await SettingsService.getSettings();
      if (!mounted) return;
      final minutes = settings.partnerWaitMinutes.clamp(1, 120);
      setState(() {
        _waitTotalSeconds = minutes * 60;
        _waitLeft = _waitTotalSeconds;
        _settingsLoaded = true;
      });
    } catch (_) {
      if (mounted) setState(() => _settingsLoaded = true);
    }
  }

  // ── Timers ──────────────────────────────────────────────────────────────────

  void _startPrepTimer() {
    _prepTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      if (_prepLeft <= 1) {
        t.cancel();
        setState(() {
          _prepLeft = 0;
          _phase = _Phase.delayPrompt;
        });
        AppFeedback.error();
      } else {
        setState(() => _prepLeft--);
      }
    });
  }

  void _startWaitTimer() {
    _waitTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      if (_waitLeft <= 1) {
        t.cancel();
        setState(() {
          _waitLeft = 0;
          _phase = _Phase.transferPrompt;
        });
        AppFeedback.error();
      } else {
        setState(() => _waitLeft--);
      }
    });
  }

  @override
  void dispose() {
    _prepTimer?.cancel();
    _waitTimer?.cancel();
    super.dispose();
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  String _formatSeconds(int s) {
    final m = (s ~/ 60).toString().padLeft(2, '0');
    final sec = (s % 60).toString().padLeft(2, '0');
    return '$m:$sec';
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  /// Partner tapped "Restaurant Delaying? Get Help" — start the waiting timer.
  void _onHelpTapped() {
    if (_phase != _Phase.delayPrompt) return;
    setState(() => _phase = _Phase.waitingCountdown);
    _startWaitTimer();
    // Notify the customer that the restaurant is taking longer than expected.
    OrderService.notifyCustomer(
      order: widget.order,
      type: 'order_delayed',
      title: 'Your order is taking a bit longer 🕐',
      message:
          '${widget.order.restaurantName.isEmpty ? 'The restaurant' : widget.order.restaurantName} '
          'is still preparing your order ${widget.order.displayOrderNumber}. '
          'We\'re waiting and will keep you updated.',
    );
  }

  /// Partner tapped "Transfer Order" — write to Firestore and mark available.
  Future<void> _onTransferTapped() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await OrderService.transferOrder(
        order: widget.order,
        partnerId: widget.partner.id,
      );
      await DeliveryPartnerService.setAvailable(partnerId: widget.partner.id);
      // Notify the customer that their order is being reassigned.
      await OrderService.notifyCustomer(
        order: widget.order,
        type: 'order_transferred',
        title: 'Finding a new delivery partner 🔄',
        message:
            'Your order ${widget.order.displayOrderNumber} couldn\'t be picked up '
            'in time. We\'re assigning a new delivery partner right away — '
            'sorry for the wait!',
      );
      if (mounted) AppFeedback.showSuccess(context, 'Order transferred');
    } catch (_) {
      if (mounted) AppFeedback.showError(context, 'Could not transfer order');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Partner tapped "Confirm Pickup" — proceed normally.
  Future<void> _onPickupTapped() async {
    if (_busy) return;
    // If a waiting timer is running, cancel it — partner picked up before it ran out.
    _waitTimer?.cancel();
    setState(() => _busy = true);
    try {
      await OrderService.confirmPickup(
        order: widget.order,
        partnerId: widget.partner.id,
      );
      if (mounted) AppFeedback.showSuccess(context, 'Order picked up');
    } catch (_) {
      if (mounted) AppFeedback.showError(context, 'Could not confirm pickup');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _onCancelTapped() async {
    if (_busy) return;
    final reason = await CancelOrderSheet.show(
      context,
      reasons: widget.cancelReasons,
    );
    if (reason == null || !mounted) return;
    setState(() => _busy = true);
    _waitTimer?.cancel();
    try {
      await OrderService.cancelByPartner(
        order: widget.order,
        partnerId: widget.partner.id,
        reason: reason,
        phase: 'restaurant',
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

  // ── Build ────────────────────────────────────────────────────────────────────

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

    return Scaffold(
      backgroundColor: AppColors.white,
      body: Column(
        children: [
          // ── Header ──────────────────────────────────────────────────────
          Container(
            width: double.infinity,
            color: AppColors.white,
            padding: EdgeInsets.fromLTRB(4, top + 4, 16, 12),
            child: Row(
              children: [
                IconButton(
                  onPressed: _busy ? null : _onCancelTapped,
                  icon: const Icon(Icons.arrow_back, color: AppColors.textDark),
                ),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Waiting at Restaurant',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textDark,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Please wait for the order to be ready',
                        style: TextStyle(
                          fontSize: 13,
                          color: AppColors.textMedium,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // ── Body ────────────────────────────────────────────────────────
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
              children: [
                const SizedBox(height: 24),
                const _PreparingIllustration(),
                const SizedBox(height: 28),

                // Order info card
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
                      _InfoRow(
                        label: 'Order ID',
                        value: order.displayOrderNumber,
                      ),
                      const Divider(height: 24),
                      _InfoRow(
                        label: 'Restaurant',
                        value: order.restaurantName.isEmpty
                            ? 'Restaurant'
                            : order.restaurantName,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 28),

                // ── Phase-driven timer / status area ─────────────────────
                _PhaseDisplay(
                  phase: _phase,
                  prepSeconds: _prepLeft,
                  waitSeconds: _waitLeft,
                  waitTotalSeconds: _waitTotalSeconds,
                  formatFn: _formatSeconds,
                  onHelpTapped: _onHelpTapped,
                  settingsLoaded: _settingsLoaded,
                ),
              ],
            ),
          ),

          // ── Bottom action button ────────────────────────────────────────
          Padding(
            padding: EdgeInsets.fromLTRB(
              24,
              8,
              24,
              16 + MediaQuery.paddingOf(context).bottom,
            ),
            child: _phase == _Phase.transferPrompt
                ? _TransferButton(
                    busy: _busy,
                    onTransfer: _onTransferTapped,
                    onPickup: _onPickupTapped,
                  )
                : AppButton(
                    label: 'Confirm Pickup',
                    isLoading: _busy,
                    onPressed: _onPickupTapped,
                  ),
          ),
        ],
      ),
    );
  }
}

// ── Phase display widget ──────────────────────────────────────────────────────

class _PhaseDisplay extends StatelessWidget {
  const _PhaseDisplay({
    required this.phase,
    required this.prepSeconds,
    required this.waitSeconds,
    required this.waitTotalSeconds,
    required this.formatFn,
    required this.onHelpTapped,
    required this.settingsLoaded,
  });

  final _Phase phase;
  final int prepSeconds;
  final int waitSeconds;
  final int waitTotalSeconds;
  final String Function(int) formatFn;
  final VoidCallback onHelpTapped;
  final bool settingsLoaded;

  @override
  Widget build(BuildContext context) {
    switch (phase) {
      // ── Prep countdown ─────────────────────────────────────────────────
      case _Phase.preparing:
        return Column(
          children: [
            const Text(
              'Estimated Prep Time',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: AppColors.textMedium,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              formatFn(prepSeconds),
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 40,
                fontWeight: FontWeight.w800,
                color: AppColors.textDark,
                letterSpacing: 1.5,
              ),
            ),
          ],
        );

      // ── Timer expired — delay prompt ───────────────────────────────────
      case _Phase.delayPrompt:
        return Column(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF3E0),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFFFCC80)),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.access_time_rounded,
                    color: Color(0xFFE65100),
                    size: 22,
                  ),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Text(
                      'Restaurant is taking longer than expected.',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFFBF360C),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            // ── Help button ──────────────────────────────────────────────
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: onHelpTapped,
                icon: const Icon(
                  Icons.warning_amber_rounded,
                  size: 18,
                  color: Color(0xFFE65100),
                ),
                label: const Text(
                  'Restaurant Delaying? Get Help',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: Color(0xFFE65100),
                  ),
                ),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  side: const BorderSide(color: Color(0xFFE65100)),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
          ],
        );

      // ── Waiting countdown ──────────────────────────────────────────────
      case _Phase.waitingCountdown:
        final progress = waitTotalSeconds > 0
            ? waitSeconds / waitTotalSeconds
            : 0.0;
        return Column(
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF8E1),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFFFE082)),
              ),
              child: Column(
                children: [
                  const Text(
                    'Waiting for restaurant…',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFFE65100),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    formatFn(waitSeconds),
                    style: const TextStyle(
                      fontSize: 38,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFFE65100),
                      letterSpacing: 1.5,
                    ),
                  ),
                  const SizedBox(height: 12),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: progress.clamp(0.0, 1.0),
                      minHeight: 6,
                      backgroundColor: const Color(0xFFFFECB3),
                      valueColor: const AlwaysStoppedAnimation(
                        Color(0xFFFF6F00),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'If order is not picked up before this timer,\nyou can transfer it.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 11, color: Color(0xFF8D6E63)),
                  ),
                ],
              ),
            ),
          ],
        );

      // ── Transfer prompt ────────────────────────────────────────────────
      case _Phase.transferPrompt:
        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFFFEBEE),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFEF9A9A)),
          ),
          child: Column(
            children: [
              const Icon(
                Icons.swap_horiz_rounded,
                color: AppColors.primary,
                size: 36,
              ),
              const SizedBox(height: 10),
              const Text(
                'Waiting time expired',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'The restaurant has not prepared the order.\nYou can transfer this order to another partner.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 12,
                  color: Color(0xFFB71C1C),
                  height: 1.5,
                ),
              ),
            ],
          ),
        );
    }
  }
}

// ── Transfer + Pickup dual-button strip ──────────────────────────────────────

class _TransferButton extends StatelessWidget {
  const _TransferButton({
    required this.busy,
    required this.onTransfer,
    required this.onPickup,
  });

  final bool busy;
  final VoidCallback onTransfer;
  final VoidCallback onPickup;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Primary: transfer
        SizedBox(
          width: double.infinity,
          height: 52,
          child: ElevatedButton.icon(
            onPressed: busy ? null : onTransfer,
            icon: busy
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.swap_horiz_rounded, size: 20),
            label: const Text(
              'Transfer Order',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
          ),
        ),
        const SizedBox(height: 10),
        // Secondary: pick up anyway
        SizedBox(
          width: double.infinity,
          height: 48,
          child: OutlinedButton(
            onPressed: busy ? null : onPickup,
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: AppColors.primary),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            child: const Text(
              'I Have the Order — Confirm Pickup',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: AppColors.primary,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ── Supporting widgets (unchanged) ───────────────────────────────────────────

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
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
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: const TextStyle(
              color: AppColors.textDark,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    );
  }
}

class _PreparingIllustration extends StatelessWidget {
  const _PreparingIllustration();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 120,
        height: 120,
        decoration: BoxDecoration(
          color: const Color(0xFFFFF0E8),
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withValues(alpha: 0.12),
              blurRadius: 24,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: const Icon(
          Icons.access_time_rounded,
          size: 64,
          color: AppColors.primary,
        ),
      ),
    );
  }
}
