import 'package:flutter/material.dart';

import '../../constants/app_constants.dart';
import '../../constants/color_constants.dart';
import '../../services/auth_service.dart';
import '../../services/delivery_partner_service.dart';
import '../../state/onboarding_controller.dart';
import '../../utils/app_feedback.dart';
import '../../utils/responsive.dart';
import '../../widgets/app_radio_option.dart';
import 'components/onboarding_scaffold.dart';
import 'components/onboarding_title_block.dart';

class SelectCityScreen extends StatefulWidget {
  const SelectCityScreen({super.key, this.initialCity});

  final String? initialCity;

  @override
  State<SelectCityScreen> createState() => _SelectCityScreenState();
}

class _SelectCityScreenState extends State<SelectCityScreen> {
  late String? _selected;
  bool _isLoading = false;
  bool _leaving = false;

  @override
  void initState() {
    super.initState();
    _selected = widget.initialCity?.trim().isNotEmpty == true
        ? widget.initialCity!.trim()
        : null;
  }

  @override
  void didUpdateWidget(covariant SelectCityScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialCity != widget.initialCity &&
        widget.initialCity?.trim().isNotEmpty == true) {
      _selected = widget.initialCity!.trim();
    }
  }

  Future<void> _onNext() async {
    final city = _selected;
    if (city == null || city.isEmpty) {
      AppFeedback.showError(context, 'Please select a city');
      return;
    }

    final user = AuthService.currentUser;
    if (user == null) {
      AppFeedback.showError(context, 'Please sign in again');
      return;
    }

    setState(() => _isLoading = true);
    try {
      final partnerId = await DeliveryPartnerService.docIdFor(user);
      if (!mounted) return;
      OnboardingScope.maybeOf(context)?.setCity(city);
      await DeliveryPartnerService.updateCity(partnerId: partnerId, city: city);
    } catch (e) {
      if (!mounted) return;
      AppFeedback.showError(context, AuthService.messageFromError(e));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _onBack() async {
    if (_leaving) return;
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
      return;
    }
    setState(() => _leaving = true);
    try {
      await AuthService.logout();
    } catch (_) {
      if (!mounted) return;
      setState(() => _leaving = false);
      AppFeedback.showError(context, 'Could not go back. Try again.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = Responsive.of(context);

    return OnboardingScaffold(
        buttonLabel: 'Next',
        isLoading: _isLoading || _leaving,
        buttonEnabled: !_leaving,
        onPressed: _onNext,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            OnboardingTitleBlock(
              title: 'Select Your City',
              subtitle: 'Choose The City You Want To Deliver In',
              showBack: true,
              onBack: _onBack,
            ),
            SizedBox(
              height: r.responsive(mobile: 16.0, tablet: 20.0, desktop: 24.0),
            ),
            Expanded(
              // Stream active cities from admin; fall back to AppConstants.cities
              child: StreamBuilder<List<String>?>(
                stream: DeliveryPartnerService.streamActiveCityNames(),
                builder: (context, snap) {
                  // While loading use the hardcoded list so the screen is never
                  // blank — the list swaps silently when Firestore responds.
                  final cities = snap.data ?? AppConstants.cities;

                  return ListView.separated(
                    padding: EdgeInsets.zero,
                    itemCount: cities.length,
                    separatorBuilder: (_, __) =>
                        const Divider(height: 1, color: AppColors.divider),
                    itemBuilder: (context, index) {
                      final city = cities[index];
                      return AppRadioOption(
                        label: city,
                        selected: _selected == city,
                        onTap: () {
                          AppFeedback.selection();
                          setState(() => _selected = city);
                          OnboardingScope.maybeOf(context)?.setCity(city);
                        },
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
    );
  }
}
