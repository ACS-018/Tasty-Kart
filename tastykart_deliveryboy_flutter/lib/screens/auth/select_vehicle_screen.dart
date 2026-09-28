import 'package:flutter/material.dart';

import '../../constants/app_constants.dart';
import '../../constants/color_constants.dart';
import '../../services/auth_service.dart';
import '../../services/delivery_partner_service.dart';
import '../../utils/app_feedback.dart';
import '../../utils/responsive.dart';
import '../../widgets/vehicle_option_tile.dart';
import 'components/onboarding_scaffold.dart';
import 'components/onboarding_title_block.dart';

class SelectVehicleScreen extends StatefulWidget {
  const SelectVehicleScreen({super.key, this.initialVehicle});

  final String? initialVehicle;

  @override
  State<SelectVehicleScreen> createState() => _SelectVehicleScreenState();
}

class _SelectVehicleScreenState extends State<SelectVehicleScreen> {
  String? _selected;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    final initial = widget.initialVehicle?.trim() ?? '';
    if (initial.isEmpty) return;
    for (final v in AppConstants.vehicles) {
      if (v.id == initial || v.label == initial) {
        _selected = v.id;
        break;
      }
    }
    _selected ??= initial;
  }

  Future<void> _onNext() async {
    final vehicle = _selected;
    if (vehicle == null || vehicle.isEmpty) {
      AppFeedback.showError(context, 'Please select a vehicle');
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
      await DeliveryPartnerService.updateVehicle(
        partnerId: partnerId,
        vehicle: vehicle,
      );
    } catch (e) {
      if (!mounted) return;
      AppFeedback.showError(context, AuthService.messageFromError(e));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  /// Go back to PersonalDetailsScreen by clearing only the vehicle field so
  /// AuthGate steps back while preserving the name/DOB/gender the user entered.
  Future<void> _onBack() async {
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
      return;
    }
    final user = AuthService.currentUser;
    if (user == null) return;
    try {
      final partnerId = await DeliveryPartnerService.docIdFor(user);
      // Clear vehicle only — personal details (name, DOB, gender) are retained
      // so the user doesn't have to re-enter them when returning.
      await DeliveryPartnerService.updateVehicle(
        partnerId: partnerId,
        vehicle: '',
      );
    } catch (_) {
      if (!mounted) return;
      AppFeedback.showError(context, 'Could not go back. Try again.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = Responsive.of(context);

    return OnboardingScaffold(
        buttonLabel: 'Next',
        isLoading: _isLoading,
        onPressed: _onNext,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            OnboardingTitleBlock(
              title: 'Select Your Vehicle',
              subtitle: 'This Helps Us Provide You A Better Experience',
              showBack: true,
              onBack: _onBack,
            ),
            SizedBox(
              height: r.responsive(mobile: 16.0, tablet: 20.0, desktop: 24.0),
            ),
            Expanded(
              child: ListView.separated(
                padding: EdgeInsets.zero,
                itemCount: AppConstants.vehicles.length,
                separatorBuilder: (_, __) =>
                    const Divider(height: 1, color: AppColors.divider),
                itemBuilder: (context, index) {
                  final vehicle = AppConstants.vehicles[index];
                  return VehicleOptionTile(
                    iconKey: vehicle.icon,
                    label: vehicle.label,
                    selected: _selected == vehicle.id,
                    onTap: () {
                      AppFeedback.selection();
                      setState(() => _selected = vehicle.id);
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
