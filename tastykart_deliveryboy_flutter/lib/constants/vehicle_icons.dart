import 'package:flutter/material.dart';

import '../constants/app_constants.dart';

IconData vehicleIcon(String iconKey) {
  switch (iconKey) {
    case 'two_wheeler':
      return Icons.two_wheeler;
    case 'moped':
      return Icons.moped;
    case 'pedal_bike':
      return Icons.pedal_bike;
    case 'electric_scooter':
      return Icons.electric_scooter;
    case 'directions_walk':
      return Icons.directions_walk;
    default:
      return Icons.two_wheeler;
  }
}

VehicleOption? vehicleById(String id) {
  for (final v in AppConstants.vehicles) {
    if (v.id == id || v.label == id) return v;
  }
  return null;
}
