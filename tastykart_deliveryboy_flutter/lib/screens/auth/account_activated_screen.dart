import 'package:flutter/material.dart';

import '../../constants/app_constants.dart';
import '../../constants/color_constants.dart';
import '../../global_widgets/loading_overlay.dart';
import '../../services/auth_service.dart';
import '../../services/delivery_partner_service.dart';
import '../../utils/app_feedback.dart';
import '../../utils/responsive.dart';
import 'components/activation_graphic.dart';
import 'components/onboarding_scaffold.dart';
import 'components/onboarding_title_block.dart';

class AccountActivatedScreen extends StatefulWidget {
  const AccountActivatedScreen({super.key});

  @override
  State<AccountActivatedScreen> createState() => _AccountActivatedScreenState();
}

class _AccountActivatedScreenState extends State<AccountActivatedScreen> {
  bool _isLoading = false;

  Future<void> _onNext() async {
    final user = AuthService.currentUser;
    if (user == null) {
      AppFeedback.showError(context, 'Please sign in again');
      return;
    }
    setState(() => _isLoading = true);
    try {
      await DeliveryPartnerService.acknowledgeActivation(partnerId: user.uid);
    } catch (e) {
      if (!mounted) return;
      AppFeedback.showError(context, AuthService.messageFromError(e));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = Responsive.of(context);
    final heading = r.responsive(mobile: 22.0, tablet: 24.0, desktop: 26.0);
    final body = r.responsive(mobile: 14.0, tablet: 15.0, desktop: 16.0);

    return LoadingOverlay(
      isLoading: _isLoading,
      child: OnboardingScaffold(
        buttonLabel: 'Next',
        isLoading: _isLoading,
        onPressed: _onNext,
        child: Column(
          children: [
            SizedBox(height: r.responsive(mobile: 8.0, tablet: 12.0, desktop: 16.0)),
            const Center(
              child: OnboardingTitleBlock(
                title: 'Account Activated',
                subtitle: '',
                centered: true,
              ),
            ),
            const Spacer(flex: 2),
            SizedBox(
              height: r.responsive(mobile: 180.0, tablet: 210.0, desktop: 230.0),
              width: double.infinity,
              child: const ActivationGraphic(),
            ),
            const Spacer(),
            Text(
              'Congratulations',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: heading,
                fontWeight: FontWeight.w700,
                color: AppColors.textDark,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Your ${AppConstants.appName} Account Is Activated',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: body,
                color: AppColors.textMedium,
              ),
            ),
            const Spacer(flex: 3),
          ],
        ),
      ),
    );
  }
}
