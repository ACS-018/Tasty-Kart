import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../constants/color_constants.dart';
import '../../models/delivery_partner.dart';
import '../../models/partner_transaction.dart';
import '../../services/transaction_service.dart';
import '../../utils/formatters.dart';
import '../../widgets/async_state_message.dart';
import '../../widgets/page_header.dart';

class WalletStatementScreen extends StatelessWidget {
  const WalletStatementScreen({
    super.key,
    required this.partner,
    required this.title,
    this.kinds,
  });

  final DeliveryPartner partner;
  final String title;
  final List<String>? kinds;

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
          PageHeader(title: title),
          Expanded(
            child: StreamBuilder<List<PartnerTransaction>>(
              stream: TransactionService.watchForPartner(partner.id),
              builder: (context, snapshot) {
                var items = snapshot.data ?? const <PartnerTransaction>[];
                if (kinds != null) {
                  items = items
                      .where((t) => kinds!.contains(t.type))
                      .toList();
                }
                if (snapshot.connectionState == ConnectionState.waiting &&
                    items.isEmpty) {
                  return const AsyncStateMessage.loading();
                }
                if (items.isEmpty) {
                  return AsyncStateMessage(
                    icon: Icons.receipt_long_outlined,
                    message: 'No entries in $title yet.',
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, index) => _row(items[index]),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _row(PartnerTransaction tx) {
    final credit = tx.isCredit;
    final icon = credit
        ? (tx.type == 'bonus' ? Icons.add : Icons.arrow_downward)
        : Icons.arrow_upward;
    final bg = credit
        ? (tx.type == 'bonus'
            ? const Color(0xFFF3E5F5)
            : const Color(0xFFE8F5E9))
        : const Color(0xFFFFEBEE);
    final fg = credit
        ? (tx.type == 'bonus' ? const Color(0xFF7B1FA2) : AppColors.success)
        : AppColors.error;
    final subtitle = tx.title.isNotEmpty
        ? tx.title
        : (tx.orderNumber.isNotEmpty
            ? 'From Order ${tx.orderNumber}'
            : tx.method);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(14),
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
                  credit
                      ? (tx.type == 'bonus' ? 'Bonus' : 'Deposite')
                      : 'Withdrawal',
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    color: AppColors.textDark,
                  ),
                ),
                Text(
                  subtitle,
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
                credit ? rupeeSigned(tx.amount) : rupeeSigned(-tx.amount),
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  color: credit ? AppColors.success : AppColors.error,
                ),
              ),
              Text(
                tx.status.isEmpty ? 'Completed' : tx.status,
                style: const TextStyle(
                  color: AppColors.success,
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
