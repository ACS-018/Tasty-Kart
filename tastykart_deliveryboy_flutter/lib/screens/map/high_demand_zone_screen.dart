import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../constants/color_constants.dart';
import '../../constants/demand_zones.dart';

class HighDemandZoneScreen extends StatelessWidget {
  const HighDemandZoneScreen({super.key, required this.city});

  final String city;

  @override
  Widget build(BuildContext context) {
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
      ),
    );

    final zone = DemandZone.forCity(city);
    final top = MediaQuery.paddingOf(context).top;
    final polygons = {
      Polygon(
        polygonId: const PolygonId('demand'),
        points: zone.polygon,
        fillColor: const Color(0x66FFEB3B),
        strokeColor: const Color(0xFFFFC107),
        strokeWidth: 2,
      ),
    };

    return Scaffold(
      body: Stack(
        children: [
          GoogleMap(
            initialCameraPosition: DemandZone.camera(zone),
            polygons: polygons,
            myLocationEnabled: false,
            myLocationButtonEnabled: false,
            zoomControlsEnabled: false,
            mapToolbarEnabled: false,
            compassEnabled: false,
            padding: EdgeInsets.only(top: top + 56, bottom: 120),
          ),
          Positioned(
            top: top + 8,
            left: 8,
            child: Material(
              color: AppColors.white,
              shape: const CircleBorder(),
              elevation: 2,
              child: IconButton(
                onPressed: () => Navigator.maybePop(context),
                icon: const Icon(Icons.arrow_back, color: AppColors.textDark),
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
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'High Demand Zone',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textDark,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      zone.area,
                      style: const TextStyle(
                        fontSize: 15,
                        color: AppColors.textDark,
                      ),
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
