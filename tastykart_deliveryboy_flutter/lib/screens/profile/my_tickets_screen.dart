import 'package:flutter/material.dart';

import '../../constants/color_constants.dart';
import '../../models/support_ticket.dart';
import '../../services/support_ticket_service.dart';
import '../../utils/app_navigation.dart';
import '../../widgets/page_header.dart';
import 'support_ticket_chat_screen.dart';

class MyTicketsScreen extends StatelessWidget {
  const MyTicketsScreen({super.key, required this.partnerId});

  final String partnerId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: Column(
        children: [
          const PageHeader(title: 'My Tickets', branded: true),
          Expanded(
            child: StreamBuilder<List<SupportTicket>>(
              stream: SupportTicketService.watchForPartner(partnerId),
              builder: (context, snap) {
                if (snap.connectionState == ConnectionState.waiting &&
                    !snap.hasData) {
                  return const Center(child: CircularProgressIndicator());
                }
                final tickets = snap.data ?? const [];
                if (tickets.isEmpty) {
                  return const Center(
                    child: Padding(
                      padding: EdgeInsets.all(32),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.support_agent_outlined,
                            size: 48,
                            color: AppColors.textLight,
                          ),
                          SizedBox(height: 12),
                          Text(
                            'No tickets yet',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: AppColors.textMedium,
                            ),
                          ),
                          SizedBox(height: 4),
                          Text(
                            'Submit a request from Help & Support',
                            style: TextStyle(
                              fontSize: 12,
                              color: AppColors.textLight,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                  itemCount: tickets.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, i) => _TicketCard(
                    ticket: tickets[i],
                    partnerId: partnerId,
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _TicketCard extends StatelessWidget {
  const _TicketCard({required this.ticket, required this.partnerId});

  final SupportTicket ticket;
  final String partnerId;

  Color get _statusColor {
    switch (ticket.status) {
      case TicketStatus.open:       return const Color(0xFF1565C0);
      case TicketStatus.inProgress: return const Color(0xFFE65100);
      case TicketStatus.closed:     return const Color(0xFF2E7D32);
    }
  }

  String get _statusLabel {
    switch (ticket.status) {
      case TicketStatus.open:       return 'Open';
      case TicketStatus.inProgress: return 'In Progress';
      case TicketStatus.closed:     return 'Closed';
    }
  }

  String _formatDate(DateTime? dt) {
    if (dt == null) return '';
    const months = [
      '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${months[dt.month]} ${dt.day}, ${dt.year}';
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => AppNavigation.push(
        context,
        SupportTicketChatScreen(ticket: ticket, partnerId: partnerId),
      ),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.white,
          borderRadius: BorderRadius.circular(14),
          border: ticket.unreadByPartner
              ? Border.all(color: AppColors.primary.withValues(alpha: 0.4))
              : null,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: _statusColor.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          _statusLabel,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: _statusColor,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        ticket.category,
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppColors.textMedium,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    ticket.subject,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textDark,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _formatDate(ticket.createdAt),
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.textLight,
                    ),
                  ),
                ],
              ),
            ),
            if (ticket.unreadByPartner)
              Container(
                width: 8,
                height: 8,
                margin: const EdgeInsets.only(top: 4),
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
              ),
            const Icon(
              Icons.chevron_right_rounded,
              color: AppColors.textLight,
            ),
          ],
        ),
      ),
    );
  }
}
