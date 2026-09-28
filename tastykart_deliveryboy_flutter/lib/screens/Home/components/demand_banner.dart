import 'package:flutter/material.dart';

import '../../../constants/color_constants.dart';

class DemandBanner extends StatelessWidget {
  const DemandBanner({super.key, required this.city, this.onSee});

  final String city;
  final VoidCallback? onSee;

  @override
  Widget build(BuildContext context) {
    final label = city.trim().isEmpty ? 'Hyderabad' : city.trim();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF3E0),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFFE0B2)),
      ),
      child: Row(
        children: [
          const Icon(Icons.local_fire_department, color: Color(0xFFEF6C00)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'High Demand Zone · $label',
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                color: AppColors.textDark,
              ),
            ),
          ),
          TextButton(
            onPressed: onSee,
            child: const Text(
              'See',
              style: TextStyle(
                color: AppColors.primary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
