import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';

import '../models/delivery_partner.dart';
import 'analytics_service.dart';
import 'crashlytics_service.dart';
import 'delivery_partner_service.dart';
import 'fcm_service.dart';
import 'firestore_paths.dart';

/// Delivery-partner Auth — Firebase email/password + Firestore profile sync.
/// Writes `users/{uid}` with `role: delivery` and Admin `deliveryPartners/{uid}`.
class AuthService {
  AuthService._();

  static final FirebaseAuth _auth = FirebaseAuth.instance;
  static final FirebaseFirestore _db = FirebaseFirestore.instance;

  static const _deliveryRole = 'delivery';

  static Stream<User?> get authStateChanges => _auth.authStateChanges();

  static User? get currentUser => _auth.currentUser;

  static final _emailPattern = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

  static bool looksLikeEmail(String raw) => _emailPattern.hasMatch(raw.trim());

  // ── Email / password ─────────────────────────────────────────────────────

  static Future<UserCredential> signInWithEmail({
    required String email,
    required String password,
  }) async {
    try {
      final cred = await _auth.signInWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
      await _enforceAccess(cred.user);
      await ensurePartnerProfile(cred.user);

      // Initialize FCM and Analytics
      await _postLoginSetup(cred.user, 'email');

      return cred;
    } catch (e, stackTrace) {
      await CrashlyticsService.recordAuthError(
        authMethod: 'email',
        error: e,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  static Future<UserCredential> registerWithEmail({
    required String email,
    required String password,
  }) async {
    try {
      final cred = await _auth.createUserWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
      // Profile and notifications continue after the account exists so
      // Sign Up is not held on those network calls.
      final user = cred.user;
      unawaited(_createFreshPartnerDocs(user));
      unawaited(
        Future<void>.delayed(const Duration(milliseconds: 600), () {
          return _postLoginSetup(user, 'email');
        }),
      );
      return cred;
    } catch (e, stackTrace) {
      await CrashlyticsService.recordAuthError(
        authMethod: 'email_register',
        error: e,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  // ── Phone OTP ────────────────────────────────────────────────────────────

  static Future<void> verifyPhoneNumber({
    required String phoneE164,
    required void Function(String verificationId) onCodeSent,
    required void Function(FirebaseAuthException e) onError,
    void Function(PhoneAuthCredential credential)? onAutoVerified,
    Duration timeout = const Duration(seconds: 60),
  }) async {
    await _auth.verifyPhoneNumber(
      phoneNumber: phoneE164,
      timeout: timeout,
      verificationCompleted: (credential) async {
        if (onAutoVerified != null) {
          onAutoVerified(credential);
        } else {
          await _auth.signInWithCredential(credential);
          await _enforceAccess(_auth.currentUser);
          await ensurePartnerProfile(_auth.currentUser);
          await _postLoginSetup(_auth.currentUser, 'phone');
        }
      },
      verificationFailed: (e) {
        CrashlyticsService.recordAuthError(
          authMethod: 'phone',
          error: e,
          stackTrace: StackTrace.current,
        );
        onError(e);
      },
      codeSent: (verificationId, _) => onCodeSent(verificationId),
      codeAutoRetrievalTimeout: (_) {},
    );
  }

  static Future<UserCredential> signInWithCredential(
    AuthCredential credential,
  ) async {
    try {
      final cred = await _auth.signInWithCredential(credential);
      await _enforceAccess(cred.user);
      await ensurePartnerProfile(cred.user);
      await _postLoginSetup(cred.user, 'phone');
      return cred;
    } catch (e, stackTrace) {
      await CrashlyticsService.recordAuthError(
        authMethod: 'credential',
        error: e,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  static Future<UserCredential> confirmPhoneOtp({
    required String verificationId,
    required String smsCode,
  }) async {
    final credential = PhoneAuthProvider.credential(
      verificationId: verificationId,
      smsCode: smsCode.trim(),
    );
    return signInWithCredential(credential);
  }

  // ── Post-Login Setup ─────────────────────────────────────────────────────

  static Future<void> _postLoginSetup(User? user, String method) async {
    if (user == null) return;

    try {
      // Set user ID for Analytics and Crashlytics
      await AnalyticsService.setUserId(user.uid);
      await CrashlyticsService.setUserId(user.uid);

      // Log login event
      await AnalyticsService.logPartnerLogin(
        partnerId: user.uid,
        method: method,
      );

      // Initialize FCM and save token
      await FCMService.initialize();
      await FCMService.saveTokenToFirestore(user.uid);

      // Set user properties for Analytics
      await AnalyticsService.setUserProperty(
        name: 'user_type',
        value: 'delivery_partner',
      );
    } catch (e) {
      // Don't fail login if post-setup fails
      debugPrint('Post-login setup error: $e');
    }
  }

  // ── Session ──────────────────────────────────────────────────────────────

  static Future<void> logout() async {
    final user = currentUser;
    await _auth.signOut();

    final uid = user?.uid;
    if (uid == null) return;
    try {
      await AnalyticsService.logPartnerLogout(uid);
    } catch (e) {
      debugPrint('Logout analytics error: $e');
    }
    try {
      await FCMService.removeTokenFromFirestore(uid);
    } catch (e) {
      debugPrint('Logout cleanup error: $e');
    }
  }

  static Future<void> _enforceAccess(User? user) async {
    if (user == null) return;
    try {
      await _assertDeliveryRole(user);
      await DeliveryPartnerService.assertNotBlocked(user);
    } on PartnerBlockedException {
      await logout();
      rethrow;
    } on WrongAppRoleException {
      await logout();
      rethrow;
    }
  }

  /// Public re-check for AuthGate / app resume.
  static Future<DeliveryPartner?> enforcePartnerAccess(User user) async {
    try {
      await _assertDeliveryRole(user);
      return await DeliveryPartnerService.assertNotBlocked(user);
    } on PartnerBlockedException {
      await logout();
      rethrow;
    } on WrongAppRoleException {
      await logout();
      rethrow;
    }
  }

  static Future<void> _assertDeliveryRole(User user) async {
    final snap = await _db.collection(FirestorePaths.users).doc(user.uid).get();
    if (!snap.exists) return;
    final role = (snap.data()?['role'] as String? ?? '').trim().toLowerCase();
    if (role.isEmpty || role == _deliveryRole) return;
    throw WrongAppRoleException(role);
  }

  // ── Profile sync (Admin-compatible `users` + `deliveryPartners`) ─────────

  static Future<void> ensurePartnerProfile(User? user) async {
    if (user == null) return;
    await _writePartnerDocs(
      user: user,
      name: user.displayName?.trim() ?? '',
      phone: user.phoneNumber,
    );
  }

  /// One transaction for a brand-new account. Skips the extra reads used on
  /// login, and will not overwrite a profile the user already started.
  static Future<void> _createFreshPartnerDocs(User? user) async {
    if (user == null) return;
    try {
      await _writeFreshPartnerDocs(user);
    } catch (e) {
      debugPrint('Fresh partner profile error: $e');
    }
  }

  static Future<void> _writeFreshPartnerDocs(User user) async {
    final now = FieldValue.serverTimestamp();
    final name = user.displayName?.trim() ?? '';
    final phone = user.phoneNumber;
    final userRef = _db.collection(FirestorePaths.users).doc(user.uid);
    final partnerRef = _db
        .collection(FirestorePaths.deliveryPartners)
        .doc(user.uid);

    await _db.runTransaction((tx) async {
      final existingPartner = await tx.get(partnerRef);
      if (existingPartner.exists) return;

      tx.set(userRef, {
        'uid': user.uid,
        'email': user.email ?? '',
        if (phone != null && phone.isNotEmpty) 'phone': phone,
        'role': _deliveryRole,
        'name': name.isEmpty ? 'Delivery Partner' : name,
        'createdAt': now,
        'updatedAt': now,
      });
      tx.set(partnerRef, {
        'id': user.uid,
        'uid': user.uid,
        'email': user.email ?? '',
        if (phone != null && phone.isNotEmpty) 'phone': phone,
        'name': name,
        'status': 'offline',
        'approved': false,
        'blockedAt': null,
        'blockedReason': null,
        'rating': 0,
        'completedOrders': 0,
        'earnings': 0,
        'pocketBalance': 0,
        'cashLimit': 0,
        'tipBalance': 0,
        'acceptRate': 0,
        'avatar': '',
        'vehicle': '',
        'vehicleNumber': '',
        'city': '',
        'documents': {},
        'documentsComplete': false,
        'trainingComplete': false,
        'termsAccepted': false,
        'activationAcknowledged': false,
        'notificationsEnabled': true,
        'fcmTokens': [],
        'bookedSlots': [],
        'joinedDate': now,
        'createdAt': now,
        'updatedAt': now,
      });
    });
  }

  static Future<void> _writePartnerDocs({
    required User user,
    required String name,
    String? phone,
  }) async {
    final now = FieldValue.serverTimestamp();
    final userRef = _db.collection(FirestorePaths.users).doc(user.uid);
    final existingUser = await userRef.get();
    final existingRole =
        (existingUser.data()?['role'] as String?)?.trim().toLowerCase() ?? '';

    if (existingUser.exists &&
        existingRole.isNotEmpty &&
        existingRole != _deliveryRole) {
      throw WrongAppRoleException(existingRole);
    }

    final userPayload = <String, dynamic>{
      'uid': user.uid,
      'email': user.email ?? '',
      if (phone != null && phone.isNotEmpty) 'phone': phone,
      'updatedAt': now,
    };
    if (name.isNotEmpty) userPayload['name'] = name;
    if (!existingUser.exists) {
      userPayload['role'] = _deliveryRole;
      userPayload['createdAt'] = now;
      if (name.isEmpty) userPayload['name'] = 'Delivery Partner';
    }
    await userRef.set(userPayload, SetOptions(merge: true));

    final partnerRef = _db
        .collection(FirestorePaths.deliveryPartners)
        .doc(user.uid);
    final existing = await partnerRef.get();
    final payload = <String, dynamic>{
      'id': user.uid,
      'uid': user.uid,
      'email': user.email ?? '',
      if (phone != null && phone.isNotEmpty) 'phone': phone,
      'updatedAt': now,
    };
    if (name.isNotEmpty) payload['name'] = name;
    if (!existing.exists) {
      payload['status'] = 'offline';
      payload['approved'] = false;
      payload['blockedAt'] = null;
      payload['blockedReason'] = null;
      payload['rating'] = 0;
      payload['completedOrders'] = 0;
      payload['earnings'] = 0;
      payload['pocketBalance'] = 0;
      payload['cashLimit'] = 0;
      payload['tipBalance'] = 0;
      payload['acceptRate'] = 0;
      payload['avatar'] = '';
      payload['vehicle'] = '';
      payload['vehicleNumber'] = '';
      payload['city'] = '';
      payload['documents'] = {};
      payload['documentsComplete'] = false;
      payload['trainingComplete'] = false;
      payload['termsAccepted'] = false;
      payload['activationAcknowledged'] = false;
      payload['notificationsEnabled'] = true;
      payload['fcmTokens'] = [];
      payload['bookedSlots'] = [];
      payload['joinedDate'] = now;
      payload['createdAt'] = now;
      if (name.isEmpty) payload['name'] = '';
    }
    await partnerRef.set(payload, SetOptions(merge: true));
  }

  // ── Errors ───────────────────────────────────────────────────────────────

  static String messageFromError(Object error) {
    if (error is PartnerBlockedException) return error.message;
    if (error is WrongAppRoleException) return error.message;
    if (error is FirebaseAuthException) {
      switch (error.code) {
        case 'invalid-email':
          return 'Enter a valid email address';
        case 'email-already-in-use':
          return 'This email is already registered. Please log in';
        case 'weak-password':
          return 'Password must be at least 6 characters';
        case 'wrong-password':
        case 'invalid-credential':
          return 'Incorrect email or password';
        case 'user-not-found':
          return 'No account found for this email';
        case 'user-disabled':
          return 'This account has been disabled';
        case 'too-many-requests':
          return 'Too many attempts. Try again later';
        case 'network-request-failed':
          return 'Network error. Check your connection';
        case 'operation-not-allowed':
          return 'Email sign-in is not enabled yet';
        case 'invalid-verification-code':
          return 'Invalid OTP code';
        case 'session-expired':
          return 'OTP expired. Request a new code';
        case 'invalid-phone-number':
          return 'Enter a valid phone number';
        case 'missing-client-identifier':
          return 'Phone sign-in is not set up for this app yet.';
        default:
          return error.message ?? 'Authentication failed. Please try again.';
      }
    }
    return 'Something went wrong. Please try again.';
  }

  /// Formats Indian numbers to E.164 when the user types 10 digits.
  static String toE164Phone(String raw, {String defaultCountryCode = '+91'}) {
    final digits = raw.replaceAll(RegExp(r'\D'), '');
    if (raw.trim().startsWith('+')) return '+$digits';
    if (digits.length == 10) return '$defaultCountryCode$digits';
    if (digits.startsWith('91') && digits.length == 12) return '+$digits';
    return '$defaultCountryCode$digits';
  }

  static bool looksLikePhone(String raw) {
    final digits = raw.replaceAll(RegExp(r'\D'), '');
    return digits.length >= 10;
  }
}
