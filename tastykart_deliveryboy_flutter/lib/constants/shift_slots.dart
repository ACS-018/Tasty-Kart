class ShiftSlot {
  const ShiftSlot({
    required this.id,
    required this.startHour,
    required this.endHour,
    this.extraPerOrder = 0,
    this.hourlyMin = 0,
    this.hourlyMax = 0,
    this.group = ShiftGroup.regular,
  });

  final String id;
  final int startHour;
  final int endHour;
  final int extraPerOrder;
  final int hourlyMin;
  final int hourlyMax;
  final ShiftGroup group;

  String get timeLabel => '${_ampm(startHour)} - ${_ampm(endHour)}';

  String get extraLabel => '₹$extraPerOrder Extra Per Order';

  String get requirementLabel => 'Shift Completion Required $timeLabel';

  String get hourlyLabel => '₹$hourlyMin - $hourlyMax Per Hour';

  static String _ampm(int hour) {
    final period = hour >= 12 ? 'PM' : 'AM';
    final value = hour % 12 == 0 ? 12 : hour % 12;
    return '$value $period';
  }
}

enum ShiftGroup { regular, bonanza, lunch, snacks }

class PartnerOffer {
  const PartnerOffer({
    required this.id,
    required this.slot,
    this.banner = '',
  });

  final String id;
  final ShiftSlot slot;
  final String banner;
}

class ShiftCatalog {
  ShiftCatalog._();

  static const peak = <ShiftSlot>[
    ShiftSlot(id: 'peak_13_15', startHour: 13, endHour: 15, extraPerOrder: 10),
    ShiftSlot(id: 'peak_12_15', startHour: 12, endHour: 15, extraPerOrder: 10),
    ShiftSlot(
      id: 'peak_19_22',
      startHour: 19,
      endHour: 22,
      extraPerOrder: 15,
    ),
  ];

  static const bonanza = <ShiftSlot>[
    ShiftSlot(
      id: 'bonanza_13_15',
      startHour: 13,
      endHour: 15,
      extraPerOrder: 10,
      group: ShiftGroup.bonanza,
    ),
    ShiftSlot(
      id: 'bonanza_16_18',
      startHour: 16,
      endHour: 18,
      extraPerOrder: 12,
      group: ShiftGroup.bonanza,
    ),
  ];

  static const extra = <ShiftSlot>[
    ShiftSlot(
      id: 'extra_lunch_13_15',
      startHour: 13,
      endHour: 15,
      hourlyMin: 200,
      hourlyMax: 250,
      group: ShiftGroup.lunch,
    ),
    ShiftSlot(
      id: 'extra_lunch_12_15',
      startHour: 12,
      endHour: 15,
      hourlyMin: 200,
      hourlyMax: 250,
      group: ShiftGroup.lunch,
    ),
    ShiftSlot(
      id: 'extra_snacks_16_18',
      startHour: 16,
      endHour: 18,
      hourlyMin: 180,
      hourlyMax: 220,
      group: ShiftGroup.snacks,
    ),
    ShiftSlot(
      id: 'extra_snacks_17_19',
      startHour: 17,
      endHour: 19,
      hourlyMin: 180,
      hourlyMax: 220,
      group: ShiftGroup.snacks,
    ),
  ];

  static const offers = <PartnerOffer>[
    PartnerOffer(
      id: 'offer_dinner_18_20',
      banner: 'Thursday Extra Earnings - Dinner Offer',
      slot: ShiftSlot(
        id: 'offer_dinner_18_20',
        startHour: 18,
        endHour: 20,
        extraPerOrder: 10,
      ),
    ),
    PartnerOffer(
      id: 'offer_lunch_13_15',
      slot: ShiftSlot(
        id: 'offer_lunch_13_15',
        startHour: 13,
        endHour: 15,
        extraPerOrder: 10,
      ),
    ),
  ];
}
