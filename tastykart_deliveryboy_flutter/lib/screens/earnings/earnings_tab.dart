import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../constants/color_constants.dart';
import '../../models/delivery_order.dart';
import '../../models/delivery_partner.dart';
import '../../models/partner_transaction.dart';
import '../../services/delivery_partner_service.dart';
import '../../services/order_service.dart';
import '../../services/settings_service.dart';
import '../../services/transaction_service.dart';
import '../../utils/app_feedback.dart';
import '../../utils/app_navigation.dart';
import '../../utils/formatters.dart';
import '../Home/components/home_header.dart';
import 'cash_deposit_screen.dart';
import 'deduction_statement_screen.dart';
import 'payout_screen.dart';
import 'tip_deduction_screen.dart';
import 'wallet_statement_screen.dart';

class EarningsTab extends StatefulWidget {
  const EarningsTab({super.key, required this.partner});

  final DeliveryPartner partner;

  @override
  State<EarningsTab> createState() => _EarningsTabState();
}

class _EarningsTabState extends State<EarningsTab> {
  DeliveryPartner get partner => widget.partner;

  /// Shows the UPI withdrawal bottom sheet and processes the payout.
  Future<void> _showWithdrawSheet(BuildContext context) async {
    final settings = await SettingsService.getSettings(forceRefresh: true);
    if (!context.mounted) return;
    final limits = settings.deliveryPartner;
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _WithdrawSheet(
        partner: partner,
        minAmount: limits.withdrawalMinAmount,
        maxAmount: limits.withdrawalMaxAmount,
      ),
    );
  }

  /// Shows a simple sheet to update the partner's UPI ID.
  Future<void> _showEditUpiSheet(BuildContext context) async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _EditUpiSheet(partner: partner),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: AppColors.surface,
      child: Column(
        children: [
          HomeHeader(partner: partner, compact: true),
          Expanded(
            child: StreamBuilder<PlatformSettings>(
              stream: SettingsService.watchSettings(),
              builder: (context, settingsSnap) {
                final dp =
                    settingsSnap.data?.deliveryPartner ??
                    const DeliveryPartnerSettings();
                return StreamBuilder<List<DeliveryOrder>>(
                  stream: OrderService.watchForPartner(partner.id),
                  builder: (context, orderSnap) {
                    final orders = orderSnap.data ?? const <DeliveryOrder>[];

                    final weekEarn = _weekEarnings(orders);

                    return ListView(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    "This Week's Earnings",
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.textMedium,
                                    ),
                                  ),
                                  Text(
                                    rupee(weekEarn),
                                    style: const TextStyle(
                                      fontSize: 28,
                                      fontWeight: FontWeight.w800,
                                      color: AppColors.textDark,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Delivery pay for this week\'s trips. It is added to your Pocket Balance.',
                          style: TextStyle(
                            fontSize: 11,
                            color: AppColors.textMedium,
                          ),
                        ),
                        const SizedBox(height: 16),

                        _MoneySplitCard(
                          pocket: partner.displayPocket,
                          tips: partner.tipBalance,
                          cashInHand: partner.cashInHandRupees,
                        ),
                        const SizedBox(height: 16),

                        // ── Today's stats ────────────────────────────
                        _PerformanceCard(
                          partnerId: partner.id,
                          orders: orders,
                          settings: dp,
                        ),
                        const SizedBox(height: 16),

                        // ── Recent COD order breakdown ────────────────
                        _RecentOrdersCard(orders: orders),
                        const SizedBox(height: 16),

                        // ── Pocket Balance card with UPI withdraw ────
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFCE8E8),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    width: 36,
                                    height: 36,
                                    decoration: BoxDecoration(
                                      color: AppColors.primary.withValues(
                                        alpha: 0.12,
                                      ),
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(
                                      Icons.account_balance_wallet_rounded,
                                      size: 18,
                                      color: AppColors.primary,
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  const Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'Pocket Balance (Your Earnings)',
                                          style: TextStyle(
                                            fontWeight: FontWeight.w700,
                                            fontSize: 14,
                                            color: AppColors.textDark,
                                          ),
                                        ),
                                        Text(
                                          'Delivery fees + bonuses + incentives — YOUR money',
                                          style: TextStyle(
                                            fontSize: 10,
                                            color: AppColors.textMedium,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 10),
                              Text(
                                rupee(partner.displayPocket),
                                style: const TextStyle(
                                  fontSize: 26,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.textDark,
                                ),
                              ),
                              const SizedBox(height: 8),
                              // UPI ID display
                              if (partner.upiId.isNotEmpty)
                                Row(
                                  children: [
                                    const Icon(
                                      Icons.account_balance_rounded,
                                      size: 14,
                                      color: AppColors.textMedium,
                                    ),
                                    const SizedBox(width: 6),
                                    Expanded(
                                      child: Text(
                                        partner.upiId,
                                        style: const TextStyle(
                                          fontSize: 13,
                                          color: AppColors.textMedium,
                                          fontFamily: 'monospace',
                                        ),
                                      ),
                                    ),
                                    GestureDetector(
                                      onTap: () => _showEditUpiSheet(context),
                                      child: const Text(
                                        'Edit',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.primary,
                                        ),
                                      ),
                                    ),
                                  ],
                                )
                              else
                                GestureDetector(
                                  onTap: () => _showEditUpiSheet(context),
                                  child: const Text(
                                    'Tap to add UPI ID',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: AppColors.primary,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                              const SizedBox(height: 14),
                              SizedBox(
                                width: double.infinity,
                                child: ElevatedButton.icon(
                                  onPressed:
                                      partner.displayPocket > 0 ||
                                          partner.tipBalance.round() > 0
                                      ? () => _showWithdrawSheet(context)
                                      : null,
                                  icon: const Icon(
                                    Icons.account_balance_wallet_rounded,
                                    size: 18,
                                  ),
                                  label: const Text('Withdraw via UPI'),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: AppColors.primary,
                                    foregroundColor: AppColors.white,
                                    elevation: 0,
                                    minimumSize: const Size.fromHeight(44),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),

                        _CashInHandCard(
                          held: partner.cashInHandRupees,
                          limit: partner.effectiveCashLimit(
                            dp.cashLimitDefault,
                          ),
                          due: partner.cashDue(
                            partner.effectiveCashLimit(dp.cashLimitDefault),
                          ),
                          onPay: () => AppNavigation.push(
                            context,
                            CashDepositScreen(
                              partner: partner,
                              cashLimit: partner.effectiveCashLimit(
                                dp.cashLimitDefault,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),

                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF3E5F5),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 36,
                                height: 36,
                                decoration: BoxDecoration(
                                  color: const Color(
                                    0xFFCE93D8,
                                  ).withValues(alpha: 0.3),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.volunteer_activism_rounded,
                                  size: 18,
                                  color: Color(0xFF6A1B9A),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'Tip Balance',
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w700,
                                        color: Color(0xFF4A148C),
                                      ),
                                    ),
                                    const Text(
                                      'Tips from customers — YOUR money, withdraw anytime',
                                      style: TextStyle(
                                        fontSize: 10,
                                        color: Color(0xFF7B1FA2),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              Text(
                                rupee(partner.tipBalance),
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF4A148C),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),

                        Row(
                          children: [
                            Expanded(
                              child: _gridTile(
                                icon: Icons.calendar_month_outlined,
                                title: 'PayOut',
                                subtitle:
                                    '${rupee(weekEarn)}\n${formatWeekRange(DateTime.now())}',
                                onTap: () => AppNavigation.push(
                                  context,
                                  PayoutScreen(partner: partner),
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: _gridTile(
                                icon: Icons.account_balance_wallet_outlined,
                                title: 'Wallet Statement',
                                onTap: () => AppNavigation.push(
                                  context,
                                  WalletStatementScreen(
                                    partner: partner,
                                    title: 'Wallet Statement',
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: _gridTile(
                                icon: Icons.description_outlined,
                                title: 'Deduction Statement',
                                onTap: () => AppNavigation.push(
                                  context,
                                  DeductionStatementScreen(partner: partner),
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: _gridTile(
                                icon: Icons.percent,
                                title: 'Tip Deduction',
                                onTap: () => AppNavigation.push(
                                  context,
                                  TipDeductionScreen(partner: partner),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
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

  int _weekEarnings(List<DeliveryOrder> orders) {
    final start = startOfWeek(DateTime.now());
    return orders
        .where((o) {
          if (!o.isDelivered || o.createdAt == null) return false;
          return !o.createdAt!.isBefore(start);
        })
        // Use deliveryFee only — tip is shown separately in the Tip Balance
        // card on this same screen. Including tip here would count it twice.
        .fold<int>(
          0,
          (sum, o) => sum + (o.deliveryFee > 0 ? o.deliveryFee : o.total),
        );
  }

  Widget _gridTile({
    required IconData icon,
    required String title,
    String? subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        height: 120,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.white,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: AppColors.primary),
            const Spacer(),
            Text(
              title,
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                color: AppColors.textDark,
              ),
            ),
            if (subtitle != null)
              Text(
                subtitle,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 11,
                  color: AppColors.textMedium,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ── UPI Withdrawal bottom sheet ───────────────────────────────────────────────

class _WithdrawSheet extends StatefulWidget {
  const _WithdrawSheet({
    required this.partner,
    required this.minAmount,
    required this.maxAmount,
  });
  final DeliveryPartner partner;
  final int minAmount;
  final int maxAmount;

  @override
  State<_WithdrawSheet> createState() => _WithdrawSheetState();
}

class _WithdrawSheetState extends State<_WithdrawSheet> {
  final _amountCtrl = TextEditingController();
  bool _loading = false;
  bool _includeTips = false;
  String? _error;

  int get _pocket => widget.partner.displayPocket;

  int get _tips => widget.partner.tipBalance.round();

  int get _withdrawablePool => _pocket + (_includeTips ? _tips : 0);

  /// The most that can be requested: pocket (+ tips if included), capped by admin max.
  int get _allowedMax {
    final cap = widget.maxAmount;
    final pool = _withdrawablePool;
    if (cap > 0 && cap < pool) return cap;
    return pool;
  }

  /// Pocket first, then tips when tips are included in this withdrawal.
  (int pocketPart, int tipPart) _splitWithdrawal(int total) {
    if (total <= 0) return (0, 0);
    final fromPocket = total <= _pocket ? total : _pocket;
    final remainder = total - fromPocket;
    final fromTips = _includeTips ? remainder.clamp(0, _tips) : 0;
    return (fromPocket, fromTips);
  }

  String get _upiId => widget.partner.upiId;

  @override
  void dispose() {
    _amountCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final raw = int.tryParse(_amountCtrl.text.trim()) ?? 0;
    final minAmount = widget.minAmount;
    final maxAmount = widget.maxAmount;
    if (raw <= 0) {
      setState(() => _error = 'Enter a valid amount');
      return;
    }
    if (minAmount > 0 && raw < minAmount) {
      setState(() => _error = 'Minimum withdrawal is ₹$minAmount');
      return;
    }
    if (maxAmount > 0 && raw > maxAmount) {
      setState(() => _error = 'Maximum withdrawal is ₹$maxAmount');
      return;
    }
    if (raw > _withdrawablePool) {
      setState(
        () => _error = _includeTips
            ? 'Amount exceeds available ₹$_withdrawablePool (Pocket ₹$_pocket + Tips ₹$_tips)'
            : 'Amount exceeds pocket balance ₹$_pocket. Turn on "Include tips" to add tips.',
      );
      return;
    }
    final (pocketPart, tipPart) = _splitWithdrawal(raw);
    if (pocketPart + tipPart != raw) {
      setState(() => _error = 'Enter a valid amount');
      return;
    }
    if (_upiId.isEmpty) {
      setState(() => _error = 'No UPI ID configured in your profile');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await DeliveryPartnerService.adjustWallet(
        partnerId: widget.partner.id,
        delta: -pocketPart,
        tipDelta: -tipPart,
      );
      try {
        await TransactionService.requestWithdrawal(
          partnerId: widget.partner.id,
          partnerName: widget.partner.name,
          amount: raw,
          upiId: _upiId,
          phone: widget.partner.phone,
          pocketAmount: pocketPart,
          tipAmount: tipPart,
        );
      } catch (e) {
        await DeliveryPartnerService.adjustWallet(
          partnerId: widget.partner.id,
          delta: pocketPart,
          tipDelta: tipPart,
        );
        rethrow;
      }
      if (mounted) {
        Navigator.pop(context);
        final detail = tipPart > 0
            ? ' (Pocket ₹$pocketPart + Tips ₹$tipPart)'
            : '';
        AppFeedback.showSuccess(
          context,
          'Withdrawal of ₹$raw$detail submitted. Status: Pending',
        );
      }
    } catch (e) {
      if (mounted) {
        final message = e.toString().replaceFirst('Exception: ', '');
        setState(
          () => _error = message.trim().isEmpty
              ? 'Could not process withdrawal. Try again.'
              : message,
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return Container(
      padding: EdgeInsets.fromLTRB(24, 20, 24, 24 + bottom),
      decoration: const BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFDDDDDD),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 20),

          const Text(
            'Withdraw via UPI',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: AppColors.textDark,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Your earnings — not cash in hand (COD)',
            style: const TextStyle(fontSize: 12, color: AppColors.textMedium),
          ),
          const SizedBox(height: 12),
          _WithdrawBalanceRow(
            label: 'Pocket Balance',
            amount: _pocket,
            color: AppColors.primary,
          ),
          const SizedBox(height: 8),
          _WithdrawBalanceRow(
            label: 'Tip Balance',
            amount: _tips,
            color: const Color(0xFF6A1B9A),
          ),
          if (_includeTips && _tips > 0) ...[
            const SizedBox(height: 8),
            Text(
              'You can withdraw up to ${rupee(_withdrawablePool)} (pocket + tips)',
              style: const TextStyle(fontSize: 12, color: AppColors.textMedium),
            ),
          ],
          const SizedBox(height: 12),
          SwitchListTile.adaptive(
            contentPadding: EdgeInsets.zero,
            value: _includeTips,
            onChanged: _tips <= 0
                ? null
                : (v) => setState(() {
                    _includeTips = v;
                    _error = null;
                  }),
            title: const Text(
              'Include tip balance in this withdrawal',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.textDark,
              ),
            ),
            subtitle: Text(
              _tips > 0
                  ? 'Adds up to ${rupee(_tips)} from tips to your withdrawal limit'
                  : 'No tips available right now',
              style: const TextStyle(fontSize: 12, color: AppColors.textMedium),
            ),
          ),
          const SizedBox(height: 8),

          // UPI ID display
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFF5F5F5),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.account_balance_rounded,
                  color: AppColors.primary,
                  size: 20,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'UPI ID',
                        style: TextStyle(
                          fontSize: 11,
                          color: AppColors.textMedium,
                        ),
                      ),
                      Text(
                        _upiId.isEmpty ? 'Not configured' : _upiId,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: _upiId.isEmpty
                              ? AppColors.error
                              : AppColors.textDark,
                        ),
                      ),
                    ],
                  ),
                ),
                GestureDetector(
                  onTap: () {
                    if (_upiId.isNotEmpty) {
                      Clipboard.setData(ClipboardData(text: _upiId));
                      AppFeedback.showSnackBar(
                        context,
                        message: 'UPI ID copied',
                      );
                    }
                  },
                  child: const Icon(
                    Icons.copy_rounded,
                    size: 16,
                    color: AppColors.textMedium,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Amount field
          TextField(
            controller: _amountCtrl,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: AppColors.textDark,
            ),
            decoration: InputDecoration(
              labelText: 'Amount (₹)',
              hintText: 'e.g. 500',
              prefixText: '₹ ',
              prefixStyle: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: AppColors.textDark,
              ),
              filled: true,
              fillColor: const Color(0xFFF9F9F9),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFDDDDDD)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFDDDDDD)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(
                  color: AppColors.primary,
                  width: 1.5,
                ),
              ),
              suffixIcon: TextButton(
                onPressed: () => _amountCtrl.text = '$_allowedMax',
                child: const Text(
                  'Max',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
            onChanged: (_) => setState(() => _error = null),
          ),

          Builder(
            builder: (context) {
              final raw = int.tryParse(_amountCtrl.text.trim()) ?? 0;
              if (raw <= 0) return const SizedBox.shrink();
              final (pocketPart, tipPart) = _splitWithdrawal(raw);
              return Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(
                  tipPart > 0
                      ? 'From Pocket ${rupee(pocketPart)} · From Tips ${rupee(tipPart)}'
                      : 'From Pocket ${rupee(pocketPart)}',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textMedium,
                  ),
                ),
              );
            },
          ),

          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(
              _error!,
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.error,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
          const SizedBox(height: 12),
          Text(
            widget.minAmount > 0
                ? 'Minimum withdrawal is ₹${widget.minAmount}${widget.maxAmount > 0 ? '. Maximum is ₹${widget.maxAmount}' : ''}. This stays Pending until an admin approves it.'
                : 'This stays Pending until an admin approves it.',
            style: const TextStyle(fontSize: 12, color: AppColors.textMedium),
          ),
          const SizedBox(height: 12),

          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: _loading || _upiId.isEmpty ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: _loading
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: AppColors.white,
                      ),
                    )
                  : const Text(
                      'Request Withdrawal',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _WithdrawBalanceRow extends StatelessWidget {
  const _WithdrawBalanceRow({
    required this.label,
    required this.amount,
    required this.color,
  });

  final String label;
  final int amount;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 4,
          height: 28,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.textDark,
            ),
          ),
        ),
        Text(
          rupee(amount),
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w800,
            color: color,
          ),
        ),
      ],
    );
  }
}

// ── Edit UPI bottom sheet ─────────────────────────────────────────────────────

class _EditUpiSheet extends StatefulWidget {
  const _EditUpiSheet({required this.partner});
  final DeliveryPartner partner;

  @override
  State<_EditUpiSheet> createState() => _EditUpiSheetState();
}

class _EditUpiSheetState extends State<_EditUpiSheet> {
  late final TextEditingController _ctrl;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.partner.upiId);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final upi = _ctrl.text.trim();
    if (upi.isEmpty || !upi.contains('@')) {
      setState(() => _error = 'Enter a valid UPI ID (e.g. name@upi)');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await DeliveryPartnerService.updateBankDetails(
        partnerId: widget.partner.id,
        accountHolderName: widget.partner.accountHolderName,
        bankAccount: widget.partner.bankAccount,
        ifsc: widget.partner.ifsc,
        upiId: upi,
        ifscVerified: widget.partner.ifscVerified,
      );
      if (mounted) {
        Navigator.pop(context);
        AppFeedback.showSuccess(context, 'UPI ID updated');
      }
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Could not update UPI ID. Try again.');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return Container(
      padding: EdgeInsets.fromLTRB(24, 20, 24, 24 + bottom),
      decoration: const BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFDDDDDD),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'Update UPI ID',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: AppColors.textDark,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Your earnings will be sent to this UPI ID',
            style: TextStyle(fontSize: 13, color: AppColors.textMedium),
          ),
          const SizedBox(height: 20),
          TextField(
            controller: _ctrl,
            keyboardType: TextInputType.emailAddress,
            style: const TextStyle(fontSize: 16, color: AppColors.textDark),
            decoration: InputDecoration(
              labelText: 'UPI ID',
              hintText: 'e.g. yourname@upi',
              filled: true,
              fillColor: const Color(0xFFF9F9F9),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFDDDDDD)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFDDDDDD)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(
                  color: AppColors.primary,
                  width: 1.5,
                ),
              ),
              prefixIcon: const Icon(
                Icons.account_balance_rounded,
                color: AppColors.textMedium,
                size: 20,
              ),
            ),
            onChanged: (_) => setState(() => _error = null),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(
              _error!,
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.error,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: _loading ? null : _save,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: _loading
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: AppColors.white,
                      ),
                    )
                  : const Text(
                      'Save UPI ID',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Small stat chip ──────────────────────────────────────────────────────────

enum _StatsPeriod { today, week, month, lifetime }

/// Trips, delivery pay and incentives for a selectable period.
class _PerformanceCard extends StatefulWidget {
  const _PerformanceCard({
    required this.partnerId,
    required this.orders,
    required this.settings,
  });

  final String partnerId;
  final List<DeliveryOrder> orders;
  final DeliveryPartnerSettings settings;

  @override
  State<_PerformanceCard> createState() => _PerformanceCardState();
}

class _PerformanceCardState extends State<_PerformanceCard> {
  _StatsPeriod _period = _StatsPeriod.today;
  late final Stream<List<PartnerTransaction>> _bonuses =
      TransactionService.watchForPartner(
        widget.partnerId,
        limit: 200,
      ).map((list) => list.where((t) => t.type == 'bonus').toList());

  static const _labels = {
    _StatsPeriod.today: 'Today',
    _StatsPeriod.week: 'Week',
    _StatsPeriod.month: 'Month',
    _StatsPeriod.lifetime: 'Lifetime',
  };

  static DateTime? _timeOf(DeliveryOrder o) => o.deliveredAt ?? o.createdAt;

  DateTime? _startFor(_StatsPeriod period) {
    final now = DateTime.now();
    switch (period) {
      case _StatsPeriod.today:
        return startOfDay(now);
      case _StatsPeriod.week:
        return startOfWeek(now);
      case _StatsPeriod.month:
        return startOfMonth(now);
      case _StatsPeriod.lifetime:
        return null;
    }
  }

  String _nextTierLabel(int trips, List<IncentiveSlot> slots) {
    for (final slot in slots) {
      if (trips < slot.trips) {
        final diff = slot.trips - trips;
        return '$diff more trip${diff == 1 ? '' : 's'} this week to earn ${rupee(slot.amount)} bonus';
      }
    }
    return '';
  }

  @override
  Widget build(BuildContext context) {
    final dp = widget.settings;
    final delivered = widget.orders
        .where((o) => o.isDelivered && _timeOf(o) != null)
        .toList();
    final start = _startFor(_period);
    final inPeriod = start == null
        ? delivered
        : delivered.where((o) => !_timeOf(o)!.isBefore(start)).toList();
    final trips = inPeriod.length;
    final earned = inPeriod.fold<int>(0, (s, o) => s + o.payout);

    // Incentives are paid per Mon–Sun week on that week's trip count.
    final tripsPerWeek = <DateTime, int>{};
    for (final o in delivered) {
      final week = startOfWeek(_timeOf(o)!);
      tripsPerWeek[week] = (tripsPerWeek[week] ?? 0) + 1;
    }
    final thisWeekTrips = tripsPerWeek[startOfWeek(DateTime.now())] ?? 0;
    final weekly =
        _period == _StatsPeriod.today || _period == _StatsPeriod.week;
    final incentive = weekly
        ? dp.incentiveFor(thisWeekTrips)
        : tripsPerWeek.entries
              .where(
                (e) =>
                    start == null ||
                    e.key.add(const Duration(days: 7)).isAfter(start),
              )
              .fold<int>(0, (s, e) => s + dp.incentiveFor(e.value));

    final nextTier = weekly && dp.incentiveSlots.isNotEmpty
        ? _nextTierLabel(thisWeekTrips, dp.incentiveSlots)
        : '';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Your Performance',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 13,
              color: AppColors.textMedium,
            ),
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: _StatsPeriod.values.map((p) {
                final selected = p == _period;
                return Expanded(
                  child: GestureDetector(
                    onTap: () {
                      if (selected) return;
                      AppFeedback.selection();
                      setState(() => _period = p);
                    },
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      padding: const EdgeInsets.symmetric(vertical: 7),
                      decoration: BoxDecoration(
                        color: selected
                            ? AppColors.primary
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        _labels[p]!,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: selected
                              ? AppColors.white
                              : AppColors.textMedium,
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _StatChip(
                label: 'Trips',
                value: '$trips',
                icon: Icons.delivery_dining,
                highlight: trips > 0,
              ),
              const SizedBox(width: 8),
              _StatChip(
                label: 'Earned',
                value: rupee(earned),
                icon: Icons.currency_rupee,
                highlight: earned > 0,
              ),
              const SizedBox(width: 8),
              _StatChip(
                label: _period == _StatsPeriod.today
                    ? 'Week Incentive'
                    : 'Incentive',
                value: incentive > 0 ? rupee(incentive) : '—',
                icon: Icons.star_rounded,
                highlight: incentive > 0,
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            trips > 0
                ? 'Avg ${rupee((earned / trips).round())} per trip · Earned = delivery fee + tips'
                : 'No deliveries ${_period == _StatsPeriod.lifetime ? 'yet' : 'in this period'}',
            style: const TextStyle(fontSize: 11, color: AppColors.textMedium),
          ),
          StreamBuilder<List<PartnerTransaction>>(
            stream: _bonuses,
            builder: (context, snap) {
              final paid = (snap.data ?? const <PartnerTransaction>[])
                  .where(
                    (t) =>
                        start == null ||
                        (t.createdAt != null && !t.createdAt!.isBefore(start)),
                  )
                  .toList();
              final total = paid.fold<int>(0, (s, t) => s + t.amount.abs());
              if (total <= 0) return const SizedBox.shrink();
              return Container(
                margin: const EdgeInsets.only(top: 8),
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFE8F5E9),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.card_giftcard_rounded,
                      size: 16,
                      color: Color(0xFF2E7D32),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        _period == _StatsPeriod.today
                            ? "Today's target bonus added to Pocket Balance"
                            : 'Daily target bonus · ${paid.length} day${paid.length == 1 ? '' : 's'} · added to Pocket Balance',
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF1B5E20),
                        ),
                      ),
                    ),
                    Text(
                      '+${rupee(total)}',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF2E7D32),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
          if (nextTier.isNotEmpty) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                const Icon(
                  Icons.emoji_events,
                  color: Color(0xFFFFC107),
                  size: 16,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    nextTier,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({
    required this.label,
    required this.value,
    required this.icon,
    this.highlight = false,
  });

  final String label;
  final String value;
  final IconData icon;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
        decoration: BoxDecoration(
          color: highlight
              ? AppColors.primary.withValues(alpha: 0.1)
              : AppColors.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: highlight ? AppColors.primary : const Color(0xFFE6E6E6),
            width: highlight ? 1.5 : 1,
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 18,
              color: highlight ? AppColors.primary : AppColors.textMedium,
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 13,
                color: highlight ? AppColors.primary : AppColors.textDark,
              ),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 2),
            SizedBox(
              height: 26, // Fixed height for 2 lines of text
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 10,
                  color: AppColors.textMedium,
                  height: 1.3,
                ),
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Recent COD Orders breakdown card ─────────────────────────────────────────

/// Shows the last 10 delivered orders with a Zomato-style 3-way split:
///   • Order Amount  → TastyKart (cash in hand)
///   • Delivery Fee  → Pocket Balance
///   • Tip           → Tip Balance
class _RecentOrdersCard extends StatefulWidget {
  const _RecentOrdersCard({required this.orders});

  final List<DeliveryOrder> orders;

  @override
  State<_RecentOrdersCard> createState() => _RecentOrdersCardState();
}

class _RecentOrdersCardState extends State<_RecentOrdersCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    // Only COD delivered orders matter for the breakdown
    final cod =
        widget.orders
            .where((o) => o.isDelivered && !o.isOnlinePaid && o.total > 0)
            .toList()
          ..sort((a, b) => b.sortTime.compareTo(a.sortTime));

    final displayed = _expanded ? cod : cod.take(5).toList();

    if (cod.isEmpty) return const SizedBox.shrink();

    return Container(
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Row(
              children: [
                const Expanded(
                  child: Text(
                    'COD Order Earnings Breakdown',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                      color: AppColors.textDark,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                // Legend dots
                _Dot(color: const Color(0xFF2E7D32), label: 'Fee'),
                const SizedBox(width: 8),
                _Dot(color: const Color(0xFF6A1B9A), label: 'Tip'),
                const SizedBox(width: 8),
                _Dot(color: const Color(0xFFE65100), label: 'TastyKart'),
              ],
            ),
          ),
          const Divider(height: 1),

          // Order rows
          ...displayed.map((o) => _OrderRow(order: o)),

          // Show more / less toggle
          if (cod.length > 5)
            InkWell(
              onTap: () => setState(() => _expanded = !_expanded),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      _expanded
                          ? 'Show less'
                          : 'Show ${cod.length - 5} more orders',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Icon(
                      _expanded
                          ? Icons.keyboard_arrow_up
                          : Icons.keyboard_arrow_down,
                      size: 16,
                      color: AppColors.primary,
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 7,
          height: 7,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 3),
        Text(
          label,
          style: const TextStyle(fontSize: 9, color: AppColors.textMedium),
        ),
      ],
    );
  }
}

class _OrderRow extends StatelessWidget {
  const _OrderRow({required this.order});

  final DeliveryOrder order;

  @override
  Widget build(BuildContext context) {
    // For wallet+COD orders, order.total is only the cash portion.
    // Full order value = total + walletUsed.
    // TastyKart's share = full value - deliveryFee - tip (partner's cut).
    final fullValue = order.total + order.walletUsed;
    final orderAmt = (fullValue - order.deliveryFee - order.tip).clamp(
      0,
      fullValue,
    );
    final fee = order.deliveryFee;
    final tip = order.tip;
    final total = fullValue; // use full value for bar proportions
    final isCod = !order.isOnlinePaid;
    final cashCollected = isCod ? order.total : 0; // cash portion only
    final walletPaid = order.walletUsed;

    // Friendly payment label
    String payLabel;
    if (isCod && walletPaid > 0) {
      payLabel = 'COD + Wallet';
    } else if (isCod) {
      payLabel = 'Cash on Delivery';
    } else {
      payLabel = 'Online';
    }

    // Bar widths as fractions
    final feeFraction = total > 0 ? fee / total : 0.0;
    final tipFraction = total > 0 ? tip / total : 0.0;
    final adminFraction = total > 0 ? orderAmt / total : 0.0;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Order ID + date + total
          Row(
            children: [
              Expanded(
                child: Text(
                  order.displayOrderNumber,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textDark,
                  ),
                ),
              ),
              if (order.deliveredAt != null)
                Text(
                  formatDayTime(order.deliveredAt!),
                  style: const TextStyle(
                    fontSize: 10,
                    color: AppColors.textMedium,
                  ),
                ),
              const SizedBox(width: 8),
              Text(
                rupee(total),
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textDark,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),

          // Stacked progress bar
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LayoutBuilder(
              builder: (context, constraints) {
                final w = constraints.maxWidth;
                return SizedBox(
                  height: 6,
                  child: Row(
                    children: [
                      if (feeFraction > 0)
                        Container(
                          width: w * feeFraction,
                          color: const Color(0xFF2E7D32),
                        ),
                      if (tipFraction > 0)
                        Container(
                          width: w * tipFraction,
                          color: const Color(0xFF6A1B9A),
                        ),
                      if (adminFraction > 0)
                        Expanded(
                          child: Container(color: const Color(0xFFE65100)),
                        ),
                    ],
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 6),

          // Amount chips + payment method + collected cash
          Wrap(
            spacing: 6,
            runSpacing: 4,
            children: [
              if (fee > 0)
                _AmtChip(
                  label: 'Your fee',
                  amount: rupee(fee),
                  color: const Color(0xFF2E7D32),
                  bg: const Color(0xFFE8F5E9),
                ),
              if (tip > 0)
                _AmtChip(
                  label: 'Tip',
                  amount: rupee(tip),
                  color: const Color(0xFF6A1B9A),
                  bg: const Color(0xFFF3E5F5),
                ),
              if (orderAmt > 0)
                _AmtChip(
                  label: 'Order amt',
                  amount: rupee(orderAmt),
                  color: const Color(0xFFE65100),
                  bg: const Color(0xFFFFF3E0),
                ),
              _AmtChip(
                label: payLabel,
                amount: '',
                color: isCod
                    ? const Color(0xFF1565C0)
                    : const Color(0xFF1565C0),
                bg: const Color(0xFFE3F2FD),
              ),
            ],
          ),
          if (isCod) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                const Icon(
                  Icons.payments_outlined,
                  size: 13,
                  color: AppColors.textMedium,
                ),
                const SizedBox(width: 4),
                Text(
                  cashCollected > 0
                      ? 'Collected cash: ${rupee(cashCollected)}'
                            '${walletPaid > 0 ? '  ·  Wallet: ${rupee(walletPaid)}' : ''}'
                      : walletPaid > 0
                      ? 'Wallet paid: ${rupee(walletPaid)}'
                      : 'Cash collected: ${rupee(fullValue)}',
                  style: const TextStyle(
                    fontSize: 10,
                    color: AppColors.textMedium,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 10),
          const Divider(height: 1),
        ],
      ),
    );
  }
}

class _AmtChip extends StatelessWidget {
  const _AmtChip({
    required this.label,
    required this.amount,
    required this.color,
    required this.bg,
  });

  final String label;
  final String amount;
  final Color color;
  final Color bg;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        '$label $amount',
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}

// ── Money Split summary card ──────────────────────────────────────────────────

/// Shows a compact 3-way split of the partner's money:
///   Pocket Balance | Tip Balance | Admin Amount (cash in hand)
class _MoneySplitCard extends StatelessWidget {
  const _MoneySplitCard({
    required this.pocket,
    required this.tips,
    required this.cashInHand,
  });

  final int pocket;
  final num tips;
  final int cashInHand;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          _SplitColumn(
            label: 'Pocket',
            value: rupee(pocket),
            valueColor: AppColors.primary,
          ),
          _VerticalDivider(),
          _SplitColumn(
            label: 'Tips',
            value: rupee(tips.round()),
            valueColor: const Color(0xFF6A1B9A),
          ),
          _VerticalDivider(),
          _SplitColumn(
            label: 'Admin Amt',
            value: rupee(cashInHand),
            valueColor: const Color(0xFFD32F2F),
          ),
        ],
      ),
    );
  }
}

class _SplitColumn extends StatelessWidget {
  const _SplitColumn({
    required this.label,
    required this.value,
    required this.valueColor,
  });

  final String label;
  final String value;
  final Color valueColor;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: valueColor,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(fontSize: 10, color: AppColors.textMedium),
          ),
        ],
      ),
    );
  }
}

class _VerticalDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1,
      height: 36,
      color: const Color(0xFFE0E0E0),
      margin: const EdgeInsets.symmetric(horizontal: 8),
    );
  }
}

// ── Cash-in-hand warning / deposit card ──────────────────────────────────────

/// Shows a warning card when the partner is holding more cash than allowed,
/// with a button to navigate to the deposit screen.
class _CashInHandCard extends StatelessWidget {
  const _CashInHandCard({
    required this.held,
    required this.limit,
    required this.due,
    required this.onPay,
  });

  final int held;
  final int limit;
  final int due;
  final VoidCallback onPay;

  @override
  Widget build(BuildContext context) {
    if (held <= 0) return const SizedBox.shrink();

    final exceeded = due > 0;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: exceeded ? const Color(0xFFFFF8E1) : const Color(0xFFF1F8E9),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: exceeded ? const Color(0xFFFFB300) : const Color(0xFF81C784),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                exceeded
                    ? Icons.warning_amber_rounded
                    : Icons.check_circle_outline,
                size: 18,
                color: exceeded
                    ? const Color(0xFFFF8F00)
                    : const Color(0xFF388E3C),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  exceeded
                      ? 'Cash limit exceeded — deposit required'
                      : 'Cash in hand within limit',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: exceeded
                        ? const Color(0xFFE65100)
                        : const Color(0xFF2E7D32),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Holding: ${rupee(held)}  ·  Limit: ${rupee(limit)}${exceeded ? '  ·  Due: ${rupee(due)}' : ''}',
            style: const TextStyle(fontSize: 12, color: AppColors.textMedium),
          ),
          if (exceeded) ...[
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: onPay,
                icon: const Icon(Icons.payments_outlined, size: 16),
                label: Text('Deposit ${rupee(due)}'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFFF8F00),
                  foregroundColor: AppColors.white,
                  elevation: 0,
                  minimumSize: const Size.fromHeight(40),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
