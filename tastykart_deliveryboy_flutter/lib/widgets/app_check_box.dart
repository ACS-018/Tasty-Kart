import 'package:flutter/material.dart';

import '../constants/color_constants.dart';

class AppCheckBox extends StatelessWidget {
  const AppCheckBox({super.key, required this.selected});

  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 22,
      height: 22,
      decoration: BoxDecoration(
        color: selected ? AppColors.primary : AppColors.white,
        borderRadius: BorderRadius.circular(5),
        border: Border.all(
          color: selected ? AppColors.primary : const Color(0xFFBDBDBD),
          width: 1.6,
        ),
      ),
      child: selected
          ? const Icon(Icons.check, size: 16, color: AppColors.white)
          : null,
    );
  }
}
