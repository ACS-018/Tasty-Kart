import 'package:flutter/material.dart';

import '../constants/color_constants.dart';
import '../constants/vehicle_icons.dart';
import 'app_radio_option.dart';

class VehicleOptionTile extends StatelessWidget {
  const VehicleOptionTile({
    super.key,
    required this.iconKey,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String iconKey;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14),
        child: Row(
          children: [
            Icon(vehicleIcon(iconKey), color: AppColors.textDark, size: 26),
            const SizedBox(width: 16),
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textDark,
                ),
              ),
            ),
            AppRadioDot(selected: selected),
          ],
        ),
      ),
    );
  }
}
