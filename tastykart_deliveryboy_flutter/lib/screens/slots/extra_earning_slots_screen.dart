import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../constants/color_constants.dart';
import '../../constants/shift_slots.dart';
import '../../models/delivery_partner.dart';
import '../../services/delivery_partner_service.dart';
import '../../services/slot_service.dart';
import '../../utils/app_feedback.dart';
import '../../widgets/app_check_box.dart';
import '../../widgets/date_chip_strip.dart';
import '../../widgets/page_header.dart';

class ExtraEarningSlotsScreen extends StatefulWidget {
  const ExtraEarningSlotsScreen({super.key, required this.partner});

  final DeliveryPartner partner;

  @override
  State<ExtraEarningSlotsScreen> createState() => _ExtraEarningSlotsScreenState();
}

class _ExtraEarningSlotsScreenState extends State<ExtraEarningSlotsScreen> {
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

  Future<void> _toggle(ShiftSlot slot, DeliveryPartner partner) async {
    final booked = partner.isSlotBooked(slot.id, _selected);
    try {
      await SlotService.setBooked(
        partnerId: partner.id,
        slotId: slot.id,
        day: _selected,
        booked: !booked,
      );
    } catch (_) {
      if (mounted) {
        AppFeedback.showError(context, 'Could not update this slot');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
      ),
    );

    return StreamBuilder<DeliveryPartner?>(
      stream: DeliveryPartnerService.watchById(widget.partner.id),
      builder: (context, snapshot) {
        final partner = snapshot.data ?? widget.partner;
        final lunch = ShiftCatalog.extra
            .where((s) => s.group == ShiftGroup.lunch)
            .toList();
        final snacks = ShiftCatalog.extra
            .where((s) => s.group == ShiftGroup.snacks)
            .toList();

        return Scaffold(
          backgroundColor: AppColors.surface,
          body: Column(
            children: [
              const PageHeader(
                title: 'Extra Earning Slots',
                subtitle: 'Grab More Orders, Earn More',
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(0, 8, 0, 24),
                  children: [
                    DateChipStrip(
                      days: _days,
                      selected: _selected,
                      onSelected: (day) => setState(() => _selected = day),
                    ),
                    const SizedBox(height: 16),
                    _group('Lunch', lunch, partner),
                    const SizedBox(height: 16),
                    _group('Snacks', snacks, partner),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _group(String title, List<ShiftSlot> slots, DeliveryPartner partner) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          margin: const EdgeInsets.symmetric(horizontal: 16),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: BoxDecoration(
            color: const Color(0xFFFCE8E8),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            title,
            style: const TextStyle(
              color: AppColors.primary,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        const SizedBox(height: 10),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            children: [
              for (final slot in slots) _extraCard(slot, partner),
            ],
          ),
        ),
      ],
    );
  }

  Widget _extraCard(ShiftSlot slot, DeliveryPartner partner) {
    final booked = partner.isSlotBooked(slot.id, _selected);
    return InkWell(
      onTap: () => _toggle(slot, partner),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
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
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    slot.timeLabel,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textDark,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    slot.hourlyLabel,
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.textMedium,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            AppCheckBox(selected: booked),
          ],
        ),
      ),
    );
  }
}
