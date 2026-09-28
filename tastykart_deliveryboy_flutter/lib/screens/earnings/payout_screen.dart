import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../constants/color_constants.dart';
import '../../models/delivery_partner.dart';
import '../../models/partner_transaction.dart';
import '../../services/transaction_service.dart';
import '../../utils/formatters.dart';
import '../../widgets/async_state_message.dart';
import '../../widgets/page_header.dart';
import '../../widgets/period_filter_bar.dart';

String _statusLabel(String status) {
  switch (status.toLowerCase()) {
    case 'pending':
      return 'Pending';
    case 'approved':
      return 'Approved';
    case 'rejected':
    case 'failed':
      return 'Rejected';
    case 'completed':
    case '':
      return 'Completed';
    default:
      return status;
  }
}

Color _statusColor(String status) {
  switch (status.toLowerCase()) {
    case 'pending':
      return const Color(0xFFF59E0B);
    case 'rejected':
    case 'failed':
      return AppColors.error;
    default:
      return AppColors.success;
  }
}

class PayoutScreen extends StatefulWidget {
  const PayoutScreen({super.key, required this.partner});

  final DeliveryPartner partner;

  @override
  State<PayoutScreen> createState() => _PayoutScreenState();
}

class _PayoutScreenState extends State<PayoutScreen> {
  PeriodFilter _filter = PeriodFilter.week;
  DateTime? _custom;

  Future<void> _pickDate() async {
    final picked = await pickPeriodDate(context, initial: _custom);
    if (picked == null) return;
    setState(() {
      _custom = picked;
      _filter = PeriodFilter.date;
    });
  }

  @override
  Widget build(BuildContext context) {
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
      ),
    );

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: Column(
        children: [
          const PageHeader(title: 'PayOut'),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFFCE8E8),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Available For Withdraw ${rupee(widget.partner.displayPocket)}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 16,
                      color: AppColors.textDark,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Last Updated  ${formatDayTime(DateTime.now())}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textMedium,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          PeriodFilterBar(
            selected: _filter,
            onSelected: (value) => setState(() => _filter = value),
            onPickDate: _pickDate,
          ),
          Expanded(
            child: StreamBuilder<List<PartnerTransaction>>(
              stream: TransactionService.watchForPartner(widget.partner.id),
              builder: (context, snapshot) {
                final items = (snapshot.data ?? const [])
                    .where(
                      (t) =>
                          t.isPayout &&
                          matchesPeriod(t.createdAt, _filter, _custom),
                    )
                    .toList();
                if (snapshot.connectionState == ConnectionState.waiting &&
                    items.isEmpty) {
                  return const AsyncStateMessage.loading();
                }
                if (items.isEmpty) {
                  return const AsyncStateMessage(
                    icon: Icons.account_balance_outlined,
                    message: 'No payouts in this period.',
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final tx = items[index];
                    return Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.white,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  tx.title.trim().isEmpty
                                      ? 'Withdrawal'
                                      : tx.title,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textDark,
                                  ),
                                ),
                                if (tx.utr.isNotEmpty)
                                  Text(
                                    tx.utr,
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: AppColors.textMedium,
                                    ),
                                  ),
                                if (tx.createdAt != null)
                                  Text(
                                    formatDayTime(tx.createdAt!),
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: AppColors.textMedium,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                rupee(tx.amount),
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.textDark,
                                ),
                              ),
                              Text(
                                _statusLabel(tx.status),
                                style: TextStyle(
                                  color: _statusColor(tx.status),
                                  fontWeight: FontWeight.w600,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
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
}
