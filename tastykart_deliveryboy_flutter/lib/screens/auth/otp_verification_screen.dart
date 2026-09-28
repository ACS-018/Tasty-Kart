import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../constants/color_constants.dart';
import '../../global_widgets/loading_overlay.dart';
import '../../services/auth_service.dart';
import '../../utils/app_feedback.dart';
import '../../utils/app_navigation.dart';
import '../../utils/responsive.dart';
import 'components/onboarding_scaffold.dart';
import 'components/onboarding_title_block.dart';
import 'components/scooter_illustration.dart';

class OtpVerificationScreen extends StatefulWidget {
  const OtpVerificationScreen({
    super.key,
    required this.phone,
    required this.verificationId,
    this.autoVerified = false,
  });

  final String phone;
  final String verificationId;
  final bool autoVerified;

  @override
  State<OtpVerificationScreen> createState() => _OtpVerificationScreenState();
}

class _OtpVerificationScreenState extends State<OtpVerificationScreen> {
  static const int _otpLength = 6;
  static const int _resendSeconds = 60;

  final List<TextEditingController> _controllers = List.generate(
    _otpLength,
    (_) => TextEditingController(),
  );
  final List<FocusNode> _focusNodes = List.generate(_otpLength, (_) => FocusNode());

  bool _isLoading = false;
  int _secondsLeft = _resendSeconds;
  Timer? _timer;
  late String _verificationId;

  @override
  void initState() {
    super.initState();
    _verificationId = widget.verificationId;
    _startCountdown();
    if (widget.autoVerified) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _finishAuth());
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    for (final c in _controllers) {
      c.dispose();
    }
    for (final f in _focusNodes) {
      f.dispose();
    }
    super.dispose();
  }

  void _startCountdown() {
    _timer?.cancel();
    setState(() => _secondsLeft = _resendSeconds);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_secondsLeft == 0) {
        t.cancel();
      } else {
        setState(() => _secondsLeft--);
      }
    });
  }

  String get _otp => _controllers.map((c) => c.text).join();

  Future<void> _finishAuth() async {
    if (!mounted) return;
    AppNavigation.goToAuthRoot();
  }

  Future<void> _onNext() async {
    if (widget.autoVerified) {
      await _finishAuth();
      return;
    }
    if (_otp.length < _otpLength) {
      AppFeedback.showError(context, 'Please enter the complete 6-digit OTP.');
      return;
    }
    setState(() => _isLoading = true);
    try {
      await AuthService.confirmPhoneOtp(
        verificationId: _verificationId,
        smsCode: _otp,
      );
      if (!mounted) return;
      await _finishAuth();
    } catch (e) {
      if (!mounted) return;
      AppFeedback.showError(context, AuthService.messageFromError(e));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _onResend() async {
    if (_secondsLeft > 0) return;
    setState(() => _isLoading = true);
    await AuthService.verifyPhoneNumber(
      phoneE164: widget.phone,
      onCodeSent: (id) {
        _verificationId = id;
        if (!mounted) return;
        setState(() => _isLoading = false);
        for (final c in _controllers) {
          c.clear();
        }
        _focusNodes.first.requestFocus();
        _startCountdown();
        AppFeedback.showSuccess(context, 'OTP resent');
      },
      onError: (FirebaseAuthException e) {
        if (!mounted) return;
        setState(() => _isLoading = false);
        AppFeedback.showError(context, AuthService.messageFromError(e));
      },
    );
  }

  void _onDigitChanged(String value, int index) {
    if (value.length > 1) {
      final digits = value.replaceAll(RegExp(r'\D'), '');
      for (var i = 0; i < _otpLength; i++) {
        _controllers[i].text = i < digits.length ? digits[i] : '';
      }
      final next = digits.length >= _otpLength ? _otpLength - 1 : digits.length;
      _focusNodes[next].requestFocus();
      return;
    }
    if (value.length == 1 && index < _otpLength - 1) {
      _focusNodes[index + 1].requestFocus();
    }
    if (value.isEmpty && index > 0) {
      _focusNodes[index - 1].requestFocus();
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = Responsive.of(context);
    final headerHeight = r.responsive(mobile: 220.0, tablet: 260.0, desktop: 280.0);
    final boxSize = r.responsive(mobile: 44.0, tablet: 50.0, desktop: 54.0);

    return LoadingOverlay(
      isLoading: _isLoading,
      child: OnboardingScaffold(
        header: SizedBox(
          height: headerHeight,
          width: double.infinity,
          child: const ColoredBox(
            color: AppColors.illustrationBackground,
            child: ScooterIllustration(),
          ),
        ),
        buttonLabel: 'Next',
        isLoading: _isLoading,
        onPressed: _onNext,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const OnboardingTitleBlock(
              title: 'Enter OTP',
              subtitle: 'We Have Sent 6 Digit OTP To Your Mobile number',
            ),
            SizedBox(height: r.responsive(mobile: 28.0, tablet: 32.0, desktop: 36.0)),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: List.generate(_otpLength, (i) {
                return SizedBox(
                  width: boxSize,
                  height: boxSize,
                  child: TextField(
                    controller: _controllers[i],
                    focusNode: _focusNodes[i],
                    textAlign: TextAlign.center,
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    maxLength: i == 0 ? _otpLength : 1,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textDark,
                    ),
                    decoration: InputDecoration(
                      counterText: '',
                      filled: true,
                      fillColor: AppColors.white,
                      contentPadding: EdgeInsets.zero,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: AppColors.inputBorder),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: AppColors.inputBorder),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(
                          color: AppColors.primary,
                          width: 1.5,
                        ),
                      ),
                    ),
                    onChanged: (v) => _onDigitChanged(v, i),
                  ),
                );
              }),
            ),
            SizedBox(height: r.responsive(mobile: 16.0, tablet: 18.0, desktop: 20.0)),
            Center(
              child: GestureDetector(
                onTap: _secondsLeft > 0 ? null : _onResend,
                child: _secondsLeft > 0
                    ? Text.rich(
                        TextSpan(
                          style: TextStyle(
                            fontSize: r.responsive(
                              mobile: 13.0,
                              tablet: 14.0,
                              desktop: 14.0,
                            ),
                            color: AppColors.textMedium,
                          ),
                          children: [
                            const TextSpan(text: 'Resend OTP in '),
                            TextSpan(
                              text: '$_secondsLeft',
                              style: const TextStyle(
                                color: AppColors.primary,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const TextSpan(text: ' Seconds'),
                          ],
                        ),
                      )
                    : Text(
                        'Resend OTP',
                        style: TextStyle(
                          fontSize: r.responsive(
                            mobile: 13.0,
                            tablet: 14.0,
                            desktop: 14.0,
                          ),
                          color: AppColors.primary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
