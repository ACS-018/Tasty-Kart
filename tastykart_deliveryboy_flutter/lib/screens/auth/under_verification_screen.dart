import 'package:flutter/material.dart';

import '../../constants/color_constants.dart';
import '../../utils/responsive.dart';
import 'components/onboarding_title_block.dart';
import 'components/verification_illustration.dart';

class UnderVerificationScreen extends StatelessWidget {
  const UnderVerificationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final r = Responsive.of(context);
    final heading = r.responsive(mobile: 20.0, tablet: 22.0, desktop: 24.0);
    final body = r.responsive(mobile: 14.0, tablet: 15.0, desktop: 16.0);
    final topInset = MediaQuery.paddingOf(context).top;
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    return Scaffold(
      backgroundColor: AppColors.primary,
      body: Column(
        children: [
          // Status bar area fills with primary colour
          SizedBox(height: topInset),
          Expanded(
            child: ColoredBox(
              color: AppColors.white,
              child: Padding(
                padding: EdgeInsets.symmetric(
                  horizontal: r.responsive(
                    mobile: 24.0,
                    tablet: 40.0,
                    desktop: 48.0,
                  ),
                ),
                child: Column(
                  children: [
                    SizedBox(
                      height: r.responsive(
                        mobile: 16.0,
                        tablet: 20.0,
                        desktop: 24.0,
                      ),
                    ),
                    const Center(
                      child: OnboardingTitleBlock(
                        title: 'Under Verification',
                        subtitle: '',
                        centered: true,
                      ),
                    ),
                    const Spacer(flex: 2),
                    SizedBox(
                      height: r.responsive(
                        mobile: 220.0,
                        tablet: 260.0,
                        desktop: 280.0,
                      ),
                      width: double.infinity,
                      child: const VerificationIllustration(),
                    ),
                    const Spacer(),
                    Text(
                      'We Are Verifying Your Document',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: heading,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textDark,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'This Usually Takes 24 Hrs\nWe Will Notify You Once Your Account Was Activated',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: body,
                        height: 1.45,
                        color: AppColors.textMedium,
                      ),
                    ),
                    const Spacer(flex: 3),
                  ],
                ),
              ),
            ),
          ),
          SizedBox(height: bottomInset),
        ],
      ),
    );
  }
}
