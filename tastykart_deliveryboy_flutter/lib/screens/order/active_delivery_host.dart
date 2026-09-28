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
