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

class DeductionStatementScreen extends StatefulWidget {
  const DeductionStatementScreen({super.key, required this.partner});

  final DeliveryPartner partner;

  @override
  State<DeductionStatementScreen> createState() =>
      _DeductionStatementScreenState();
}

class _DeductionStatementScreenState extends State<DeductionStatementScreen> {
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
          const PageHeader(title: 'Deduction Statement'),
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
                          t.isDeduction &&
                          matchesPeriod(t.createdAt, _filter, _custom),
                    )
                    .toList();
                if (snapshot.connectionState == ConnectionState.waiting &&
                    items.isEmpty) {
                  return const AsyncStateMessage.loading();
                }
                if (items.isEmpty) {
                  return const AsyncStateMessage(
                    icon: Icons.description_outlined,
                    message: 'No deductions in this period.',
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, index) => _card(items[index]),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _card(PartnerTransaction tx) {
    final late = tx.type == 'late_delivery';
    final failed = tx.isFailed;
    final icon = late
        ? Icons.schedule
        : (failed ? Icons.close : Icons.percent);
    final bg = late
        ? const Color(0xFFFFF3E0)
        : (failed ? const Color(0xFFFFEBEE) : const Color(0xFFF3E5F5));
    final fg = late
        ? const Color(0xFFEF6C00)
        : (failed ? AppColors.error : const Color(0xFF7B1FA2));
    final title = late
        ? 'Late Delivery'
        : (tx.title.isNotEmpty ? tx.title : 'PayOut To Bank');
    final detail = late
        ? (tx.orderNumber.isEmpty
            ? ''
            : 'Order ID : ${tx.orderNumber.startsWith('#') ? tx.orderNumber : '#${tx.orderNumber}'}')
        : (tx.utr.isEmpty ? '' : 'UTR : ${tx.utr}');

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.divider),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
            child: Icon(icon, color: fg, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    color: AppColors.textDark,
                  ),
                ),
                if (detail.isNotEmpty)
                  Text(
                    detail,
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
  }
}
