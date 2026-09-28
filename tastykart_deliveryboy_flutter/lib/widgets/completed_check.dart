import 'package:flutter/material.dart';

import '../constants/color_constants.dart';

class CompletedCheck extends StatelessWidget {
  const CompletedCheck({super.key, this.size = 22});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(
        color: AppColors.success,
        shape: BoxShape.circle,
      ),
      child: Icon(Icons.check, color: AppColors.white, size: size * 0.7),
    );
  }
}
