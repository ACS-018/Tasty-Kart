import 'package:flutter/material.dart';

class MedalLevel {
  const MedalLevel({
    required this.id,
    required this.name,
    required this.minDeliveries,
    required this.maxDeliveries,
    required this.requirementLabel,
    required this.rangeLabel,
    required this.color,
    required this.background,
    required this.icon,
    required this.benefits,
  });

  final String id;
  final String name;
  final int minDeliveries;
  final int? maxDeliveries;
  final String requirementLabel;
  final String rangeLabel;
  final Color color;
  final Color background;
  final IconData icon;
  final List<String> benefits;

  bool reachedBy(int deliveries) => deliveries >= minDeliveries;

  bool contains(int deliveries) {
    if (deliveries < minDeliveries) return false;
    final max = maxDeliveries;
    if (max == null) return true;
    return deliveries <= max;
  }
}

class MedalLevels {
  MedalLevels._();

  static const bronze = MedalLevel(
    id: 'bronze',
    name: 'Bronze',
    minDeliveries: 0,
    maxDeliveries: 49,
    requirementLabel: 'Start Level',
    rangeLabel: '0 - 49 Deliveries',
    color: Color(0xFFEF6C00),
    background: Color(0xFFFFF3E0),
    icon: Icons.star_rounded,
    benefits: [
      'Basic Incentives',
      'Standard Delivery',
    ],
  );

  static const silver = MedalLevel(
    id: 'silver',
    name: 'Silver',
    minDeliveries: 50,
    maxDeliveries: 149,
    requirementLabel: '50 Deliveries',
    rangeLabel: '50 - 149 Deliveries',
    color: Color(0xFF1E88E5),
    background: Color(0xFFE3F2FD),
    icon: Icons.star_rounded,
    benefits: [
      '₹5 Bonus Per Order',
      'Weekly Rewards',
      'Priority Support',
    ],
  );

  static const gold = MedalLevel(
    id: 'gold',
    name: 'Gold',
    minDeliveries: 150,
    maxDeliveries: 249,
    requirementLabel: '150 Deliveries',
    rangeLabel: '150 - 249 Deliveries',
    color: Color(0xFFF9A825),
    background: Color(0xFFFFF8E1),
    icon: Icons.workspace_premium_rounded,
    benefits: [
      '₹20 Bonus Per Order',
      'Fuel Cashback',
      'Priority Orders',
    ],
  );

  static const platinum = MedalLevel(
    id: 'platinum',
    name: 'Platinum',
    minDeliveries: 250,
    maxDeliveries: null,
    requirementLabel: '250 Deliveries',
    rangeLabel: '250 Deliveries',
    color: Color(0xFF8E24AA),
    background: Color(0xFFF3E5F5),
    icon: Icons.workspace_premium_rounded,
    benefits: [
      '₹30 Bonus Per Order',
      'Highest Priority Order',
      'Exclusive Incentives',
      'VIP Partner Support',
    ],
  );

  static const all = [bronze, silver, gold, platinum];

  static MedalLevel currentFor(int deliveries) {
    MedalLevel current = bronze;
    for (final level in all) {
      if (level.reachedBy(deliveries)) current = level;
    }
    return current;
  }

  static MedalLevel? nextAfter(MedalLevel current) {
    final index = all.indexOf(current);
    if (index < 0 || index >= all.length - 1) return null;
    return all[index + 1];
  }
}
