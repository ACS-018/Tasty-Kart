import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../constants/color_constants.dart';
import '../../constants/shift_slots.dart';
import '../../models/delivery_partner.dart';
import '../../services/delivery_partner_service.dart';
import '../../services/slot_service.dart';
import '../../utils/app_feedback.dart';
import '../../widgets/date_chip_strip.dart';
import '../../widgets/page_header.dart';

class OffersRewardsScreen extends StatefulWidget {
  const OffersRewardsScreen({super.key, required this.partner});

  final DeliveryPartner partner;

  @override
  State<OffersRewardsScreen> createState() => _OffersRewardsScreenState();
}

class _OffersRewardsScreenState extends State<OffersRewardsScreen> {
  late DateTime _selected;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _selected = DateTime(now.year, now.month, now.day);
  }

  List<DateTime> get _days {
    final now = DateTime.now();
    final start = DateTime(now.year, now.month, now.day)
        .subtract(const Duration(days: 1));
    return List.generate(7, (i) => start.add(Duration(days: i)));
  }

  @override
  Widget build(BuildContext context) {
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
      ),
    );

    return StreamBuilder(
      stream: DeliveryPartnerService.watchById(widget.partner.id),
      builder: (context, snapshot) {
        final partner = snapshot.data ?? widget.partner;
        return Scaffold(
          backgroundColor: AppColors.surface,
          body: Column(
            children: [
              const PageHeader(title: 'Your Offers'),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.only(bottom: 24),
                  children: [
                    DateChipStrip(
                      days: _days,
                      selected: _selected,
                      filled: true,
                      onSelected: (day) => setState(() => _selected = day),
                    ),
                    const SizedBox(height: 16),
                    Container(
                      margin: const EdgeInsets.symmetric(horizontal: 16),
                      padding: const EdgeInsets.fromLTRB(16, 14, 12, 14),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1565C0),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Earn Upto ₹200 extra',
                              style: TextStyle(
                                color: AppColors.white,
                                fontWeight: FontWeight.w800,
                                fontSize: 16,
                              ),
                            ),
                          ),
                          CircleAvatar(
                            backgroundColor: Color(0xFFFFC107),
                            child: Icon(Icons.star, color: AppColors.white),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Column(
                        children: [
                          for (final offer in ShiftCatalog.offers)
                            _OfferCard(
                              offer: offer,
                              partner: partner,
                              day: _selected,
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _OfferCard extends StatelessWidget {
  const _OfferCard({
    required this.offer,
    required this.partner,
    required this.day,
  });

  final PartnerOffer offer;
  final DeliveryPartner partner;
  final DateTime day;

  Future<void> _book(BuildContext context) async {
    final booked = partner.isSlotBooked(offer.slot.id, day);
    try {
      await SlotService.setBooked(
        partnerId: partner.id,
        slotId: offer.slot.id,
        day: day,
        booked: !booked,
      );
      if (context.mounted) {
        AppFeedback.showSuccess(
          context,
          booked ? 'Offer released' : 'Offer booked',
        );
      }
    } catch (_) {
      if (context.mounted) {
        AppFeedback.showError(context, 'Could not update this offer');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final booked = partner.isSlotBooked(offer.slot.id, day);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
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
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (offer.banner.isNotEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              color: AppColors.primary,
              child: Text(
                offer.banner,
                style: const TextStyle(
                  color: AppColors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 12, 14),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        offer.slot.timeLabel,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textDark,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        offer.slot.requirementLabel,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textMedium,
                        ),
                      ),
                    ],
                  ),
                ),
                Column(
                  children: [
                    Text(
                      offer.slot.extraLabel,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textDark,
                      ),
                    ),
                    const SizedBox(height: 8),
                    booked
                        ? OutlinedButton(
                            onPressed: () => _book(context),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: AppColors.success,
                              side: const BorderSide(color: AppColors.success),
                              minimumSize: const Size(0, 36),
                            ),
                            child: const Text('Booked'),
                          )
                        : ElevatedButton(
                            onPressed: () => _book(context),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              foregroundColor: AppColors.white,
                              elevation: 0,
                              minimumSize: const Size(0, 36),
                            ),
                            child: const Text('Book Now'),
                          ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
