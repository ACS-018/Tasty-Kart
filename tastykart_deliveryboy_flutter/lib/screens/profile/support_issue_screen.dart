import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../../constants/color_constants.dart';
import '../../constants/support_topics.dart';
import '../../global_widgets/app_button.dart';
import '../../models/delivery_partner.dart';
import '../../models/support_ticket.dart';
import '../../services/support_ticket_service.dart';
import 'order_picker_sheet.dart';
import 'support_ticket_chat_screen.dart';
import '../../utils/app_feedback.dart';
import '../../widgets/app_radio_option.dart';
import '../../widgets/page_header.dart';

class SupportIssueScreen extends StatefulWidget {
  const SupportIssueScreen({
    super.key,
    required this.partner,
    required this.category,
  });

  final DeliveryPartner partner;
  final SupportCategory category;

  @override
  State<SupportIssueScreen> createState() => _SupportIssueScreenState();
}

class _SupportIssueScreenState extends State<SupportIssueScreen> {
  String? _selected;
  bool _busy = false;

  /// Selected order — required when category is 'orders'.
  PickableOrder? _pickedOrder;

  bool get _isOrderCategory => widget.category.id.toLowerCase() == 'orders';

  Future<void> _pickOrder() async {
    final picked = await OrderPickerSheet.show(
      context,
      partnerId: widget.partner.id,
    );
    if (picked != null) {
      setState(() => _pickedOrder = picked);
    }
  }

  Future<void> _next() async {
    final issue = _selected;
    if (issue == null) {
      AppFeedback.showError(context, 'Select an issue to continue');
      return;
    }

    // For order-related tickets, an order must be selected.
    if (_isOrderCategory && _pickedOrder == null) {
      AppFeedback.showError(
        context,
        'Please select the order this issue is about',
      );
      return;
    }

    if (_busy) return;
    setState(() => _busy = true);

    final order = _pickedOrder;
    final orderNum = order?.orderNumber ?? '';
    // Build a descriptive first message
    final firstMsg = order != null
        ? '${widget.category.title}: $issue\nOrder: ${orderNum.startsWith('#') ? orderNum : '#$orderNum'} — ${order.restaurantName}'
        : '${widget.category.title}: $issue';

    try {
      final authUid = FirebaseAuth.instance.currentUser?.uid ?? widget.partner.id;
      final ticketId = await SupportTicketService.createTicket(
        partnerId: authUid,
        partnerName: widget.partner.name,
        partnerPhone: widget.partner.phone,
        category: widget.category.title,
        subject: issue,
        firstMessage: firstMsg,
        // Order linking
        orderId: order?.id,
        orderNumber: order?.orderNumber,
        orderRestaurantName: order?.restaurantName,
        orderStatus: order?.status,
        orderTotal: order?.total,
      );
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => SupportTicketChatScreen(
            ticket: SupportTicket(
              id: ticketId,
              partnerId: authUid,
              partnerName: widget.partner.name,
              partnerPhone: widget.partner.phone,
              category: widget.category.title,
              subject: issue,
              orderId: order?.id,
              orderNumber: order?.orderNumber,
              orderRestaurantName: order?.restaurantName,
              orderStatus: order?.status,
              orderTotal: order?.total,
            ),
            partnerId: authUid,
          ),
        ),
      );
    } catch (e) {
      if (mounted) {
        final msg = e is StateError
            ? e.message
            : 'Could not submit this request. Check your connection and try again.';
        AppFeedback.showError(context, msg);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Scaffold(
      backgroundColor: AppColors.white,
      body: Column(
        children: [
          PageHeader(title: widget.category.title, branded: true),

          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
              children: [
                // ── Order picker (only for Orders category) ──────────────
                if (_isOrderCategory) ...[
                  _pickedOrder == null
                      ? _OrderPickerPrompt(onTap: _pickOrder)
                      : _SelectedOrderCard(
                          order: _pickedOrder!,
                          onChange: _pickOrder,
                        ),
                  const SizedBox(height: 20),
                  const Text(
                    'What\'s the issue?',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textMedium,
                    ),
                  ),
                  const SizedBox(height: 8),
                ],

                // ── Issue radio list ──────────────────────────────────────
                ...List.generate(widget.category.issues.length, (index) {
                  final issue = widget.category.issues[index];
                  return AppRadioOption(
                    label: issue,
                    selected: _selected == issue,
                    onTap: () {
                      AppFeedback.selection();
                      setState(() => _selected = issue);
                    },
                  );
                }),
              ],
            ),
          ),

          Padding(
            padding: EdgeInsets.fromLTRB(16, 8, 16, 16 + bottom),
            child: AppButton(
              label: 'Submit',
              isLoading: _busy,
              onPressed: _next,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Prompt card shown before an order is selected ────────────────────────────

class _OrderPickerPrompt extends StatelessWidget {
  const _OrderPickerPrompt({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFFFCE8E8),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
        ),
        child: const Row(
          children: [
            Icon(
              Icons.receipt_long_rounded,
              color: AppColors.primary,
              size: 20,
            ),
            SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Select Order *',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: AppColors.primary,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Tap to choose the order this issue is about',
                    style: TextStyle(fontSize: 12, color: AppColors.textMedium),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: AppColors.primary),
          ],
        ),
      ),
    );
  }
}

// ── Card shown after an order is selected ─────────────────────────────────────

class _SelectedOrderCard extends StatelessWidget {
  const _SelectedOrderCard({required this.order, required this.onChange});
  final PickableOrder order;
  final VoidCallback onChange;

  @override
  Widget build(BuildContext context) {
    final num = order.orderNumber.startsWith('#')
        ? order.orderNumber
        : '#${order.orderNumber}';
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.5)),
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
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: const Color(0xFFFCE8E8),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.receipt_long_rounded,
              color: AppColors.primary,
              size: 18,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  num,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textDark,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  order.restaurantName,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textMedium,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: onChange,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFFCE8E8),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text(
                'Change',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primary,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
