import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../constants/color_constants.dart';
import '../../../global_widgets/app_button.dart';
import '../../../utils/responsive.dart';

class OnboardingScaffold extends StatelessWidget {
  const OnboardingScaffold({
    super.key,
    required this.child,
    this.buttonLabel,
    this.onPressed,
    this.header,
    this.isLoading = false,
    this.buttonEnabled = true,
  });

  final Widget? header;
  final Widget child;
  final String? buttonLabel;
  final VoidCallback? onPressed;
  final bool isLoading;
  final bool buttonEnabled;

  @override
  Widget build(BuildContext context) {
    final r = Responsive.of(context);
    final horizontal = r.responsive(mobile: 24.0, tablet: 40.0, desktop: 48.0);
    final bottom = r.responsive(mobile: 20.0, tablet: 28.0, desktop: 32.0);

    final topInset = MediaQuery.paddingOf(context).top;
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: AppColors.primary,
        statusBarIconBrightness: Brightness.light,
        systemNavigationBarColor: AppColors.primary,
        systemNavigationBarIconBrightness: Brightness.light,
      ),
      child: Scaffold(
        backgroundColor: AppColors.primary,
        resizeToAvoidBottomInset: true,
        body: Column(
          children: [
            SizedBox(height: topInset),
            Expanded(
              child: ColoredBox(
                color: AppColors.white,
                child: Column(
                  children: [
                    if (header != null)
                      ColoredBox(
                        color: AppColors.illustrationBackground,
                        child: header,
                      ),
                    Expanded(
                      child: Padding(
                        padding: EdgeInsets.fromLTRB(horizontal, 8, horizontal, 0),
                        child: child,
                      ),
                    ),
                    if (buttonLabel != null)
                      Padding(
                        padding: EdgeInsets.fromLTRB(
                          horizontal,
                          12,
                          horizontal,
                          bottom,
                        ),
                        child: AppButton(
                          label: buttonLabel!,
                          onPressed:
                              buttonEnabled && !isLoading ? onPressed : null,
                          isLoading: isLoading,
                        ),
                      ),
                  ],
                ),
              ),
            ),
            SizedBox(height: bottomInset),
          ],
        ),
      ),
    );
  }
}
