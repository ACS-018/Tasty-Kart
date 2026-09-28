import 'package:flutter/material.dart';

import '../../../constants/color_constants.dart';
import '../../../constants/shift_slots.dart';
import '../../../models/delivery_partner.dart';
import '../../../services/slot_service.dart';
import '../../../utils/app_feedback.dart';

class PeakSlotCard extends StatelessWidget {
  const PeakSlotCard({
    super.key,
    required this.slot,
    required this.partner,
    required this.day,
  });

  final ShiftSlot slot;
  final DeliveryPartner partner;
  final DateTime day;

  Future<void> _toggle(BuildContext context) async {
    final booked = partner.isSlotBooked(slot.id, day);
    try {
      await SlotService.setBooked(
        partnerId: partner.id,
        slotId: slot.id,
        day: day,
        booked: !booked,
      );
      if (context.mounted) {
        AppFeedback.showSuccess(
          context,
          booked ? 'Slot released' : 'Slot booked',
        );
      }
    } catch (_) {
      if (context.mounted) {
        AppFeedback.showError(context, 'Could not update this slot');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final booked = partner.isSlotBooked(slot.id, day);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.fromLTRB(16, 14, 12, 14),
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
                  slot.extraLabel,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textDark,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  slot.requirementLabel,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.textMedium,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          booked
              ? OutlinedButton.icon(
                  onPressed: () => _toggle(context),
                  icon: const Icon(Icons.check, size: 16),
                  label: const Text('Booked'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.success,
                    side: const BorderSide(color: AppColors.success),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    minimumSize: const Size(0, 40),
                  ),
                )
              : ElevatedButton(
                  onPressed: () => _toggle(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: AppColors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    minimumSize: const Size(0, 40),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  child: const Text(
                    'Book Now',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
        ],
      ),
    );
  }
}
