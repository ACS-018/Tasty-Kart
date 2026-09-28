import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../../constants/color_constants.dart';
import '../../models/delivery_order.dart';
import '../../models/delivery_partner.dart';
import '../../services/auth_service.dart';
import '../../services/delivery_partner_service.dart';
import '../../services/fcm_service.dart';
import '../../services/firestore_paths.dart';
import '../../services/order_service.dart';
import '../../utils/app_feedback.dart';
import '../../utils/app_navigation.dart';
import '../../utils/formatters.dart';
import '../Home/components/home_header.dart';
import 'components/profile_menu_tile.dart';
import 'edit_profile_screen.dart';
import 'help_support_screen.dart';
import 'trips_history_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key, required this.partner});

  final DeliveryPartner partner;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: AppColors.surface,
      child: StreamBuilder<List<DeliveryOrder>>(
        stream: OrderService.watchForPartner(partner.id),
        builder: (context, snapshot) {
          final orders = snapshot.data ?? const <DeliveryOrder>[];
          final today = OrderService.deliveredToday(orders);
          final completed = orders.where((o) => o.isDelivered).length;
          final orderCount = completed > partner.completedOrders
              ? completed
              : partner.completedOrders;
          final cancelled = orders.where((o) => o.isCancelled).length;
          final earnings = today.fold<int>(0, (total, o) => total + o.payout);
          final totalAttempts = completed + cancelled;
          final completion = totalAttempts == 0
              ? (partner.acceptRate > 0 ? partner.acceptRate.round() : 100)
              : ((completed / totalAttempts) * 100).round();

          return Column(
            children: [
              HomeHeader(partner: partner, compact: true),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.only(bottom: 24),
                  children: [
                    Container(
                      width: double.infinity,
                      color: AppColors.primary,
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                      child: Column(
                        children: [
                          Row(
                            children: [
                              _LargeAvatar(partner: partner),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      partner.name.isEmpty
                                          ? 'Partner'
                                          : partner.name,
                                      style: const TextStyle(
                                        color: AppColors.white,
                                        fontSize: 20,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                    const SizedBox(height: 3),

                                    if (partner.phone.isNotEmpty) ...[
                                      const SizedBox(height: 2),
                                      Row(
                                        children: [
                                          const Icon(
                                            Icons.phone_outlined,
                                            color: AppColors.white,
                                            size: 13,
                                          ),
                                          const SizedBox(width: 4),
                                          Text(
                                            partner.phone,
                                            style: const TextStyle(
                                              color: AppColors.white,
                                              fontSize: 12,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                    const SizedBox(height: 6),
                                    _RatingLine(partner: partner),
                                  ],
                                ),
                              ),
                              IconButton(
                                onPressed: () => AppNavigation.push(
                                  context,
                                  EditProfileScreen(partner: partner),
                                ),
                                icon: const Icon(
                                  Icons.edit_outlined,
                                  color: AppColors.white,
                                ),
                              ),
                            ],
                          ),

                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    ProfileMenuTile(
                      icon: Icons.route_outlined,
                      iconColor: const Color(0xFF2E7D32),
                      iconBg: const Color(0xFFE8F5E9),
                      title: 'Trips History',
                      subtitle: 'View All Your Trips',
                      onTap: () => AppNavigation.push(
                        context,
                        TripsHistoryScreen(partner: partner),
                      ),
                    ),
                    ProfileMenuTile(
                      icon: Icons.notifications_none,
                      iconColor: const Color(0xFFEF6C00),
                      iconBg: const Color(0xFFFFF3E0),
                      title: 'Notifications',
                      trailing: Switch.adaptive(
                        value: partner.notificationsEnabled,
                        onChanged: (value) {
                          AppFeedback.selection();
                          DeliveryPartnerService.setNotificationsEnabled(
                            partnerId: partner.id,
                            enabled: value,
                          );
                        },
                        activeTrackColor: AppColors.primary,
                      ),
                    ),
                    ProfileMenuTile(
                      icon: Icons.headset_mic_outlined,
                      iconColor: const Color(0xFFF9A825),
                      iconBg: const Color(0xFFFFF8E1),
                      title: 'Help & Support',
                      subtitle: 'Get Help & Support',
                      onTap: () => AppNavigation.push(
                        context,
                        HelpSupportScreen(partner: partner),
                      ),
                    ),
                    ProfileMenuTile(
                      icon: Icons.logout,
                      iconColor: AppColors.primary,
                      iconBg: const Color(0xFFFCE8E8),
                      title: 'Log out',
                      onTap: () async {
                        // Remove FCM token before signing out so no stale pushes.
                        await FCMService.removeTokenFromFirestore(partner.id);
                        await AuthService.logout();
                      },
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _RatingLine extends StatelessWidget {
  const _RatingLine({required this.partner});

  final DeliveryPartner partner;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection(FirestorePaths.reviews)
          .where('deliveryPartnerId', isEqualTo: partner.id)
          .snapshots(),
      builder: (context, snapshot) {
        final scores = <double>[];
        for (final doc in snapshot.data?.docs ?? const []) {
          final data = doc.data();
          final type = (data['type'] ?? '').toString().toLowerCase();
          if (type.isNotEmpty && type != 'delivery') continue;
          final role = (data['reviewerRole'] ?? '').toString();
          if (role == 'delivery_partner') continue;
          final rating = data['rating'];
          if (rating is num && rating > 0) scores.add(rating.toDouble());
        }
        final label = scores.isEmpty
            ? (partner.rating > 0 ? partner.rating.toStringAsFixed(1) : 'New')
            : (scores.reduce((a, b) => a + b) / scores.length).toStringAsFixed(
                1,
              );
        return Row(
          children: [
            const Icon(Icons.star, color: Color(0xFFFFC107), size: 16),
            const SizedBox(width: 4),
            Text(
              label,
              style: const TextStyle(
                color: AppColors.white,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        );
      },
    );
  }
}

class _TodayStatsCard extends StatefulWidget {
  const _TodayStatsCard({
    required this.partner,
    required this.orders,
    required this.earnings,
    required this.completion,
  });

  final DeliveryPartner partner;
  final int orders;
  final int earnings;
  final int completion;

  @override
  State<_TodayStatsCard> createState() => _TodayStatsCardState();
}

class _TodayStatsCardState extends State<_TodayStatsCard> {
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    if (widget.partner.isOnline) {
      DeliveryPartnerService.touchOnlineSession(widget.partner.id);
    }
    _tick = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  String _onlineLabel(int minutes) {
    if (minutes <= 0) return '0m';
    final hours = minutes ~/ 60;
    final rest = minutes % 60;
    if (hours == 0) return '${rest}m';
    if (rest == 0) return '${hours}h';
    return '${hours}h ${rest}m';
  }

  @override
  Widget build(BuildContext context) {
    final online = _onlineLabel(widget.partner.onlineMinutesNow());
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        color: const Color(0xFF8E2223),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Row(
            children: [
              _stat(Icons.shopping_bag_outlined, '${widget.orders}', 'Orders'),
              _divider(),
              _stat(Icons.currency_rupee, rupee(widget.earnings), 'Earnings'),
            ],
          ),

        ],
      ),
    );
  }

  Widget _divider() {
    return Container(
      width: 1,
      height: 36,
      color: Colors.white.withValues(alpha: 0.25),
    );
  }

  Widget _stat(IconData icon, String value, String label) {
    return Expanded(
      child: Column(
        children: [
          Icon(icon, color: AppColors.white, size: 18),
          const SizedBox(height: 6),
          Text(
            value,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppColors.white,
              fontWeight: FontWeight.w800,
              fontSize: 15,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.white, fontSize: 11),
          ),
        ],
      ),
    );
  }
}

class _LargeAvatar extends StatelessWidget {
  const _LargeAvatar({required this.partner});

  final DeliveryPartner partner;

  @override
  Widget build(BuildContext context) {
    final letter = partner.firstName.isEmpty
        ? 'P'
        : partner.firstName[0].toUpperCase();
    return CircleAvatar(
      radius: 36,
      backgroundColor: AppColors.white,
      backgroundImage: partner.avatar != null && partner.avatar!.isNotEmpty
          ? NetworkImage(partner.avatar!)
          : null,
      child: partner.avatar == null || partner.avatar!.isEmpty
          ? Text(
              letter,
              style: const TextStyle(
                color: AppColors.primary,
                fontSize: 26,
                fontWeight: FontWeight.w800,
              ),
            )
          : null,
    );
  }
}
