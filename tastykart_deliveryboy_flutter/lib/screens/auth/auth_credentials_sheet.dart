import 'package:flutter/material.dart';

import '../../constants/color_constants.dart';
import '../../global_widgets/app_button.dart';
import '../../global_widgets/app_text_field.dart';
import '../../services/auth_service.dart';
import '../../utils/app_feedback.dart';

enum AuthSheetMode { login, signup }

class AuthCredentialsSheet {
  AuthCredentialsSheet._();

  static Future<void> show(
    BuildContext context, {
    AuthSheetMode mode = AuthSheetMode.login,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AuthCredentialsSheetBody(initialMode: mode),
    );
  }
}

class _AuthCredentialsSheetBody extends StatefulWidget {
  const _AuthCredentialsSheetBody({required this.initialMode});

  final AuthSheetMode initialMode;

  @override
  State<_AuthCredentialsSheetBody> createState() =>
      _AuthCredentialsSheetBodyState();
}

class _AuthCredentialsSheetBodyState extends State<_AuthCredentialsSheetBody> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  late AuthSheetMode _mode;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _mode = widget.initialMode;
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  bool get _isSignup => _mode == AuthSheetMode.signup;

  Future<void> _submit() async {
    final isValid = _formKey.currentState?.validate() ?? false;
    if (!isValid || _busy) return;

    final email = _emailCtrl.text.trim();
    final password = _passwordCtrl.text;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (_isSignup) {
        await AuthService.registerWithEmail(email: email, password: password);
      } else {
        await AuthService.signInWithEmail(email: email, password: password);
      }
      if (!mounted) return;
      Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = AuthService.messageFromError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    final safe = MediaQuery.paddingOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + bottom),
      child: Material(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: EdgeInsets.fromLTRB(16, 12, 16, 16 + safe),
          child: Form(
            key: _formKey,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE0E0E0),
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                  ),
                  Text(
                    _isSignup ? 'Create Account' : 'Login',
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textDark,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _isSignup
                        ? 'Register with email and password to start onboarding'
                        : 'Enter your email and password to continue',
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.textMedium,
                    ),
                  ),
                  const SizedBox(height: 20),
                  AppTextField(
                    hint: 'Email',
                    controller: _emailCtrl,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.next,
                    prefixIcon: Icons.mail_outline,
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Email is required';
                      }
                      if (!AuthService.looksLikeEmail(value)) {
                        return 'Enter a valid email address';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 14),
                  AppTextField(
                    hint: 'Password',
                    controller: _passwordCtrl,
                    isPassword: true,
                    textInputAction: _isSignup
                        ? TextInputAction.next
                        : TextInputAction.done,
                    prefixIcon: Icons.lock_outline,
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Password is required';
                      }
                      if (value.length < 6) {
                        return 'Password must be at least 6 characters';
                      }
                      return null;
                    },
                  ),
                  if (_isSignup) ...[
                    const SizedBox(height: 14),
                    AppTextField(
                      hint: 'Confirm Password',
                      controller: _confirmCtrl,
                      isPassword: true,
                      textInputAction: TextInputAction.done,
                      prefixIcon: Icons.lock_outline,
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return 'Confirm your password';
                        }
                        if (value != _passwordCtrl.text) {
                          return 'Passwords do not match';
                        }
                        return null;
                      },
                    ),
                  ],
                  if (_error != null) ...[
                    const SizedBox(height: 16),
                    Text(
                      _error!,
                      style: const TextStyle(
                        color: AppColors.error,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 8),
                  ] else
                    const SizedBox(height: 20),
                  AppButton(
                    label: _isSignup ? 'Sign Up' : 'Login',
                    isLoading: _busy,
                    onPressed: _submit,
                  ),
                  TextButton(
                    onPressed: _busy
                        ? null
                        : () {
                            AppFeedback.selection();
                            setState(() {
                              _error = null;
                              _mode = _isSignup
                                  ? AuthSheetMode.login
                                  : AuthSheetMode.signup;
                            });
                          },
                    child: Text(
                      _isSignup
                          ? 'Already have an account? Login'
                          : "Don't have an account? Sign Up",
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
