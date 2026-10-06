import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../constants/cancel_reasons.dart';
import '../../constants/color_constants.dart';
import '../../constants/delivery_stage.dart';
import '../../constants/map_constants.dart';
import '../../models/delivery_order.dart';
import '../../models/delivery_partner.dart';
import '../../services/geocoding_service.dart';
import '../../services/order_service.dart';
import 'preparing_order_screen.dart';
import 'customer_details_screen.dart';
import 'trip_navigation_screen.dart';

class ActiveDeliveryHost extends StatefulWidget {
  const ActiveDeliveryHost({
    super.key,
    required this.order,
    required this.partner,
  });

  final DeliveryOrder order;
  final DeliveryPartner partner;

  @override
  State<ActiveDeliveryHost> createState() => _ActiveDeliveryHostState();
}

class _ActiveDeliveryHostState extends State<ActiveDeliveryHost> {
  LatLng? _restaurantPoint;
  LatLng? _customerPoint;
  String _restaurantPhone = '';
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    _resolvePoints();
  }

  Future<void> _resolvePoints() async {
    final order = widget.order;
    final contact = await OrderService.restaurantContact(order.restaurantId);

    LatLng? restaurant;
    if (order.restaurantLat != null && order.restaurantLng != null) {
      restaurant = LatLng(order.restaurantLat!, order.restaurantLng!);
    } else if (contact.lat != null && contact.lng != null) {
      restaurant = LatLng(contact.lat!, contact.lng!);
    } else {
      final query = [
        if (order.restaurantAddress.isNotEmpty) order.restaurantAddress,
        if (contact.address.isNotEmpty) contact.address,
        if (order.restaurantName.isNotEmpty) order.restaurantName,
      ].join(', ');
      restaurant = await GeocodingService.geocodeAddress(query);
    }

    LatLng? customer;
    if (order.destLat != null && order.destLng != null) {
      customer = LatLng(order.destLat!, order.destLng!);
    } else {
      customer = await GeocodingService.geocodeAddress(order.address);
    }

    if (!mounted) return;
    setState(() {
      _restaurantPoint = restaurant ?? MapConstants.defaultCenter;
      _customerPoint = customer ?? MapConstants.defaultCenter;
      _restaurantPhone = order.restaurantPhone.isNotEmpty
          ? order.restaurantPhone
          : contact.phone;
      _ready = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!_ready) {
      return const Scaffold(
        backgroundColor: AppColors.white,
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return StreamBuilder<DeliveryOrder?>(
      stream: OrderService.watchById(widget.order.id),
      builder: (context, snapshot) {
        final order = snapshot.data ?? widget.order;

        // ── User cancelled the order mid-trip ──────────────────────────
        // Show a full-screen notice. The HomeScreen simultaneously resets
        // the partner to online; this screen is replaced once Firestore
        // propagates the status change and the StreamBuilder on HomeScreen
        // stops returning this order as an active trip.
        if (order.isUserCancelled) {
          return _UserCancelledOrderScreen(order: order);
        }
        // ──────────────────────────────────────────────────────────────

        // ── Admin / restaurant cancelled the order mid-trip ────────────
        // Detect any cancellation that was NOT by the customer and NOT by
        // the delivery partner themselves (partner-cancel paths call
        // setAvailable directly). Show a full-screen notice and wait for
        // HomeScreen's detection loop to call setAvailable.
        if (order.isCancelled &&
            !order.isUserCancelled &&
            order.cancelledBy != 'delivery_partner') {
          return _AdminCancelledOrderScreen(order: order);
        }
        // ──────────────────────────────────────────────────────────────

        switch (order.resolvedStage) {
          case DeliveryStage.preparing:
            return PreparingOrderScreen(
              key: ValueKey('preparing_${order.id}'),
              order: order,
              partner: widget.partner,
              cancelReasons: CancelReasons.restaurant,
            );
          // pickup stage no longer used — OTP verification removed.
          // If old order has deliveryStage='pickup', treat it as toCustomer.
          case DeliveryStage.pickup:
          case DeliveryStage.toCustomer:
            return TripNavigationScreen(
              key: const ValueKey('to_customer'),
              order: order,
              partner: widget.partner,
              title: order.customerName.isEmpty
                  ? 'Customer'
                  : order.customerName,
              phone: order.customerPhone,
              destination: _customerPoint!,
              cancelReasons: CancelReasons.customer,
              cancelPhase: 'customer',
              onArrived: () => OrderService.arriveAtCustomer(order),
            );
          case DeliveryStage.arrivedCustomer:
            return CustomerDetailsScreen(
              key: ValueKey('customer_${order.id}'),
              order: order,
              partner: widget.partner,
            );
          case DeliveryStage.toRestaurant:
          default:
            return TripNavigationScreen(
              key: const ValueKey('to_restaurant'),
              order: order,
              partner: widget.partner,
              title: order.restaurantName.isEmpty
                  ? 'Restaurant'
                  : order.restaurantName,
              phone: _restaurantPhone,
              destination: _restaurantPoint!,
              cancelReasons: CancelReasons.restaurant,
              cancelPhase: 'restaurant',
              onArrived: () => OrderService.arriveAtRestaurant(order),
            );
        }
      },
    );
  }
}

// ── User-cancelled order screen ───────────────────────────────────────────────
/// Full-screen notice shown to the delivery partner when the customer
/// cancelled the order before pickup. Blocks all trip actions and tells the
/// partner clearly: do NOT go to the restaurant / do NOT pick up the food.
///
/// The HomeScreen's StreamBuilder will replace this widget automatically once
/// Firestore propagates the status change (partner is set back to online).
class _UserCancelledOrderScreen extends StatelessWidget {
  const _UserCancelledOrderScreen({required this.order});

  final DeliveryOrder order;

  @override
  Widget build(BuildContext context) {
    final isCOD = !order.isOnlinePaid;
    final orderNum = order.displayOrderNumber;

    return Scaffold(
      backgroundColor: const Color(0xFFFFF5F5),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // ── Big warning icon ───────────────────────────────────────
              Container(
                width: 96,
                height: 96,
                decoration: const BoxDecoration(
                  color: Color(0xFFFFECEC),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.do_not_disturb_alt_rounded,
                  color: AppColors.primary,
                  size: 52,
                ),
              ),
              const SizedBox(height: 24),

              // ── Title ──────────────────────────────────────────────────
              const Text(
                'Order Cancelled by Customer',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  color: AppColors.textDark,
                ),
              ),
              const SizedBox(height: 10),

              // ── Order number ───────────────────────────────────────────
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  orderNum,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: AppColors.primary,
                  ),
                ),
              ),
              const SizedBox(height: 28),

              // ── DO NOT pick up warning ─────────────────────────────────
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Column(
                  children: [
                    Icon(Icons.block_rounded, color: AppColors.white, size: 32),
                    SizedBox(height: 10),
                    Text(
                      'DO NOT Pick Up This Order',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                        color: AppColors.white,
                      ),
                    ),
                    SizedBox(height: 6),
                    Text(
                      'The customer cancelled before pickup.\nLeave the food at the restaurant.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 13,
                        color: Color(0xFFFFCCCC),
                        height: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // ── Refund info (for online payments) ──────────────────────
              if (!isCOD)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF8E1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFFFE082)),
                  ),
                  child: const Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        Icons.account_balance_wallet_rounded,
                        size: 18,
                        color: Color(0xFFF9A825),
                      ),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'The customer paid online. Admin will process the refund to their wallet.',
                          style: TextStyle(
                            fontSize: 13,
                            color: Color(0xFF7A5F00),
                            height: 1.4,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

              const Spacer(),

              // ── Status pill ────────────────────────────────────────────
              const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.success,
                    ),
                  ),
                  SizedBox(width: 8),
                  Text(
                    'Setting you back online…',
                    style: TextStyle(
                      fontSize: 13,
                      color: AppColors.textMedium,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              const Text(
                'You will receive new orders shortly.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: AppColors.textLight),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Admin / restaurant-cancelled order screen ─────────────────────────────────
/// Full-screen notice shown to the delivery partner when the admin or
/// restaurant cancelled their active order. Blocks all trip actions and
/// tells the partner clearly: the order is off, go back to waiting.
///
/// HomeScreen's detection loop calls setAvailable() which transitions the
/// partner from BUSY → ONLINE, causing Firestore to update the partner doc
/// and this widget to be replaced by the idle home tab automatically.
class _AdminCancelledOrderScreen extends StatelessWidget {
  const _AdminCancelledOrderScreen({required this.order});

  final DeliveryOrder order;

  @override
  Widget build(BuildContext context) {
    final orderNum = order.displayOrderNumber;

    return Scaffold(
      backgroundColor: const Color(0xFFFFF5F5),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // ── Big warning icon ─────────────────────────────────────
              Container(
                width: 96,
                height: 96,
                decoration: const BoxDecoration(
                  color: Color(0xFFFFECEC),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.cancel_rounded,
                  color: AppColors.primary,
                  size: 52,
                ),
              ),
              const SizedBox(height: 24),

              // ── Title ────────────────────────────────────────────────
              const Text(
                'Order Cancelled',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  color: AppColors.textDark,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'This order was cancelled by the restaurant or admin.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: AppColors.textMedium,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 16),

              // ── Order number chip ────────────────────────────────────
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  orderNum,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: AppColors.primary,
                  ),
                ),
              ),
              const SizedBox(height: 28),

              // ── Info box ─────────────────────────────────────────────
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Column(
                  children: [
                    Icon(
                      Icons.info_outline_rounded,
                      color: AppColors.white,
                      size: 32,
                    ),
                    SizedBox(height: 10),
                    Text(
                      'No Action Needed',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                        color: AppColors.white,
                      ),
                    ),
                    SizedBox(height: 6),
                    Text(
                      'You do not need to go to the restaurant.\nYou will be set back online automatically.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 13,
                        color: Color(0xFFFFCCCC),
                        height: 1.5,
                      ),
                    ),
                  ],
                ),
              ),

              const Spacer(),

              // ── Status pill ──────────────────────────────────────────
              const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.success,
                    ),
                  ),
                  SizedBox(width: 8),
                  Text(
                    'Setting you back online…',
                    style: TextStyle(
                      fontSize: 13,
                      color: AppColors.textMedium,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              const Text(
                'You will receive new orders shortly.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: AppColors.textLight),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
