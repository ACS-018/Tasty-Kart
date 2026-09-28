import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../constants/color_constants.dart';

class PageHeader extends StatelessWidget {
  const PageHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.onBack,
    this.trailing,
    this.branded = false,
  });

  final String title;
  final String? subtitle;
  final VoidCallback? onBack;
  final Widget? trailing;
  final bool branded;

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    final fg = branded ? AppColors.white : AppColors.textDark;
    final sub = branded
        ? AppColors.white.withValues(alpha: 0.85)
        : AppColors.textMedium;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: branded
          ? const SystemUiOverlayStyle(
              statusBarColor: Colors.transparent,
              statusBarIconBrightness: Brightness.light,
              statusBarBrightness: Brightness.dark,
            )
          : const SystemUiOverlayStyle(
              statusBarColor: Colors.transparent,
              statusBarIconBrightness: Brightness.dark,
              statusBarBrightness: Brightness.light,
            ),
      child: Container(
        width: double.infinity,
        color: branded ? AppColors.primary : AppColors.white,
        padding: EdgeInsets.fromLTRB(4, top + 4, 16, 12),
        child: Row(
          children: [
            IconButton(
              onPressed: onBack ?? () => Navigator.maybePop(context),
              icon: Icon(Icons.arrow_back, color: fg),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: fg,
                    ),
                  ),
                  if (subtitle != null && subtitle!.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitle!,
                      style: TextStyle(fontSize: 13, color: sub),
                    ),
                  ],
                ],
              ),
            ),
            if (trailing != null) trailing!,
          ],
        ),
      ),
    );
  }
}
