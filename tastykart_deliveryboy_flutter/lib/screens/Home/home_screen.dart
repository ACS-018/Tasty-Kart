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

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
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
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Re-sync tracking when the app returns to the foreground.
    if (state == AppLifecycleState.resumed) {
      _syncTracking(widget.partner);
    }
  }

  @override
  void dispose() {
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
        final incoming = partner.isOnline
            ? OrderService.incomingFor(orders, partnerId: partner.id)
            : null;
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
