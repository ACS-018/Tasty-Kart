import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../constants/color_constants.dart';
import '../../constants/map_constants.dart';
import '../../global_widgets/app_button.dart';
import '../../models/delivery_order.dart';
import '../../models/delivery_partner.dart';
import '../../services/delivery_partner_service.dart';
import '../../services/directions_service.dart';
import '../../services/location_service.dart';
import '../../services/order_service.dart';
import '../../utils/app_feedback.dart';
import '../Home/sos_sheet.dart';
import 'cancel_order_sheet.dart';

class TripNavigationScreen extends StatefulWidget {
  const TripNavigationScreen({
    super.key,
    required this.order,
    required this.partner,
    required this.title,
    required this.phone,
    required this.destination,
    required this.cancelReasons,
    required this.cancelPhase,
    required this.onArrived,
    this.arrivedDone = false,
  });

  final DeliveryOrder order;
  final DeliveryPartner partner;
  final String title;
  final String phone;
  final LatLng destination;
  final List<String> cancelReasons;
  final String cancelPhase;
  final Future<void> Function() onArrived;
  final bool arrivedDone;

  @override
  State<TripNavigationScreen> createState() => _TripNavigationScreenState();
}

class _TripNavigationScreenState extends State<TripNavigationScreen> {
  GoogleMapController? _map;
  StreamSubscription<LatLng>? _gps;
  LatLng _origin = MapConstants.defaultCenter;
  RouteInfo? _route;
  bool _busy = false;
  bool _didFit = false;
  bool _hasGps = false;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  @override
  void dispose() {
    _gps?.cancel();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    final allowed = await LocationService.ensurePermission();
    final current = await LocationService.current();
    if (!mounted) return;
    _hasGps = allowed;
    if (current != null) _origin = current;
    await _loadRoute(force: true);
    if (!allowed) return;
    _gps = LocationService.watch().listen((point) {
      _origin = point;
      _hasGps = true;
      _loadRoute();
    });
  }

  Future<void> _loadRoute({bool force = false}) async {
    if (!force && _route != null) {
      final from = _route!.points.isEmpty ? _origin : _route!.points.first;
      final moved = Geolocator.distanceBetween(
        from.latitude,
        from.longitude,
        _origin.latitude,
        _origin.longitude,
      );
      if (moved < 80) return;
    }

    final info = await DirectionsService.fetch(
      origin: _origin,
      destination: widget.destination,
    );
    if (!mounted) return;
    setState(() => _route = info);
    _fitIfNeeded(info.points);
  }

  void _fitIfNeeded(List<LatLng> points) {
    final map = _map;
    if (map == null || _didFit || points.isEmpty) return;
    _didFit = true;
    map.animateCamera(
      CameraUpdate.newLatLngBounds(_bounds(points), 56),
    );
  }

  LatLngBounds _bounds(List<LatLng> points) {
    var minLat = points.first.latitude;
    var maxLat = points.first.latitude;
    var minLng = points.first.longitude;
    var maxLng = points.first.longitude;
    for (final p in points) {
      minLat = math.min(minLat, p.latitude);
      maxLat = math.max(maxLat, p.latitude);
      minLng = math.min(minLng, p.longitude);
      maxLng = math.max(maxLng, p.longitude);
    }
    if ((maxLat - minLat).abs() < 0.002) {
      minLat -= 0.01;
      maxLat += 0.01;
    }
    if ((maxLng - minLng).abs() < 0.002) {
      minLng -= 0.01;
      maxLng += 0.01;
    }
    return LatLngBounds(
      southwest: LatLng(minLat, minLng),
      northeast: LatLng(maxLat, maxLng),
    );
  }

  Future<void> _call() async {
    final phone = widget.phone.trim();
    if (phone.isEmpty) {
      AppFeedback.showError(context, 'Phone number is not available');
      return;
    }
    final uri = Uri(scheme: 'tel', path: phone);
    final launched = await launchUrl(uri);
    if (!launched && mounted) {
      AppFeedback.showError(context, 'Could not open the phone dialer');
    }
  }

  Future<void> _cancel() async {
    if (_busy) return;
    final reason = await CancelOrderSheet.show(
      context,
      reasons: widget.cancelReasons,
    );
    if (reason == null || !mounted) return;
    setState(() => _busy = true);
    try {
      await OrderService.cancelByPartner(
        order: widget.order,
        partnerId: widget.partner.id,
        reason: reason,
        phase: widget.cancelPhase,
      );
      await DeliveryPartnerService.setAvailable(
        partnerId: widget.partner.id,
      );
      if (mounted) AppFeedback.showSnackBar(context, message: 'Order cancelled');
    } catch (_) {
      if (mounted) {
        AppFeedback.showError(context, 'Could not cancel this order');
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _arrived() async {
    if (_busy || widget.arrivedDone) return;
    setState(() => _busy = true);
    try {
      await widget.onArrived();
    } catch (_) {
      if (mounted) {
        AppFeedback.showError(context, 'Could not update arrival');
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
        statusBarIconBrightness: Brightness.light,
      ),
    );

    final dest = widget.destination;
    final route = _route;
    final points = route?.points ?? [_origin, dest];
    final top = MediaQuery.paddingOf(context).top;

    final markers = <Marker>{
      Marker(
        markerId: const MarkerId('destination'),
        position: dest,
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
        infoWindow: InfoWindow(title: widget.title),
      ),
    };

    final polylines = <Polyline>{
      Polyline(
        polylineId: const PolylineId('route'),
        points: points,
        color: const Color(0xFF4285F4),
        width: 5,
      ),
    };

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: Stack(
        children: [
          GoogleMap(
            initialCameraPosition: CameraPosition(
              target: dest,
              zoom: MapConstants.trackingZoom,
            ),
            onMapCreated: (controller) {
              _map = controller;
              if (route != null) _fitIfNeeded(route.points);
            },
            markers: markers,
            polylines: polylines,
            myLocationEnabled: _hasGps,
            myLocationButtonEnabled: false,
            zoomControlsEnabled: false,
            mapToolbarEnabled: false,
            compassEnabled: false,
            padding: EdgeInsets.only(top: top + 72, bottom: 210, left: 16, right: 16),
          ),
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: Container(
              color: AppColors.primary,
              padding: EdgeInsets.fromLTRB(4, top + 4, 8, 12),
              child: Row(
                children: [
                  IconButton(
                    onPressed: _busy ? null : _cancel,
                    icon: const Icon(Icons.arrow_back, color: AppColors.white),
                  ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: AppColors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        if (route != null && route.headerDistance.isNotEmpty)
                          Text(
                            route.headerDistance,
                            style: const TextStyle(
                              color: AppColors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => SosSheet.show(context),
                    icon: const Icon(
                      Icons.shield_outlined,
                      color: AppColors.white,
                    ),
                  ),
                ],
              ),
            ),
          ),
          Positioned(
            left: 16,
            right: 16,
            bottom: 16 + MediaQuery.paddingOf(context).bottom,
            child: Material(
              color: AppColors.white,
              borderRadius: BorderRadius.circular(16),
              elevation: 8,
              shadowColor: Colors.black26,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                route?.estimateLabel ?? 'Finding route…',
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.textDark,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                route?.trafficLabel ?? 'Light Traffic',
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: AppColors.textMedium,
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          onPressed: _call,
                          style: IconButton.styleFrom(
                            backgroundColor: AppColors.surface,
                            foregroundColor: AppColors.primary,
                          ),
                          icon: const Icon(Icons.phone_outlined),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    AppButton(
                      label: widget.arrivedDone ? "You've Arrived" : 'Arrived',
                      isLoading: _busy,
                      onPressed: widget.arrivedDone ? null : _arrived,
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
