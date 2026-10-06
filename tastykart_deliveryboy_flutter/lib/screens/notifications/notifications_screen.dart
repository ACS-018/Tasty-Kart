import 'package:flutter/material.dart';

import '../../constants/color_constants.dart';
import '../../models/app_notification.dart';
import '../../models/delivery_order.dart';
import '../../services/notification_service.dart';
import '../../services/order_service.dart';
import '../../utils/formatters.dart';
import '../../widgets/async_state_message.dart';
import '../../widgets/page_header.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({
    super.key,
    required this.partnerId,
    this.notificationsEnabled = true,
    this.registeredAt,
  });

  final String partnerId;

  /// Whether this partner has opted into push notifications.
  /// Broadcast notifications are hidden when this is false.
  final bool notificationsEnabled;

  /// When this partner registered. Broadcast notifications created before
  /// this date are hidden so new partners don't see old global messages.
  final DateTime? registeredAt;

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    // Mark all notifications as read when screen opens
    WidgetsBinding.instance.addPostFrameCallback((_) {
      NotificationService.markAllAsRead(widget.partnerId);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: Column(
        children: [
          const PageHeader(title: 'Notifications'),
          Expanded(
            child: StreamBuilder<List<AppNotification>>(
              stream: NotificationService.watchInbox(
                registeredAt: widget.registeredAt,
              ),
              builder: (context, inboxSnap) {
                return StreamBuilder<List<DeliveryOrder>>(
                  stream: OrderService.watchForPartner(widget.partnerId),
                  builder: (context, orderSnap) {
                    final waiting =
                        inboxSnap.connectionState == ConnectionState.waiting &&
                        orderSnap.connectionState == ConnectionState.waiting &&
                        inboxSnap.data == null &&
                        orderSnap.data == null;
                    if (waiting) {
                      return const AsyncStateMessage.loading();
                    }

                    final notes = NotificationService.visibleForPartner(
                      partnerId: widget.partnerId,
                      inbox: inboxSnap.data ?? const [],
                      orders: orderSnap.data ?? const [],
                      notificationsEnabled: widget.notificationsEnabled,
                      registeredAt: widget.registeredAt,
                    );

                    if (notes.isEmpty) {
                      return const AsyncStateMessage(
                        icon: Icons.notifications_none,
                        message: 'No notifications yet.',
                      );
                    }

                    return ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                      itemCount: notes.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, index) {
                        return _NotificationCard(note: notes[index]);
                      },
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

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({required this.note});

  final AppNotification note;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 3),
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
                Text(
                  note.title,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textDark,
                  ),
                ),
                if (note.message.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    note.message,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textMedium,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            formatTimeAgo(note.createdAt),
            style: const TextStyle(fontSize: 11, color: Color(0xFF9E9E9E)),
          ),
        ],
      ),
    );
  }
}
