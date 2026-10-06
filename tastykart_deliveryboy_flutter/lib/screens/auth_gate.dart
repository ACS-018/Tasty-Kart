import 'dart:async';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import '../constants/color_constants.dart';
import '../constants/legal_content.dart';
import '../models/delivery_partner.dart';
import '../services/auth_service.dart';
import '../services/delivery_partner_service.dart';
import '../state/onboarding_controller.dart';
import '../utils/app_feedback.dart';
import '../utils/app_navigation.dart';
import 'Home/home_screen.dart';
import 'auth/account_activated_screen.dart';
import 'auth/bank_details_screen.dart';
import 'auth/legal_content_screen.dart';
import 'auth/auth_choice_screen.dart';
import 'auth/online_training_screen.dart';
import 'auth/personal_details_screen.dart';
import 'auth/select_city_screen.dart';
import 'auth/select_vehicle_screen.dart';
import 'auth/under_verification_screen.dart';
import 'auth/upload_documents_screen.dart';
import 'auth/welcome_screen.dart';

/// Welcome / Login-Sign up when signed out; remaining onboarding when signed in.
class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  User? _previousUser;
  bool _showWelcome = true;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: AuthService.authStateChanges,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const _Splash();
        }

        final user = snapshot.data;
        if (user == null) {
          final justLoggedOut = _previousUser != null;
          _previousUser = null;

          WidgetsBinding.instance.addPostFrameCallback((_) {
            OnboardingScope.maybeOf(context)?.clear();
            if (justLoggedOut) {
              AppNavigation.goToAuthRoot();
              if (mounted) setState(() => _showWelcome = false);
            }
          });

          if (_showWelcome) {
            return WelcomeScreen(
              onContinue: () {
                if (mounted) setState(() => _showWelcome = false);
              },
            );
          }
          return const AuthChoiceScreen();
        }

        _previousUser = user;
        return _SignedInShell(user: user);
      },
    );
  }
}

class _SignedInShell extends StatefulWidget {
  const _SignedInShell({required this.user});

  final User user;

  @override
  State<_SignedInShell> createState() => _SignedInShellState();
}

class _SignedInShellState extends State<_SignedInShell>
    with WidgetsBindingObserver {
  StreamSubscription<DeliveryPartner?>? _partnerSub;
  bool _checkingAccess = true;
  bool _profileReady = false;
  bool _handlingBlock = false;
  String? _accessError;
  DeliveryPartner? _partner;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _bindUser();
    unawaited(
      Future<void>.delayed(const Duration(milliseconds: 300), () {
        if (mounted) _verifyAccess(initial: true);
      }),
    );
  }

  @override
  void didUpdateWidget(covariant _SignedInShell oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.user.uid != widget.user.uid) {
      _bindUser();
      _verifyAccess(initial: true);
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _verifyAccess();
    }
  }

  void _bindUser() {
    _partnerSub?.cancel();
    _profileReady = false;
    _partnerSub = DeliveryPartnerService.watchForUser(widget.user).listen(
      (partner) async {
        if (DeliveryPartnerService.isBlockedPartner(partner)) {
          // The stream may serve a stale cached doc — e.g. the admin just
          // unblocked the partner but the local Firestore cache still holds
          // `status: 'blocked'`. Before force-logging out, do a one-shot
          // server read to confirm the block is still active.
          try {
            final fresh = await DeliveryPartnerService.assertNotBlocked(
              widget.user,
            );
            // assertNotBlocked throws if still blocked.
            // If we reach here the partner is no longer blocked — update UI.
            if (!mounted) return;
            setState(() {
              _partner = fresh ?? partner;
              _profileReady = true;
              _checkingAccess = false;
            });
          } on PartnerBlockedException catch (e) {
            // Server confirmed: still blocked — force logout.
            await _forceLogoutForBlock(e.partner);
          } catch (_) {
            // Network error — fail safe: don't logout, just show the partner.
            if (!mounted) return;
            setState(() {
              _partner = partner;
              _profileReady = true;
              _checkingAccess = false;
            });
          }
          return;
        }
        if (!mounted) return;
        setState(() {
          _partner = partner;
          _profileReady = true;
          _checkingAccess = false;
        });
      },
      onError: (_, __) {
        if (!mounted) return;
        setState(() {
          _profileReady = true;
          _checkingAccess = false;
        });
      },
    );
  }

  Future<void> _verifyAccess({bool initial = false}) async {
    if (_handlingBlock) return;
    if (initial && mounted) {
      setState(() => _accessError = null);
    }

    try {
      final partner = await AuthService.enforcePartnerAccess(widget.user);
      if (!mounted) return;
      setState(() {
        if (partner != null) _partner = partner;
        _checkingAccess = false;
        _accessError = null;
      });
    } on PartnerBlockedException catch (e) {
      await _forceLogoutForBlock(e.partner);
    } on WrongAppRoleException catch (e) {
      if (mounted) AppFeedback.showError(context, e.message);
    } catch (_) {
      if (!mounted || _profileReady) return;
      setState(() {
        _checkingAccess = false;
        _accessError = initial
            ? 'Could not verify account status. Pull to retry.'
            : null;
      });
    }
  }

  Future<void> _forceLogoutForBlock(DeliveryPartner partner) async {
    if (_handlingBlock) return;
    _handlingBlock = true;
    if (mounted) AppFeedback.showError(context, partner.blockMessage);
    try {
      await AuthService.logout();
    } catch (_) {}
    _handlingBlock = false;
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _partnerSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_checkingAccess && !_profileReady) return const _Splash();

    if (_accessError != null) {
      return Scaffold(
        backgroundColor: AppColors.white,
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(_accessError!, textAlign: TextAlign.center),
                const SizedBox(height: 16),
                TextButton(
                  onPressed: () => _verifyAccess(initial: true),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final partner = _partner;
    final onboarding = OnboardingScope.maybeOf(context);

    if (partner == null || !partner.hasCity) {
      return SelectCityScreen(
        initialCity: OnboardingController.pickDraft(
          onboarding?.city ?? '',
          partner?.city ?? '',
        ),
      );
    }
    if (!partner.hasPersonalDetails) {
      return PersonalDetailsScreen(
        initialName: OnboardingController.pickDraft(
          onboarding?.fullName ?? '',
          partner.name,
        ),
        initialDob: OnboardingController.pickDraft(
          onboarding?.dateOfBirth ?? '',
          partner.dateOfBirth,
        ),
        initialGender: OnboardingController.pickDraft(
          onboarding?.gender ?? '',
          partner.gender,
        ),
      );
    }
    if (!partner.hasVehicle) {
      return SelectVehicleScreen(
        initialVehicle: OnboardingController.pickDraft(
          onboarding?.vehicle ?? '',
          partner.vehicle,
        ),
      );
    }
    if (!partner.documentsComplete) {
      return UploadDocumentsScreen(partner: partner);
    }
    if (!partner.hasBankDetails) {
      return BankDetailsScreen(
        accountHolderName: partner.accountHolderName,
        bankAccount: partner.bankAccount,
        ifsc: partner.ifsc,
        upiId: partner.upiId,
        ifscVerified: partner.ifscVerified,
      );
    }
    if (!partner.trainingComplete) {
      return OnlineTrainingScreen(completedIds: partner.trainingCompleted);
    }
    if (!partner.hasAcceptedLegal(LegalContent.agreement.id)) {
      return const LegalContentScreen(page: LegalContent.agreement);
    }
    if (!partner.hasAcceptedLegal(LegalContent.terms.id)) {
      return const LegalContentScreen(page: LegalContent.terms);
    }
    if (!partner.hasAcceptedLegal(LegalContent.privacy.id)) {
      return const LegalContentScreen(
        page: LegalContent.privacy,
        isLastPage: true,
      );
    }
    if (!partner.approved) {
      return const UnderVerificationScreen();
    }
    if (!partner.activationAcknowledged) {
      return const AccountActivatedScreen();
    }
    return HomeScreen(partner: partner);
  }
}

class _Splash extends StatelessWidget {
  const _Splash();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: AppColors.primary,
      body: Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(AppColors.white),
        ),
      ),
    );
  }
}
