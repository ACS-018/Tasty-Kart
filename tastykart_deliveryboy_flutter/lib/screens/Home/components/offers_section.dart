import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../../../constants/color_constants.dart';
import '../../../models/app_banner.dart';
import '../../../models/delivery_partner.dart';
import '../../../services/firestore_paths.dart';
import '../../../utils/app_navigation.dart';
import '../../profile/offers_rewards_screen.dart';

class OffersSection extends StatelessWidget {
  const OffersSection({super.key, required this.partner});

  final DeliveryPartner partner;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          children: [
            const Expanded(
              child: Text(
                'All Offers',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textDark,
                ),
              ),
            ),
            TextButton(
              onPressed: () => AppNavigation.push(
                context,
                OffersRewardsScreen(partner: partner),
              ),
              child: const Text(
                'See All',
                style: TextStyle(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
        StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
          stream: FirebaseFirestore.instance
              .collection(FirestorePaths.banners)
              .snapshots(),
          builder: (context, snapshot) {
            final banners = (snapshot.data?.docs ?? [])
                .map(AppBanner.fromDoc)
                .where((b) => b.active)
                .toList()
              ..sort((a, b) => a.priority.compareTo(b.priority));
            if (banners.isEmpty) {
              return const SizedBox.shrink();
            }
            return SizedBox(
              height: 110,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: banners.length,
                separatorBuilder: (_, __) => const SizedBox(width: 10),
                itemBuilder: (context, index) {
                  final banner = banners[index];
                  return ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: banner.imageUrl.isEmpty
                        ? Container(
                            width: 200,
                            color: AppColors.primary,
                            alignment: Alignment.center,
                            child: Text(
                              banner.title,
                              style: const TextStyle(color: AppColors.white),
                            ),
                          )
                        : Image.network(
                            banner.imageUrl,
                            width: 200,
                            height: 110,
                            fit: BoxFit.cover,
                          ),
                  );
                },
              ),
            );
          },
        ),
      ],
    );
  }
}
