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

class TipDeductionScreen extends StatefulWidget {
  const TipDeductionScreen({super.key, required this.partner});

  final DeliveryPartner partner;

  @override
  State<TipDeductionScreen> createState() => _TipDeductionScreenState();
}

class _TipDeductionScreenState extends State<TipDeductionScreen> {
  PeriodFilter _filter = PeriodFilter.today;
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
          const PageHeader(title: 'Tip Deduction Statement'),
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
                          t.isTipDeduction &&
                          matchesPeriod(t.createdAt, _filter, _custom),
                    )
                    .toList();
                if (snapshot.connectionState == ConnectionState.waiting &&
                    items.isEmpty) {
                  return const AsyncStateMessage.loading();
                }
                if (items.isEmpty) {
                  return const AsyncStateMessage(
                    icon: Icons.percent,
                    message: 'No tip deductions in this period.',
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final tx = items[index];
                    final order = tx.orderNumber.isEmpty
                        ? tx.title
                        : 'Tip On Order ${tx.orderNumber.startsWith('#') ? tx.orderNumber : '#${tx.orderNumber}'}';
                    return Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.divider),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  order.isEmpty ? 'Tip On Order' : order,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textDark,
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
                          Text(
                            rupee(tx.amount),
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              color: AppColors.success,
                            ),
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
