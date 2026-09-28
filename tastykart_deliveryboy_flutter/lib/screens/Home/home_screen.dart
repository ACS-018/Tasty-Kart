import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../constants/color_constants.dart';
import '../../models/delivery_order.dart';
import '../../models/delivery_partner.dart';
import '../../services/delivery_partner_service.dart';
import '../../services/fcm_service.dart';
import '../../services/location_service.dart';
import '../../services/order_service.dart';
import '../../services/settings_service.dart';
import '../../utils/app_feedback.dart';
import '../earnings/earnings_tab.dart';
import '../order/active_delivery_host.dart';
import '../order/new_order_screen.dart';
import '../profile/profile_screen.dart';
import '../profile/trips_history_screen.dart';
import 'components/partner_bottom_nav.dart';
import 'home_tab.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.partner});

  final DeliveryPartner partner;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  int _index = 0;

  /// Tracks whether we last knew the partner to be online so we only
  /// start/stop location tracking on actual transitions, not on every rebuild.
  bool? _wasOnline;

  /// Admin default cash limit; null until settings load.
  int? _adminCashLimit;
  StreamSubscription<PlatformSettings>? _settingsSub;
  bool _enforcingCash = false;
  final Set<String> _returnedOrders = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _settingsSub = SettingsService.watchSettings().listen((settings) {
      final limit = settings.deliveryPartner.cashLimitDefault;
      if (limit == _adminCashLimit) return;
      if (mounted) setState(() => _adminCashLimit = limit);
      _enforceCashLimit();
    });
    _enforceCashLimit();
    // Register this device only while the partner has notifications on.
    unawaited(
      FCMService.syncPartnerPreference(
        partnerId: widget.partner.id,
        enabled: widget.partner.notificationsEnabled,
      ),
    );
    // Auto-start location tracking if already online (e.g. app restarted).
    _syncTracking(widget.partner);
    if (widget.partner.isOnline) {
      DeliveryPartnerService.touchOnlineSession(widget.partner.id);
    }
  }

  @override
  void didUpdateWidget(HomeScreen old) {
    super.didUpdateWidget(old);
    // AuthGate pushes a fresh `partner` object whenever the Firestore doc
    // changes. React only to online-status transitions.
    if (old.partner.isOnline != widget.partner.isOnline) {
      _syncTracking(widget.partner);
    }
    if (old.partner.cashInHand != widget.partner.cashInHand ||
        old.partner.cashLimit != widget.partner.cashLimit ||
        old.partner.status != widget.partner.status) {
      _enforceCashLimit();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Re-sync tracking when the app returns to the foreground.
    if (state == AppLifecycleState.resumed) {
      _syncTracking(widget.partner);
      _enforceCashLimit();
    }
  }

  bool _overCashLimit(DeliveryPartner partner) {
    final adminLimit = _adminCashLimit;
    if (adminLimit == null && partner.cashLimit <= 0) return false;
    return partner.cashLimitExceeded(partner.effectiveCashLimit(adminLimit ?? 0));
  }

  /// Takes the partner offline if they are online with cash in hand at or above
  /// the limit. Mid-trip partners are handled when the trip completes.
  Future<void> _enforceCashLimit() async {
    if (_enforcingCash) return;
    final partner = widget.partner;
    final status = partner.status.toLowerCase().trim();
    if (status != 'online' && status != 'available') return;
    _enforcingCash = true;
    try {
      final forced = await DeliveryPartnerService.enforceCashLimit(partner.id);
      if (forced && mounted) {
        AppFeedback.showError(
          context,
          'Cash limit reached. Pay your cash in hand to TastyKart to go online again.',
        );
      }
    } catch (_) {
    } finally {
      _enforcingCash = false;
    }
  }

  /// Hands an order assigned while over the cash limit back for reassignment.
  void _returnOrder(DeliveryOrder order, DeliveryPartner partner) {
    if (!_returnedOrders.add(order.id)) return;
    unawaited(
      OrderService.reject(
        order: order,
        partnerId: partner.id,
        reason: 'Cash limit reached',
      ).catchError((_) {
        _returnedOrders.remove(order.id);
      }),
    );
  }

  @override
  void dispose() {
    _settingsSub?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    // Stop tracking when the screen is permanently removed (e.g. logout).
    LocationService.stopBackgroundTracking();
    super.dispose();
  }

  /// Start or stop background tracking based on [partner.isOnline].
  /// Guards against redundant calls by checking [_wasOnline].
  void _syncTracking(DeliveryPartner partner) {
    final nowOnline = partner.isOnline;
    if (_wasOnline == nowOnline) return; // No change — do nothing.
    _wasOnline = nowOnline;

    if (nowOnline) {
      LocationService.startBackgroundTracking(partnerId: partner.id);
    } else {
      LocationService.stopBackgroundTracking();
    }
  }

  @override
  Widget build(BuildContext context) {
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
      ),
    );

    final partner = widget.partner;

    return StreamBuilder<List<DeliveryOrder>>(
      stream: OrderService.watchForPartner(partner.id),
      builder: (context, snapshot) {
        final orders = snapshot.data ?? const <DeliveryOrder>[];
        final assigned = partner.isOnline
            ? OrderService.incomingFor(orders, partnerId: partner.id)
            : null;
        final overLimit = _overCashLimit(partner);
        if (assigned != null && overLimit) {
          WidgetsBinding.instance.addPostFrameCallback(
            (_) => _returnOrder(assigned, partner),
          );
        }
        final incoming = overLimit ? null : assigned;
        final active = incoming == null
            ? OrderService.activeTripFor(orders)
            : null;
        final inTrip = incoming != null || active != null;

        Widget body;
        if (incoming != null) {
          body = NewOrderScreen(
            key: ValueKey(incoming.id),
            order: incoming,
            partner: partner,
          );
        } else if (active != null) {
          body = ActiveDeliveryHost(
            key: ValueKey(active.id),
            order: active,
            partner: partner,
          );
        } else {
          body = IndexedStack(
            index: _index,
            children: [
              HomeTab(partner: partner),
              TripsHistoryScreen(partner: partner),
              EarningsTab(partner: partner),
              ProfileScreen(partner: partner),
            ],
          );
        }

        return Scaffold(
          backgroundColor: AppColors.surface,
          body: body,
          bottomNavigationBar: inTrip
              ? null
              : PartnerBottomNav(
                  currentIndex: _index,
                  onTap: (value) {
                    AppFeedback.light();
                    setState(() => _index = value);
                  },
                ),
        );
      },
    );
  }
}
