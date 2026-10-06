import 'package:flutter/material.dart';

import '../../constants/app_constants.dart';
import '../../constants/color_constants.dart';
import '../../global_widgets/app_text_field.dart';
import '../../global_widgets/loading_overlay.dart';
import '../../services/auth_service.dart';
import '../../services/delivery_partner_service.dart';
import '../../state/onboarding_controller.dart';
import '../../utils/app_feedback.dart';
import '../../utils/responsive.dart';
import '../../widgets/app_radio_option.dart';
import 'components/onboarding_scaffold.dart';
import 'components/onboarding_title_block.dart';

class PersonalDetailsScreen extends StatefulWidget {
  const PersonalDetailsScreen({
    super.key,
    this.initialName,
    this.initialDob,
    this.initialGender,
  });

  final String? initialName;
  final String? initialDob;
  final String? initialGender;

  @override
  State<PersonalDetailsScreen> createState() => _PersonalDetailsScreenState();
}

class _PersonalDetailsScreenState extends State<PersonalDetailsScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameCtrl;
  late final TextEditingController _dobCtrl;
  String? _gender;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.initialName?.trim() ?? '');
    _dobCtrl = TextEditingController(text: widget.initialDob?.trim() ?? '');
    _gender = widget.initialGender?.trim().isNotEmpty == true
        ? widget.initialGender!.trim()
        : null;
    _nameCtrl.addListener(_persistDraftToSession);
    _dobCtrl.addListener(_persistDraftToSession);
  }

  @override
  void didUpdateWidget(covariant PersonalDetailsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialName != widget.initialName &&
        widget.initialName?.trim().isNotEmpty == true) {
      _nameCtrl.text = widget.initialName!.trim();
    }
    if (oldWidget.initialDob != widget.initialDob &&
        widget.initialDob?.trim().isNotEmpty == true) {
      _dobCtrl.text = widget.initialDob!.trim();
    }
    if (oldWidget.initialGender != widget.initialGender &&
        widget.initialGender?.trim().isNotEmpty == true) {
      _gender = widget.initialGender!.trim();
    }
  }

  void _persistDraftToSession() {
    OnboardingScope.maybeOf(context)?.setPersonalDetails(
          name: _nameCtrl.text,
          dob: _dobCtrl.text,
          selectedGender: _gender ?? '',
        );
  }

  @override
  void dispose() {
    _nameCtrl.removeListener(_persistDraftToSession);
    _dobCtrl.removeListener(_persistDraftToSession);
    _nameCtrl.dispose();
    _dobCtrl.dispose();
    super.dispose();
  }

  String _formatDate(DateTime date) {
    final d = date.day.toString().padLeft(2, '0');
    final m = date.month.toString().padLeft(2, '0');
    return '$d/$m/${date.year}';
  }

  Future<void> _pickDob() async {
    final now = DateTime.now();
    final initial = DateTime(now.year - 21, now.month, now.day);
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(1950),
      lastDate: DateTime(now.year - 18, now.month, now.day),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: ColorScheme.fromSeed(seedColor: AppColors.primary),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() => _dobCtrl.text = _formatDate(picked));
      _persistDraftToSession();
    }
  }

  Future<void> _onNext() async {
    final isValid = _formKey.currentState?.validate() ?? false;
    if (!isValid) return;
    if (_gender == null || _gender!.isEmpty) {
      AppFeedback.showError(context, 'Please select gender');
      return;
    }

    final user = AuthService.currentUser;
    if (user == null) {
      AppFeedback.showError(context, 'Please sign in again');
      return;
    }

    setState(() => _isLoading = true);
    try {
      final name = _nameCtrl.text.trim();
      final dob = _dobCtrl.text.trim();
      _persistDraftToSession();
      final partnerId = await DeliveryPartnerService.docIdFor(user);
      await DeliveryPartnerService.updatePersonalDetails(
        partnerId: partnerId,
        name: name,
        dateOfBirth: dob,
        gender: _gender!,
      );
    } catch (e) {
      if (!mounted) return;
      AppFeedback.showError(context, AuthService.messageFromError(e));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  /// Go back to the city selection step by clearing the stored city so
  /// AuthGate re-evaluates and shows SelectCityScreen.
  Future<void> _onBack() async {
    if (_isLoading) return;
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
      return;
    }
    final user = AuthService.currentUser;
    if (user == null) return;
    _persistDraftToSession();
    try {
      final partnerId = await DeliveryPartnerService.docIdFor(user);
      if (!mounted) return;
      OnboardingScope.maybeOf(context)?.setCity('');
      await DeliveryPartnerService.updateCity(partnerId: partnerId, city: '');
    } catch (e) {
      if (!mounted) return;
      AppFeedback.showError(context, 'Could not go back. Try again.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = Responsive.of(context);

    return LoadingOverlay(
      isLoading: _isLoading,
      child: OnboardingScaffold(
        buttonLabel: 'Next',
        isLoading: _isLoading,
        onPressed: _onNext,
        child: Form(
          key: _formKey,
          child: ListView(
            padding: EdgeInsets.zero,
            children: [
              OnboardingTitleBlock(
                title: 'Personal Details',
                subtitle: 'Please Provide Your Basic Details',
                showBack: true,
                onBack: _onBack,
              ),
              SizedBox(
                height: r.responsive(mobile: 24.0, tablet: 28.0, desktop: 32.0),
              ),
              AppTextField(
                hint: 'Full Name',
                controller: _nameCtrl,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Full name is required';
                  }
                  return null;
                },
              ),
              SizedBox(
                height: r.responsive(mobile: 16.0, tablet: 18.0, desktop: 20.0),
              ),
              // Date of birth — read-only field with a calendar suffix icon
              // that both tapping the field and the icon open the date picker.
              AppTextField(
                hint: 'Date Of Birth  (DD/MM/YYYY)',
                controller: _dobCtrl,
                readOnly: true,
                onTap: _pickDob,
                prefixIcon: Icons.calendar_month_outlined,
                suffixIcon: IconButton(
                  tooltip: 'Pick date of birth',
                  icon: const Icon(
                    Icons.calendar_month_outlined,
                    size: 22,
                    color: AppColors.primary,
                  ),
                  onPressed: _pickDob,
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Date of birth is required';
                  }
                  return null;
                },
              ),
              SizedBox(
                height: r.responsive(mobile: 22.0, tablet: 24.0, desktop: 26.0),
              ),
              Text(
                'Gender',
                style: TextStyle(
                  fontSize: r.responsive(
                    mobile: 14.0,
                    tablet: 15.0,
                    desktop: 16.0,
                  ),
                  fontWeight: FontWeight.w600,
                  color: AppColors.textDark,
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 4,
                children: AppConstants.genders.map((g) {
                  return AppRadioOption(
                    label: g,
                    selected: _gender == g,
                    dense: true,
                    onTap: () {
                      AppFeedback.selection();
                      setState(() => _gender = g);
                      _persistDraftToSession();
                    },
                  );
                }).toList(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
