import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../constants/color_constants.dart';
import '../../models/delivery_order.dart';
import '../../models/delivery_partner.dart';
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
    final isOver = due > 0;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isOver ? const Color(0xFFFFF3E0) : AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: isOver
            ? Border.all(color: const Color(0xFFFFB300).withValues(alpha: 0.5))
            : null,
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
                  color: isOver
                      ? const Color(0xFFFFB300).withValues(alpha: 0.15)
                      : const Color(0xFFE3F2FD),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  isOver ? Icons.warning_amber_rounded : Icons.payments_outlined,
                  size: 18,
                  color: isOver ? const Color(0xFFE65100) : const Color(0xFF1565C0),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'COD Cash in Hand',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                        color: AppColors.textDark,
                      ),
                    ),
                    const Text(
                      'Cash collected from customers — must be submitted to TastyKart',
                      style: TextStyle(
                        fontSize: 11,
                        color: AppColors.textMedium,
                        height: 1.3,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // ── Amounts row ────────────────────────────────────────────
          Row(
            children: [
              Expanded(
                child: _AmountBox(
                  label: 'Holding',
                  amount: rupee(held),
                  labelColor: AppColors.textMedium,
                  amountColor: AppColors.textDark,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _AmountBox(
                  label: 'Allowed Limit',
                  amount: rupee(limit),
                  labelColor: AppColors.textMedium,
                  amountColor: const Color(0xFF1565C0),
                ),
              ),
              if (isOver) ...[
                const SizedBox(width: 8),
                Expanded(
                  child: _AmountBox(
                    label: 'Submit to TastyKart',
                    amount: rupee(due),
                    labelColor: const Color(0xFFE65100),
                    amountColor: const Color(0xFFE65100),
                    highlight: true,
                  ),
                ),
              ],
            ],
          ),
          if (isOver) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF8E1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info_outline, size: 14, color: Color(0xFFE65100)),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'You are holding ${rupee(due)} more than the limit. '
                      'Submit this amount to go back online.',
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFFBF360C),
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: onPay,
                icon: const Icon(Icons.upload_rounded, size: 18),
                label: Text('Submit ${rupee(due)} to TastyKart'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFE65100),
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
        ],
      ),
    );
  }
}

class _AmountBox extends StatelessWidget {
  const _AmountBox({
    required this.label,
    required this.amount,
    required this.labelColor,
    required this.amountColor,
    this.highlight = false,
  });
  final String label;
  final String amount;
  final Color labelColor;
  final Color amountColor;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: highlight
            ? const Color(0xFFFFEBEE)
            : const Color(0xFFF5F5F5),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: labelColor,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            amount,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              color: amountColor,
            ),
          ),
        ],
      ),
    );
  }
}

class EarningsTab extends StatelessWidget {
  const EarningsTab({super.key, required this.partner});

  final DeliveryPartner partner;

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

                    final today = OrderService.deliveredToday(orders);
                    final todayTrips = today.length;
                    final todayEarnings = today.fold<int>(
                      0,
                      (s, o) => s + o.payout,
                    );

                    // Incentive is weekly-based: count this week's trips
                    final weekTrips = OrderService.deliveredThisWeek(
                      orders,
                    ).length;
                    final incentiveEarned = dp.incentiveFor(weekTrips);

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
                          'Your delivery earnings credited to your Pocket Balance',
                          style: TextStyle(
                            fontSize: 11,
                            color: AppColors.textMedium,
                          ),
                        ),
                        const SizedBox(height: 16),

                        // ── Today's stats ────────────────────────────
                        Container(
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
                                'Today',
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                  color: AppColors.textMedium,
                                ),
                              ),
                              const SizedBox(height: 10),
                              Row(
                                children: [
                                  _StatChip(
                                    label: 'Trips',
                                    value: '$todayTrips',
                                    icon: Icons.delivery_dining,
                                    highlight: todayTrips > 0,
                                  ),
                                  const SizedBox(width: 8),
                                  _StatChip(
                                    label: 'Earned',
                                    value: rupee(todayEarnings),
                                    icon: Icons.currency_rupee,
                                    highlight: todayEarnings > 0,
                                  ),
                                  const SizedBox(width: 8),
                                  _StatChip(
                                    label: 'Incentive',
                                    value: incentiveEarned > 0
                                        ? rupee(incentiveEarned)
                                        : '—',
                                    icon: Icons.star_rounded,
                                    highlight: incentiveEarned > 0,
                                  ),
                                ],
                              ),
                              if (incentiveEarned > 0) ...[
                                const SizedBox(height: 10),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 6,
                                  ),
                                  decoration: BoxDecoration(
                                    color: AppColors.primary.withValues(
                                      alpha: 0.08,
                                    ),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(
                                        Icons.emoji_events,
                                        color: Color(0xFFFFC107),
                                        size: 16,
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        'Weekly incentive: ${rupee(incentiveEarned)}',
                                        style: const TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.primary,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ] else if (dp.incentiveSlots.isNotEmpty) ...[
                                const SizedBox(height: 10),
                                Text(
                                  _nextTierLabel(weekTrips, dp.incentiveSlots),
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.textMedium,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
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
                                      color: AppColors.primary.withValues(alpha: 0.12),
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
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'Your Pocket Balance',
                                          style: TextStyle(
                                            fontWeight: FontWeight.w700,
                                            fontSize: 14,
                                            color: AppColors.textDark,
                                          ),
                                        ),
                                        Text(
                                          'YOUR money - withdraw anytime via UPI',
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
                                  onPressed: partner.displayPocket > 0
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
                          limit: partner.effectiveCashLimit(dp.cashLimitDefault),
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
                                  color: const Color(0xFFCE93D8).withValues(alpha: 0.3),
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
                                      'Tips from customers - YOUR money',
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
        .fold<int>(0, (sum, o) => sum + o.payout);
  }

  String _nextTierLabel(int trips, List<IncentiveSlot> slots) {
    for (final slot in slots) {
      if (trips < slot.trips) {
        final diff = slot.trips - trips;
        return '$diff more trip${diff == 1 ? '' : 's'} to earn ${rupee(slot.amount)} bonus';
      }
    }
    return '';
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
  String? _error;

  int get _pocket => widget.partner.displayPocket;

  /// The most that can be requested: pocket balance, capped by the admin maximum.
  int get _allowedMax {
    final cap = widget.maxAmount;
    if (cap > 0 && cap < _pocket) return cap;
    return _pocket;
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
    if (raw > _pocket) {
      setState(() => _error = 'Amount exceeds pocket balance ₹$_pocket');
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
        delta: -raw,
      );
      try {
        await TransactionService.requestWithdrawal(
          partnerId: widget.partner.id,
          partnerName: widget.partner.name,
          amount: raw,
          upiId: _upiId,
          phone: widget.partner.phone,
        );
      } catch (e) {
        await DeliveryPartnerService.adjustWallet(
          partnerId: widget.partner.id,
          delta: raw,
        );
        rethrow;
      }
      if (mounted) {
        Navigator.pop(context);
        AppFeedback.showSuccess(
          context,
          'Withdrawal of ₹$raw submitted. Status: Pending',
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
            'Available balance: ${rupee(_pocket)}',
            style: const TextStyle(fontSize: 13, color: AppColors.textMedium),
          ),
          const SizedBox(height: 20),

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
            color: highlight
                ? AppColors.primary
                : const Color(0xFFE6E6E6),
            width: highlight ? 1.5 : 1,
          ),
        ),
        child: Column(
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
            ),
            Text(
              label,
              style: const TextStyle(fontSize: 10, color: AppColors.textMedium),
            ),
          ],
        ),
      ),
    );
  }
}
