import 'package:flutter/material.dart';

import '../../constants/color_constants.dart';
import '../../global_widgets/app_button.dart';
import '../../utils/app_feedback.dart';
import '../../utils/responsive.dart';
import 'auth_credentials_sheet.dart';
import 'components/handover_illustration.dart';
import 'components/onboarding_scaffold.dart';
import 'components/onboarding_title_block.dart';

class AuthChoiceScreen extends StatelessWidget {
  const AuthChoiceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final r = Responsive.of(context);
    final headerHeight = r.responsive(
      mobile: 220.0,
      tablet: 260.0,
      desktop: 280.0,
    );

    return OnboardingScaffold(
      header: SizedBox(
        height: headerHeight,
        width: double.infinity,
        child: const ColoredBox(
          color: AppColors.illustrationBackground,
          child: HandoverIllustration(),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const OnboardingTitleBlock(
            title: 'Welcome Partner',
            subtitle: 'Login or create an account to start delivering with TastyKart',
          ),
          const Spacer(),
          AppButton(
            label: 'Login',
            onPressed: () {
              AppFeedback.selection();
              AuthCredentialsSheet.show(
                context,
                mode: AuthSheetMode.login,
              );
            },
          ),
          SizedBox(height: r.responsive(mobile: 12.0, tablet: 14.0, desktop: 16.0)),
          AppButton(
            label: 'Sign Up',
            isOutlined: true,
            onPressed: () {
              AppFeedback.selection();
              AuthCredentialsSheet.show(
                context,
                mode: AuthSheetMode.signup,
              );
            },
          ),
          SizedBox(height: r.responsive(mobile: 12.0, tablet: 16.0, desktop: 18.0)),
        ],
      ),
    );
  }
}
