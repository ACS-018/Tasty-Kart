import 'package:flutter/material.dart';

import '../constants/color_constants.dart';

class AppRadioOption extends StatelessWidget {
  const AppRadioOption({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.dense = false,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: dense ? 8 : 14, horizontal: 4),
        child: Row(
          mainAxisSize: dense ? MainAxisSize.min : MainAxisSize.max,
          children: [
            AppRadioDot(selected: selected),
            SizedBox(width: dense ? 8 : 14),
            dense
                ? Text(
                    label,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: AppColors.textDark,
                    ),
                  )
                : Expanded(
                    child: Text(
                      label,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w500,
                        color: AppColors.textDark,
                      ),
                    ),
                  ),
          ],
        ),
      ),
    );
  }
}

class AppRadioDot extends StatelessWidget {
  const AppRadioDot({super.key, required this.selected});

  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 22,
      height: 22,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: selected ? AppColors.primary : const Color(0xFFBDBDBD),
          width: 2,
        ),
      ),
      child: selected
          ? Center(
              child: Container(
                width: 12,
                height: 12,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.primary,
                ),
              ),
            )
          : null,
    );
  }
}
