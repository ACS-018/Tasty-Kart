import 'package:flutter/material.dart';

import '../../constants/app_constants.dart';
import '../../constants/color_constants.dart';
import '../../services/auth_service.dart';
import '../../services/delivery_partner_service.dart';
import '../../state/onboarding_controller.dart';
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
  bool _leaving = false;

  @override
  void initState() {
    super.initState();
    _applyVehicle(widget.initialVehicle);
  }

  @override
  void didUpdateWidget(covariant SelectVehicleScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialVehicle != widget.initialVehicle) {
      _applyVehicle(widget.initialVehicle);
    }
  }

  void _applyVehicle(String? raw) {
    final initial = raw?.trim() ?? '';
    if (initial.isEmpty) {
      setState(() => _selected = null);
      return;
    }
    for (final v in AppConstants.vehicles) {
      if (v.id == initial || v.label == initial) {
        setState(() => _selected = v.id);
        return;
      }
    }
    setState(() => _selected = initial);
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
      OnboardingScope.maybeOf(context)?.setVehicle(vehicle);
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

  /// Step back to Personal Details — keep drafts in [OnboardingController].
  Future<void> _onBack() async {
    if (_isLoading || _leaving) return;
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
      return;
    }
    final user = AuthService.currentUser;
    if (user == null) return;

    setState(() => _leaving = true);
    try {
      final partnerId = await DeliveryPartnerService.docIdFor(user);
      await DeliveryPartnerService.clearVehicle(partnerId: partnerId);
      await DeliveryPartnerService.clearPersonalDetails(partnerId: partnerId);
      if (!mounted) return;
      OnboardingScope.maybeOf(context)?.setVehicle('');
    } catch (_) {
      if (!mounted) return;
      AppFeedback.showError(context, 'Could not go back. Try again.');
    } finally {
      if (mounted) setState(() => _leaving = false);
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
                    OnboardingScope.maybeOf(context)?.setVehicle(vehicle.id);
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
