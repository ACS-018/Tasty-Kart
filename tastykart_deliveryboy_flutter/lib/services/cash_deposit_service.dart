import 'dart:async';

import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../constants/app_constants.dart';

class CashDepositResult {
  final bool success;
  final bool verified;
  final String? reason;

  const CashDepositResult({
    required this.success,
    required this.verified,
    this.reason,
  });

  bool get isFullyVerified => success && verified;
}

/// Pays excess COD into the production Razorpay account.
/// Key secret stays in Cloud Functions.
class CashDepositService {
  CashDepositService() {
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _onSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _onError);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _onExternalWallet);
  }

  late final Razorpay _razorpay;
  final FirebaseFunctions _functions = FirebaseFunctions.instanceFor(
    region: 'asia-south1',
  );

  Completer<CashDepositResult>? _pending;
  String? _depositId;

  Future<CashDepositResult> payExcess({
    required String partnerId,
    String? name,
    String? phone,
    String? email,
  }) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      return const CashDepositResult(
        success: false,
        verified: false,
        reason: 'not_signed_in',
      );
    }
    if (_pending != null && !_pending!.isCompleted) {
      return const CashDepositResult(
        success: false,
        verified: false,
        reason: 'payment_in_progress',
      );
    }

    _pending = Completer<CashDepositResult>();
    final pending = _pending!;

    try {
      final create = _functions.httpsCallable('createCashDepositOrder');
      final createResult = await create.call(<String, dynamic>{
        'partnerId': partnerId,
      });
      final data = Map<String, dynamic>.from(createResult.data as Map);
      final keyId = data['keyId'] as String?;
      final razorpayOrderId = data['razorpayOrderId'] as String?;
      final depositId = data['depositId'] as String?;
      final amount = data['amount'];
      _depositId = depositId;

      if (keyId == null ||
          keyId.isEmpty ||
          razorpayOrderId == null ||
          razorpayOrderId.isEmpty ||
          depositId == null ||
          depositId.isEmpty) {
        _complete(
          const CashDepositResult(
            success: false,
            verified: false,
            reason: 'invalid_create_response',
          ),
        );
        return pending.future;
      }

      _razorpay.open(<String, dynamic>{
        'key': keyId,
        'amount': amount,
        'currency': data['currency'] as String? ?? 'INR',
        'name': AppConstants.appName,
        'description': 'Cash limit settlement',
        'order_id': razorpayOrderId,
        'prefill': <String, dynamic>{
          if (name != null && name.isNotEmpty) 'name': name,
          if (phone != null && phone.isNotEmpty) 'contact': phone,
          if (email != null && email.isNotEmpty) 'email': email,
        },
        'notes': <String, dynamic>{
          'type': 'cash_deposit',
          'depositId': depositId,
          'partnerId': partnerId,
        },
        'theme': <String, dynamic>{'color': '#B32B2C'},
      });
      return pending.future;
    } on FirebaseFunctionsException catch (e) {
      _complete(
        CashDepositResult(
          success: false,
          verified: false,
          reason: e.message ?? e.code,
        ),
      );
      return pending.future;
    } catch (e) {
      _complete(
        CashDepositResult(
          success: false,
          verified: false,
          reason: e.toString(),
        ),
      );
      return pending.future;
    }
  }

  Future<void> _onSuccess(PaymentSuccessResponse response) async {
    final depositId = _depositId;
    if (depositId == null) {
      _complete(
        const CashDepositResult(
          success: false,
          verified: false,
          reason: 'missing_deposit',
        ),
      );
      return;
    }
    try {
      final verify = _functions.httpsCallable('verifyCashDeposit');
      final verifyResult = await verify.call(<String, dynamic>{
        'depositId': depositId,
        'razorpay_order_id': response.orderId,
        'razorpay_payment_id': response.paymentId,
        'razorpay_signature': response.signature,
      });
      final data = Map<String, dynamic>.from(verifyResult.data as Map);
      _complete(
        CashDepositResult(
          success: data['success'] == true,
          verified: data['verified'] == true,
          reason: data['reason'] as String?,
        ),
      );
    } on FirebaseFunctionsException catch (e) {
      _complete(
        CashDepositResult(
          success: false,
          verified: false,
          reason: e.message ?? e.code,
        ),
      );
    } catch (_) {
      _complete(
        const CashDepositResult(
          success: false,
          verified: false,
          reason: 'verify_failed',
        ),
      );
    }
  }

  void _onError(PaymentFailureResponse response) {
    if (kDebugMode) {
      debugPrint('Cash deposit checkout error: ${response.code}');
    }
    _complete(
      CashDepositResult(
        success: false,
        verified: false,
        reason: response.message ?? 'checkout_failed',
      ),
    );
  }

  void _onExternalWallet(ExternalWalletResponse response) {
    if (kDebugMode) {
      debugPrint('External wallet: ${response.walletName}');
    }
  }

  void _complete(CashDepositResult result) {
    final pending = _pending;
    if (pending != null && !pending.isCompleted) {
      pending.complete(result);
    }
    _pending = null;
    _depositId = null;
  }

  void dispose() {
    _razorpay.clear();
  }
}
