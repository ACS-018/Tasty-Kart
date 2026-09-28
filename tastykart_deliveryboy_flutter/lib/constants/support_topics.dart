import 'package:flutter/material.dart';

class SupportCategory {
  const SupportCategory({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.iconColor,
    required this.iconBg,
    required this.issues,
  });

  final String id;
  final String title;
  final String subtitle;
  final IconData icon;
  final Color iconColor;
  final Color iconBg;
  final List<String> issues;
}

class SupportTopics {
  SupportTopics._();

  static const categories = [
    SupportCategory(
      id: 'orders',
      title: 'Orders',
      subtitle: 'Pickup, Delivery Or Customer Issues On An Order',
      icon: Icons.shopping_bag_outlined,
      iconColor: Color(0xFFB32B2C),
      iconBg: Color(0xFFFCE8E8),
      issues: [
        'Order Not Ready At Restaurant',
        'Restaurant Delay',
        'Wrong Or Missing Items At Pickup',
        'Damaged Packaging',
        "Can't Reach Customer",
        'Customer Not Available',
        'Wrong Delivery Address',
        'Customer Refused Order',
        'Order Cancelled After Pickup',
        'Other',
      ],
    ),
    SupportCategory(
      id: 'payments',
      title: 'Payments',
      subtitle: 'Earnings, Tips, Cash In Hand Or Payouts',
      icon: Icons.account_balance_wallet_outlined,
      iconColor: Color(0xFF6A1B9A),
      iconBg: Color(0xFFF3E5F5),
      issues: [
        'Order Earnings Not Added',
        'Tip Not Added',
        'Incentive Not Credited',
        'Cash Deposit Not Updated',
        'Wrong Cash In Hand Amount',
        'Payout Not Received',
        'Deduction Query',
        'Bank Account Issue',
        'Other',
      ],
    ),
  ];
}
