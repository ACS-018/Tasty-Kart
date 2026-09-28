import 'dart:convert';
import 'dart:math' as math;

import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:http/http.dart' as http;

import '../constants/map_constants.dart';

class RouteInfo {
  const RouteInfo({
    required this.points,
    required this.durationText,
    required this.distanceText,
    required this.trafficLabel,
    required this.distanceKm,
  });

  final List<LatLng> points;
  final String durationText;
  final String distanceText;
  final String trafficLabel;
  final double distanceKm;

  String get headerDistance {
    if (distanceText.isEmpty) return '';
    return '$distanceText Away';
  }

  String get estimateLabel {
    if (durationText.isEmpty && distanceText.isEmpty) return '';
    if (durationText.isEmpty) return distanceText;
    if (distanceText.isEmpty) return durationText;
    return '$durationText - $distanceText';
  }
}

class DirectionsService {
  DirectionsService._();

  static Future<RouteInfo> fetch({
    required LatLng origin,
    required LatLng destination,
  }) async {
    try {
      final uri = Uri.parse(
        'https://maps.googleapis.com/maps/api/directions/json',
      ).replace(queryParameters: {
        'origin': '${origin.latitude},${origin.longitude}',
        'destination': '${destination.latitude},${destination.longitude}',
        'mode': 'driving',
        'departure_time': 'now',
        'key': MapConstants.googleMapKey,
      });

      final res = await http.get(uri).timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) return _straight(origin, destination);

      final data = jsonDecode(res.body) as Map<String, dynamic>;
      if (data['status'] != 'OK') return _straight(origin, destination);

      final routes = data['routes'] as List<dynamic>? ?? [];
      if (routes.isEmpty) return _straight(origin, destination);

      final route = routes.first as Map<String, dynamic>;
      final overview = route['overview_polyline'] as Map<String, dynamic>?;
      final encoded = overview?['points'] as String? ?? '';
      final points = encoded.isEmpty
          ? [origin, destination]
          : decodePolyline(encoded);

      final legs = route['legs'] as List<dynamic>? ?? [];
      if (legs.isEmpty) return _straight(origin, destination);

      final leg = legs.first as Map<String, dynamic>;
      final distance = leg['distance'] as Map<String, dynamic>?;
      final duration = leg['duration'] as Map<String, dynamic>?;
      final traffic = leg['duration_in_traffic'] as Map<String, dynamic>?;

      final meters = (distance?['value'] as num?)?.toDouble() ?? 0;
      final km = meters / 1000;
      final normalSec = (duration?['value'] as num?)?.toDouble() ?? 0;
      final trafficSec =
          (traffic?['value'] as num?)?.toDouble() ?? normalSec;

      return RouteInfo(
        points: points.isEmpty ? [origin, destination] : points,
        durationText: _formatDuration(duration?['text'] as String? ?? ''),
        distanceText: _formatDistance(km, distance?['text'] as String?),
        trafficLabel: _trafficLabel(normalSec, trafficSec),
        distanceKm: km,
      );
    } catch (_) {
      return _straight(origin, destination);
    }
  }

  static RouteInfo _straight(LatLng origin, LatLng destination) {
    final km = _haversineKm(origin, destination);
    final minutes = math.max(1, (km / 22 * 60).round());
    return RouteInfo(
      points: [origin, destination],
      durationText: '$minutes Min',
      distanceText: '${km.toStringAsFixed(1)} Km',
      trafficLabel: 'Light Traffic',
      distanceKm: km,
    );
  }

  static String _formatDuration(String text) {
    if (text.isEmpty) return '';
    return text
        .replaceAll('mins', 'Min')
        .replaceAll('min', 'Min')
        .replaceAll('hours', 'Hr')
        .replaceAll('hour', 'Hr');
  }

  static String _formatDistance(double km, String? raw) {
    if (km > 0) return '${km.toStringAsFixed(1)} Km';
    if (raw == null || raw.isEmpty) return '';
    return raw.replaceAll('km', 'Km').replaceAll('m', 'm');
  }

  static String _trafficLabel(double normalSec, double trafficSec) {
    if (normalSec <= 0) return 'Light Traffic';
    final ratio = trafficSec / normalSec;
    if (ratio > 1.25) return 'Heavy Traffic';
    if (ratio > 1.1) return 'Moderate Traffic';
    return 'Light Traffic';
  }

  static double _haversineKm(LatLng a, LatLng b) {
    const r = 6371.0;
    final dLat = _rad(b.latitude - a.latitude);
    final dLng = _rad(b.longitude - a.longitude);
    final h = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(_rad(a.latitude)) *
            math.cos(_rad(b.latitude)) *
            math.sin(dLng / 2) *
            math.sin(dLng / 2);
    return 2 * r * math.asin(math.sqrt(h));
  }

  static double _rad(double deg) => deg * math.pi / 180;

  static List<LatLng> decodePolyline(String encoded) {
    final points = <LatLng>[];
    var index = 0;
    var lat = 0;
    var lng = 0;

    while (index < encoded.length) {
      var shift = 0;
      var result = 0;
      int b;
      do {
        b = encoded.codeUnitAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      final dlat = (result & 1) != 0 ? ~(result >> 1) : (result >> 1);
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.codeUnitAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      final dlng = (result & 1) != 0 ? ~(result >> 1) : (result >> 1);
      lng += dlng;

      points.add(LatLng(lat / 1e5, lng / 1e5));
    }
    return points;
  }
}
