import 'package:flutter/material.dart';

import '../../constants/color_constants.dart';
import '../../constants/support_topics.dart';
import '../../global_widgets/app_button.dart';
import '../../models/delivery_partner.dart';
import '../../models/support_ticket.dart';
import '../../services/support_ticket_service.dart';
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

  Future<void> _next() async {
    final issue = _selected;
    if (issue == null) {
      AppFeedback.showError(context, 'Select an issue to continue');
      return;
    }
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final ticketId = await SupportTicketService.createTicket(
        partnerId: widget.partner.id,
        partnerName: widget.partner.name,
        partnerPhone: widget.partner.phone,
        category: widget.category.title,
        subject: issue,
        firstMessage: '${widget.category.title}: $issue',
      );
      if (!mounted) return;
      // Replace this screen with the ticket chat screen.
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => SupportTicketChatScreen(
            ticket: SupportTicket(
              id: ticketId,
              partnerId: widget.partner.id,
              partnerName: widget.partner.name,
              partnerPhone: widget.partner.phone,
              category: widget.category.title,
              subject: issue,
            ),
            partnerId: widget.partner.id,
          ),
        ),
      );
    } catch (_) {
      if (mounted) {
        AppFeedback.showError(context, 'Could not submit this request');
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
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              itemCount: widget.category.issues.length,
              itemBuilder: (context, index) {
                final issue = widget.category.issues[index];
                return AppRadioOption(
                  label: issue,
                  selected: _selected == issue,
                  onTap: () {
                    AppFeedback.selection();
                    setState(() => _selected = issue);
                  },
                );
              },
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
