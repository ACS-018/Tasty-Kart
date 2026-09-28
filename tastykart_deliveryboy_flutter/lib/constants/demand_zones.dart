import 'package:google_maps_flutter/google_maps_flutter.dart';

import 'map_constants.dart';

class DemandZone {
  const DemandZone({
    required this.area,
    required this.polygon,
    required this.center,
  });

  final String area;
  final List<LatLng> polygon;
  final LatLng center;

  static DemandZone forCity(String city) {
    final value = city.toLowerCase();
    if (value.contains('bangalore') || value.contains('bengaluru')) {
      return const DemandZone(
        area: 'Koramangala',
        center: LatLng(12.9352, 77.6245),
        polygon: [
          LatLng(12.942, 77.615),
          LatLng(12.945, 77.632),
          LatLng(12.930, 77.638),
          LatLng(12.924, 77.620),
        ],
      );
    }
    // Hyderabad default — Karvan / Karwan (near Masab Tank / Nampally).
    return const DemandZone(
      area: 'Karvan',
      center: LatLng(17.375, 78.450),
      polygon: [
        LatLng(17.382, 78.442),
        LatLng(17.385, 78.455),
        LatLng(17.375, 78.462),
        LatLng(17.365, 78.455),
        LatLng(17.368, 78.440),
      ],
    );
  }

  static CameraPosition camera(DemandZone zone) => CameraPosition(
        target: zone.center,
        zoom: MapConstants.trackingZoom,
      );
}
