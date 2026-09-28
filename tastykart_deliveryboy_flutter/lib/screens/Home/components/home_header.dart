import 'package:flutter/material.dart';

import '../../../constants/app_constants.dart';
import '../../../constants/color_constants.dart';
import '../../../models/delivery_partner.dart';
import '../../../services/delivery_partner_service.dart';
import '../../../services/location_service.dart';
import '../../../services/settings_service.dart';
import '../../../utils/app_feedback.dart';
import '../../../utils/app_navigation.dart';
import '../../../utils/formatters.dart';
import '../../earnings/cash_deposit_screen.dart';
import '../../notifications/notifications_screen.dart';
import '../sos_sheet.dart';

class HomeHeader extends StatefulWidget {
  const HomeHeader({super.key, required this.partner, this.compact = false});

  final DeliveryPartner partner;
  final bool compact;

  @override
  State<HomeHeader> createState() => _HomeHeaderState();
}

class _HomeHeaderState extends State<HomeHeader> {
  bool _toggling = false;

  /// Toggle online/offline.
  /// - Going **online**: request location permission, start background tracking,
  ///   then write status to Firestore.
  /// - Going **offline**: stop background tracking, then write status.
  Future<void> _toggle(bool goOnline) async {
    if (_toggling) return;
    setState(() => _toggling = true);
    AppFeedback.selection();

    try {
      if (goOnline) {
        final settings = await SettingsService.getSettings(forceRefresh: true);
        final limit = widget.partner.effectiveCashLimit(
          settings.deliveryPartner.cashLimitDefault,
        );
        if (widget.partner.cashDue(limit) > 0) {
          if (mounted) {
            AppFeedback.showError(
              context,
              'Cash limit reached. Pay the extra cash to go online.',
            );
            await AppNavigation.push(
              context,
              CashDepositScreen(partner: widget.partner, cashLimit: limit),
            );
          }
          return;
        }

        // 1. Ensure location permission before going online.
        final hasPermission = await LocationService.ensurePermission();
        if (!hasPermission) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Location permission is required to go online.'),
                behavior: SnackBarBehavior.floating,
              ),
            );
          }
          return;
        }

        // 2. Set Firestore status online.
        try {
          await DeliveryPartnerService.setOnline(
            partnerId: widget.partner.id,
            online: true,
            currentStatus: widget.partner.status,
          );
        } on CashLimitException {
          if (mounted) {
            AppFeedback.showError(
              context,
              'Cash limit reached. Pay the extra cash to go online.',
            );
            await AppNavigation.push(
              context,
              CashDepositScreen(partner: widget.partner, cashLimit: limit),
            );
          }
          return;
        }

        // 3. Start continuous background location tracking.
        await LocationService.startBackgroundTracking(
          partnerId: widget.partner.id,
        );
      } else {
        // 1. Stop location tracking.
        LocationService.stopBackgroundTracking();

        // 2. Set Firestore status offline.
        await DeliveryPartnerService.setOnline(
          partnerId: widget.partner.id,
          online: false,
          currentStatus: widget.partner.status,
        );
      }
    } finally {
      if (mounted) setState(() => _toggling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    final online = widget.partner.isOnline;
    final name = widget.partner.firstName.isEmpty
        ? 'Partner'
        : widget.partner.firstName;

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: AppColors.primary,
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.4),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: EdgeInsets.fromLTRB(16, top + 8, 16, widget.compact ? 12 : 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Top row: toggle · SOS · bell · avatar ──────────────────────
          Row(
            children: [
              // Online/offline pill toggle
              _OnlineToggle(
                online: online,
                toggling: _toggling,
                onToggle: _toggle,
              ),
              const Spacer(),
              // SOS
              _HeaderIconButton(
                label: 'SOS',
                isText: true,
                onTap: () => SosSheet.show(context),
              ),
              const SizedBox(width: 4),
              // Notifications
              _HeaderIconButton(
                icon: Icons.notifications_outlined,
                onTap: () => AppNavigation.push(
                  context,
                  NotificationsScreen(partnerId: widget.partner.id, notificationsEnabled: widget.partner.notificationsEnabled),
                ),
              ),
              const SizedBox(width: 6),
              _Avatar(url: widget.partner.avatar, name: widget.partner.name),
            ],
          ),

          if (!widget.compact) ...[
            const SizedBox(height: 16),
            // ── Greeting + bike icon ────────────────────────────────────
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${greetingFor(DateTime.now())}, $name 👋',
                        style: const TextStyle(
                          color: AppColors.white,
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          height: 1.2,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        online
                            ? 'You\'re live — ready to earn!'
                            : AppConstants.readyLine,
                        style: TextStyle(
                          color: AppColors.white.withValues(alpha: 0.85),
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                // Status indicator circle
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.white.withValues(alpha: 0.15),
                  ),
                  child: Icon(
                    online
                        ? Icons.delivery_dining
                        : Icons.delivery_dining_outlined,
                    color: online
                        ? AppColors.white
                        : AppColors.white.withValues(alpha: 0.5),
                    size: 32,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            // ── Location tracking status bar ────────────────────────────
            _LocationStatusBar(online: online),
          ],
        ],
      ),
    );
  }
}

// ── Online/Offline pill toggle ─────────────────────────────────────────────

class _OnlineToggle extends StatelessWidget {
  const _OnlineToggle({
    required this.online,
    required this.toggling,
    required this.onToggle,
  });

  final bool online;
  final bool toggling;
  final Future<void> Function(bool) onToggle;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: toggling ? null : () => onToggle(!online),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: online
              ? AppColors.online.withValues(alpha: 0.9)
              : AppColors.white.withValues(alpha: 0.18),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: online
                ? AppColors.online
                : AppColors.white.withValues(alpha: 0.5),
            width: 1.5,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Animated status dot
            AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: online ? AppColors.white : const Color(0xFFBDBDBD),
              ),
            ),
            const SizedBox(width: 7),
            if (toggling)
              const SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: AppColors.white,
                ),
              )
            else
              Text(
                online ? 'Online' : 'Offline',
                style: const TextStyle(
                  color: AppColors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 13,
                  letterSpacing: 0.3,
                ),
              ),
            const SizedBox(width: 7),
            // Chevron hint
            Icon(
              online
                  ? Icons.keyboard_arrow_down_rounded
                  : Icons.keyboard_arrow_up_rounded,
              color: AppColors.white.withValues(alpha: 0.8),
              size: 16,
            ),
          ],
        ),
      ),
    );
  }
}

// ── Location tracking status bar ────────────────────────────────────────────

class _LocationStatusBar extends StatelessWidget {
  const _LocationStatusBar({required this.online});

  final bool online;

  @override
  Widget build(BuildContext context) {
    return AnimatedSize(
      duration: const Duration(milliseconds: 300),
      child: online
          ? Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              decoration: BoxDecoration(
                color: AppColors.white.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Pulsing dot
                  _PulsingDot(),
                  const SizedBox(width: 8),
                  Text(
                    'Live location sharing active',
                    style: TextStyle(
                      color: AppColors.white.withValues(alpha: 0.95),
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const Spacer(),
                  Icon(
                    Icons.location_on_rounded,
                    color: AppColors.white.withValues(alpha: 0.8),
                    size: 16,
                  ),
                ],
              ),
            )
          : const SizedBox.shrink(),
    );
  }
}

// ── Pulsing location dot ────────────────────────────────────────────────────

class _PulsingDot extends StatefulWidget {
  @override
  State<_PulsingDot> createState() => _PulsingDotState();
}

class _PulsingDotState extends State<_PulsingDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);
    _scale = Tween<double>(
      begin: 0.6,
      end: 1.2,
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ScaleTransition(
      scale: _scale,
      child: Container(
        width: 8,
        height: 8,
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          color: AppColors.white,
        ),
      ),
    );
  }
}

// ── Header icon / text button ────────────────────────────────────────────────

class _HeaderIconButton extends StatelessWidget {
  const _HeaderIconButton({
    this.icon,
    this.label,
    this.isText = false,
    required this.onTap,
  });

  final IconData? icon;
  final String? label;
  final bool isText;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: AppColors.white.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(8),
        ),
        child: isText
            ? Text(
                label ?? '',
                style: const TextStyle(
                  color: AppColors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 13,
                ),
              )
            : Icon(icon, color: AppColors.white, size: 20),
      ),
    );
  }
}

// ── Avatar ────────────────────────────────────────────────────────────────────

class _Avatar extends StatelessWidget {
  const _Avatar({required this.url, required this.name});

  final String? url;
  final String name;

  @override
  Widget build(BuildContext context) {
    final letter = name.trim().isEmpty ? 'P' : name.trim()[0].toUpperCase();
    return CircleAvatar(
      radius: 18,
      backgroundColor: AppColors.white,
      backgroundImage: url != null && url!.isNotEmpty
          ? NetworkImage(url!)
          : null,
      child: url == null || url!.isEmpty
          ? Text(
              letter,
              style: const TextStyle(
                color: AppColors.primary,
                fontWeight: FontWeight.w700,
              ),
            )
          : null,
    );
  }
}
