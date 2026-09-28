import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../constants/color_constants.dart';
import '../../global_widgets/app_text_field.dart';
import '../../services/auth_service.dart';
import '../../services/delivery_partner_service.dart';
import '../../services/ifsc_service.dart';
import '../../utils/app_feedback.dart';
import '../../utils/responsive.dart';
import 'components/onboarding_scaffold.dart';
import 'components/onboarding_title_block.dart';

class BankDetailsScreen extends StatefulWidget {
  const BankDetailsScreen({
    super.key,
    this.accountHolderName,
    this.bankAccount,
    this.ifsc,
    this.upiId,
    this.ifscVerified = false,
  });

  final String? accountHolderName;
  final String? bankAccount;
  final String? ifsc;
  final String? upiId;
  final bool ifscVerified;

  @override
  State<BankDetailsScreen> createState() => _BankDetailsScreenState();
}

class _BankDetailsScreenState extends State<BankDetailsScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _holderCtrl;
  late final TextEditingController _accountCtrl;
  late final TextEditingController _ifscCtrl;
  late final TextEditingController _upiCtrl;
  bool _isLoading = false;
  bool _verifying = false;
  late bool _ifscVerified;

  @override
  void initState() {
    super.initState();
    _holderCtrl = TextEditingController(text: widget.accountHolderName ?? '');
    _accountCtrl = TextEditingController(text: widget.bankAccount ?? '');
    _ifscCtrl = TextEditingController(text: widget.ifsc ?? '');
    _upiCtrl = TextEditingController(text: widget.upiId ?? '');
    _ifscVerified = widget.ifscVerified;
  }

  @override
  void dispose() {
    _holderCtrl.dispose();
    _accountCtrl.dispose();
    _ifscCtrl.dispose();
    _upiCtrl.dispose();
    super.dispose();
  }

  Future<void> _verifyIfsc() async {
    final code = _ifscCtrl.text.trim().toUpperCase();
    _ifscCtrl.value = _ifscCtrl.value.copyWith(
      text: code,
      selection: TextSelection.collapsed(offset: code.length),
    );
    if (!IfscService.isValidFormat(code)) {
      AppFeedback.showError(context, 'Enter a valid 11-character IFSC');
      return;
    }
    setState(() => _verifying = true);
    try {
      final result = await IfscService.verify(code);
      if (!mounted) return;
      setState(() => _ifscVerified = true);
      final bank = result.bank.isEmpty ? 'Bank' : result.bank;
      AppFeedback.showSuccess(context, '$bank verified');
    } catch (e) {
      if (!mounted) return;
      setState(() => _ifscVerified = false);
      AppFeedback.showError(
        context,
        e is FormatException ? e.message : 'Could not verify this IFSC',
      );
    } finally {
      if (mounted) setState(() => _verifying = false);
    }
  }

  Future<void> _onNext() async {
    final isValid = _formKey.currentState?.validate() ?? false;
    if (!isValid) return;

    final user = AuthService.currentUser;
    if (user == null) {
      AppFeedback.showError(context, 'Please sign in again');
      return;
    }

    setState(() => _isLoading = true);
    try {
      final partnerId = await DeliveryPartnerService.docIdFor(user);
      await DeliveryPartnerService.updateBankDetails(
        partnerId: partnerId,
        accountHolderName: _holderCtrl.text.trim(),
        bankAccount: _accountCtrl.text.trim(),
        ifsc: _ifscCtrl.text.trim(),
        upiId: _upiCtrl.text.trim(),
        ifscVerified: _ifscVerified,
      );
    } catch (e) {
      if (!mounted) return;
      AppFeedback.showError(context, AuthService.messageFromError(e));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  /// Back — clear documentsComplete so AuthGate steps back to UploadDocumentsScreen.
  Future<void> _onBack() async {
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
      return;
    }
    final user = AuthService.currentUser;
    if (user == null) return;
    try {
      final partnerId = await DeliveryPartnerService.docIdFor(user);
      await DeliveryPartnerService.clearDocumentsComplete(partnerId: partnerId);
    } catch (_) {
      if (!mounted) return;
      AppFeedback.showError(context, 'Could not go back. Try again.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = Responsive.of(context);
    final gap = r.responsive(mobile: 16.0, tablet: 18.0, desktop: 20.0);

    return OnboardingScaffold(
        buttonLabel: 'Next',
        isLoading: _isLoading,
        onPressed: _onNext,
        child: Form(
          key: _formKey,
          child: ListView(
            padding: EdgeInsets.zero,
            children: [
              OnboardingTitleBlock(
                title: 'Bank Account Details',
                subtitle: 'Enter Your Bank Details For Receiving Payments',
                showBack: true,
                onBack: _onBack,
              ),
              SizedBox(
                height: r.responsive(mobile: 24.0, tablet: 28.0, desktop: 32.0),
              ),
              AppTextField(
                hint: 'Account Holder Name',
                controller: _holderCtrl,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Account holder name is required';
                  }
                  return null;
                },
              ),
              SizedBox(height: gap),
              AppTextField(
                hint: 'Account Number',
                controller: _accountCtrl,
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.next,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Account number is required';
                  }
                  if (value.trim().length < 8) {
                    return 'Enter a valid account number';
                  }
                  return null;
                },
              ),
              SizedBox(height: gap),
              AppTextField(
                hint: 'IFSC Code',
                controller: _ifscCtrl,
                textCapitalization: TextCapitalization.characters,
                textInputAction: TextInputAction.next,
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9]')),
                  LengthLimitingTextInputFormatter(11),
                ],
                onChanged: (_) {
                  if (_ifscVerified) setState(() => _ifscVerified = false);
                },
                suffixIcon: _verifying
                    ? const Padding(
                        padding: EdgeInsets.all(14),
                        child: SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      )
                    : TextButton(
                        onPressed: _verifyIfsc,
                        child: Text(
                          _ifscVerified ? 'Verified' : 'Verify',
                          style: TextStyle(
                            color: _ifscVerified
                                ? AppColors.success
                                : AppColors.primary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'IFSC code is required';
                  }
                  if (!IfscService.isValidFormat(value)) {
                    return 'Enter a valid 11-character IFSC';
                  }
                  return null;
                },
              ),
              SizedBox(height: gap),
              AppTextField(
                hint: 'UPI ID',
                controller: _upiCtrl,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.done,
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'UPI ID is required';
                  }
                  if (!value.contains('@')) {
                    return 'Enter a valid UPI ID';
                  }
                  return null;
                },
              ),
            ],
          ),
        ),
    );
  }
}
