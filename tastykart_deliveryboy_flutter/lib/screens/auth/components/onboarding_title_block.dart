import 'package:flutter/material.dart';

import '../../../constants/color_constants.dart';
import '../../../utils/responsive.dart';

class OnboardingTitleBlock extends StatelessWidget {
  const OnboardingTitleBlock({
    super.key,
    required this.title,
    required this.subtitle,
    this.showBack = false,
    this.onBack,
    this.centered = false,
  });

  final String title;
  final String subtitle;
  final bool showBack;
  final VoidCallback? onBack;
  final bool centered;

  @override
  Widget build(BuildContext context) {
    final r = Responsive.of(context);
    final titleSize = r.responsive(mobile: 22.0, tablet: 24.0, desktop: 26.0);
    final subtitleSize = r.responsive(
      mobile: 13.0,
      tablet: 14.0,
      desktop: 15.0,
    );

    final align = centered ? TextAlign.center : TextAlign.start;

    return Column(
      crossAxisAlignment: centered
          ? CrossAxisAlignment.center
          : CrossAxisAlignment.start,
      children: [
        if (showBack)
          Align(
            alignment: Alignment.centerLeft,
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: onBack ?? () => Navigator.of(context).maybePop(),
                borderRadius: BorderRadius.circular(24),
                child: const Padding(
                  padding: EdgeInsets.only(
                    left: 4,
                    right: 16,
                    top: 4,
                    bottom: 14,
                  ),
                  child: Icon(
                    Icons.arrow_back,
                    color: AppColors.textDark,
                    size: 24,
                  ),
                ),
              ),
            ),
          ),
        Text(
          title,
          textAlign: align,
          style: TextStyle(
            fontSize: titleSize,
            fontWeight: FontWeight.w700,
            color: AppColors.textDark,
            height: 1.2,
          ),
        ),
        if (subtitle.trim().isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              subtitle,
              textAlign: align,
              style: TextStyle(
                fontSize: subtitleSize,
                color: AppColors.textMedium,
                height: 1.4,
              ),
            ),
          ),
      ],
    );
  }
}
