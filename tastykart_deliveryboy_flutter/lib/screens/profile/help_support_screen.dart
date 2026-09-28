import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../constants/color_constants.dart';
import '../../constants/support_topics.dart';
import '../../models/delivery_partner.dart';
import '../../models/support_ticket.dart';
import '../../services/settings_service.dart';
import '../../services/support_ticket_service.dart';
import '../../utils/app_navigation.dart';
import '../../widgets/page_header.dart';
import 'my_tickets_screen.dart';
import 'support_issue_screen.dart';

class HelpSupportScreen extends StatelessWidget {
  const HelpSupportScreen({super.key, required this.partner});

  final DeliveryPartner partner;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: Column(
        children: [
          const PageHeader(title: 'Help & Support', branded: true),
          Expanded(
            child: FutureBuilder<PlatformSettings>(
              future: SettingsService.getSettings(),
              builder: (context, snap) {
                final phone = snap.data?.supportPhone ?? '';
                final email = snap.data?.supportEmail ?? '';

                return ListView(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                  children: [
                    // ── Contact card (from admin settings) ──────────────
                    if (phone.isNotEmpty || email.isNotEmpty) ...[
                      _ContactCard(phone: phone, email: email),
                      const SizedBox(height: 20),
                    ],

                    // ── My tickets shortcut ──────────────────────────────
                    _MyTicketsButton(partnerId: partner.id),
                    const SizedBox(height: 20),
                    const Padding(
                      padding: EdgeInsets.only(bottom: 10),
                      child: Text(
                        'Need help with an order or payment?',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textDark,
                        ),
                      ),
                    ),

                    // ── Topic categories ────────────────────────────────
                    ...List.generate(SupportTopics.categories.length, (i) {
                      final category = SupportTopics.categories[i];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _CategoryCard(
                          category: category,
                          onTap: () => AppNavigation.push(
                            context,
                            SupportIssueScreen(
                              partner: partner,
                              category: category,
                            ),
                          ),
                        ),
                      );
                    }),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ── Admin-configured contact card ────────────────────────────────────────────

class _ContactCard extends StatelessWidget {
  const _ContactCard({required this.phone, required this.email});

  final String phone;
  final String email;

  Future<void> _launch(String uri) async {
    final u = Uri.parse(uri);
    if (await canLaunchUrl(u)) await launchUrl(u);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: const Color(0xFFFCE8E8),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.headset_mic_outlined,
                  color: AppColors.primary,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Contact Support',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textDark,
                      ),
                    ),
                    Text(
                      'We\'re here to help you',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.textMedium,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (phone.isNotEmpty) ...[
            _ContactRow(
              icon: Icons.phone_outlined,
              label: phone,
              onTap: () => _launch('tel:$phone'),
              actionLabel: 'Call',
            ),
            const SizedBox(height: 10),
          ],
          if (email.isNotEmpty)
            _ContactRow(
              icon: Icons.email_outlined,
              label: email,
              onTap: () => _launch('mailto:$email'),
              actionLabel: 'Email',
            ),
        ],
      ),
    );
  }
}

class _ContactRow extends StatelessWidget {
  const _ContactRow({
    required this.icon,
    required this.label,
    required this.onTap,
    required this.actionLabel,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final String actionLabel;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 18, color: AppColors.textMedium),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.textDark,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        GestureDetector(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.primary,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              actionLabel,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: AppColors.white,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ── Topic category card (unchanged layout) ────────────────────────────────────

class _CategoryCard extends StatelessWidget {
  const _CategoryCard({required this.category, required this.onTap});

  final SupportCategory category;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: category.iconBg,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    category.icon,
                    color: category.iconColor,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        category.title,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textDark,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        category.subtitle,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textMedium,
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(
                  Icons.chevron_right_rounded,
                  color: AppColors.textLight,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _MyTicketsButton extends StatelessWidget {
  const _MyTicketsButton({required this.partnerId});
  final String partnerId;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () =>
          AppNavigation.push(context, MyTicketsScreen(partnerId: partnerId)),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: const Color(0xFFE3F2FD),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.confirmation_number_outlined,
                color: Color(0xFF1565C0),
                size: 22,
              ),
            ),
            const SizedBox(width: 14),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'My Tickets',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textDark,
                    ),
                  ),
                  Text(
                    'View your support requests',
                    style: TextStyle(fontSize: 12, color: AppColors.textMedium),
                  ),
                ],
              ),
            ),
            StreamBuilder<List<SupportTicket>>(
              stream: SupportTicketService.watchForPartner(partnerId),
              builder: (context, snap) {
                final unread =
                    (snap.data ?? const []).where((t) => t.unreadByPartner).length;
                if (unread == 0) return const SizedBox.shrink();
                return Container(
                  margin: const EdgeInsets.only(right: 6),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '$unread new',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppColors.white,
                    ),
                  ),
                );
              },
            ),
            const Icon(Icons.chevron_right_rounded, color: AppColors.textLight),
          ],
        ),
      ),
    );
  }
}
