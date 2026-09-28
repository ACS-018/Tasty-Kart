import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../constants/app_constants.dart';
import '../../constants/color_constants.dart';
import '../../utils/responsive.dart';
import 'components/tastykart_logo.dart';

class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key, required this.onContinue});

  final VoidCallback onContinue;

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer(const Duration(milliseconds: 2800), _continue);
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _continue() {
    _timer?.cancel();
    widget.onContinue();
  }

  @override
  Widget build(BuildContext context) {
    final r = Responsive.of(context);
    final titleSize = r.responsive(mobile: 36.0, tablet: 42.0, desktop: 46.0);
    final tagSize = r.responsive(mobile: 16.0, tablet: 18.0, desktop: 20.0);
    final featureSize = r.responsive(mobile: 14.0, tablet: 15.0, desktop: 16.0);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: AppColors.primary,
        body: SafeArea(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: _continue,
            child: Padding(
              padding: EdgeInsets.symmetric(
                horizontal: r.responsive(
                  mobile: 28.0,
                  tablet: 40.0,
                  desktop: 48.0,
                ),
              ),
              child: Column(
                children: [
                  SizedBox(height: r.hp(6)),
                  const TastyKartLogo(),
                  const Spacer(flex: 2),
                  Text(
                    AppConstants.appName,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: titleSize,
                      fontWeight: FontWeight.w800,
                      height: 1.1,
                    ),
                  ),
                  SizedBox(
                    height: r.responsive(
                      mobile: 10.0,
                      tablet: 12.0,
                      desktop: 14.0,
                    ),
                  ),
                  Text(
                    AppConstants.tagline,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: tagSize,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  Text(
                    AppConstants.earnLine,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: tagSize,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const Spacer(flex: 3),
                  _FeatureRow(
                    icon: Icons.account_balance_wallet_outlined,
                    title: 'High Earnings,',
                    subtitle: 'Great Incentives',
                    fontSize: featureSize,
                  ),
                  SizedBox(
                    height: r.responsive(
                      mobile: 18.0,
                      tablet: 22.0,
                      desktop: 24.0,
                    ),
                  ),
                  _FeatureRow(
                    icon: Icons.work_history_outlined,
                    title: 'Great Hours,',
                    subtitle: 'Work When You Want',
                    fontSize: featureSize,
                  ),
                  SizedBox(
                    height: r.responsive(
                      mobile: 18.0,
                      tablet: 22.0,
                      desktop: 24.0,
                    ),
                  ),
                  _FeatureRow(
                    icon: Icons.account_balance_outlined,
                    title: 'Weekly PayOuts,',
                    subtitle: 'Direct To Bank',
                    fontSize: featureSize,
                  ),
                  SizedBox(height: r.hp(8)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _FeatureRow extends StatelessWidget {
  const _FeatureRow({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.fontSize,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: AppColors.white, size: 28),
        const SizedBox(width: 16),
        Expanded(
          child: RichText(
            text: TextSpan(
              style: TextStyle(
                color: AppColors.white,
                fontSize: fontSize,
                height: 1.35,
              ),
              children: [
                TextSpan(
                  text: '$title ',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                TextSpan(text: subtitle),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
