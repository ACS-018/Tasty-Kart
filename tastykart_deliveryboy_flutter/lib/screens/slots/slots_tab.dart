import 'package:flutter/material.dart';

import '../../constants/color_constants.dart';
import '../../constants/shift_slots.dart';
import '../../models/delivery_partner.dart';
import '../../utils/app_navigation.dart';
import '../../widgets/date_chip_strip.dart';
import '../Home/components/home_header.dart';
import 'components/peak_slot_card.dart';
import 'extra_earning_slots_screen.dart';

class SlotsTab extends StatefulWidget {
  const SlotsTab({super.key, required this.partner});

  final DeliveryPartner partner;

  @override
  State<SlotsTab> createState() => _SlotsTabState();
}

class _SlotsTabState extends State<SlotsTab> {
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
    return ColoredBox(
      color: AppColors.surface,
      child: Column(
        children: [
          HomeHeader(partner: widget.partner, compact: true),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(0, 16, 0, 24),
              children: [
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: Text(
                    'Slots',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textDark,
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: Text(
                    'Grab More Orders, Earn More',
                    style: TextStyle(
                      fontSize: 13,
                      color: AppColors.textMedium,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                DateChipStrip(
                  days: _days,
                  selected: _selected,
                  onSelected: (day) => setState(() => _selected = day),
                ),
                const SizedBox(height: 16),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Column(
                    children: [
                      for (final slot in ShiftCatalog.peak)
                        PeakSlotCard(
                          slot: slot,
                          partner: widget.partner,
                          day: _selected,
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                InkWell(
                  onTap: () => AppNavigation.push(
                    context,
                    ExtraEarningSlotsScreen(partner: widget.partner),
                  ),
                  child: Container(
                    width: double.infinity,
                    margin: const EdgeInsets.symmetric(horizontal: 16),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFCE8E8),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Text(
                      'Extra Bonanza',
                      style: TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Column(
                    children: [
                      for (final slot in ShiftCatalog.bonanza)
                        PeakSlotCard(
                          slot: slot,
                          partner: widget.partner,
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
  }
}
