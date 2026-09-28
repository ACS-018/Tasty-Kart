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
      subtitle: 'Issues With Current Or Previous Orders',
      icon: Icons.shopping_bag_outlined,
      iconColor: Color(0xFFB32B2C),
      iconBg: Color(0xFFFCE8E8),
      issues: [
        'Order Not Delivered',
        'Missing Item',
        'Wrong Item Received',
        'Food Quality Issue',
        'Damaged Packaging',
        'Late Delivery',
        'Payment Charged Incorrectly',
        'Refund Not Received',
        'Other',
      ],
    ),
    SupportCategory(
      id: 'delivery',
      title: 'Delivery',
      subtitle: 'Track Orders, Delayed Delivery Or Rider Issues',
      icon: Icons.local_shipping_outlined,
      iconColor: Color(0xFF2E7D32),
      iconBg: Color(0xFFE8F5E9),
      issues: [
        'Order Not Assigned',
        'Rider Is Delayed',
        'Delivery Taking Too Long',
        "Can't Reach Customer",
        'Customer Not Available',
        'Order Cancelled',
        'Wrong Delivery Address',
        'Unable To Contact Customer',
        'Reassign Delivery Request',
        'Route & Navigation Issue',
        'Vehicle Breakdown',
      ],
    ),
    SupportCategory(
      id: 'payment',
      title: 'Payment',
      subtitle: 'Payment, Wallet, Refund Or Billing',
      icon: Icons.account_balance_wallet_outlined,
      iconColor: Color(0xFF6A1B9A),
      iconBg: Color(0xFFF3E5F5),
      issues: [
        'Payout Not Received',
        'Bank Account Issue',
        'Wallet Balance Missing',
        'Payment Statement',
        'Tip Not Added',
        'Deduction Query',
        'Refund Pending',
        'Failed Transaction',
        'Invoice Issue',
      ],
    ),
    SupportCategory(
      id: 'food',
      title: 'Food Issues',
      subtitle: 'Wrong Item, Missing Item Or Food Quality',
      icon: Icons.restaurant_outlined,
      iconColor: Color(0xFFEF6C00),
      iconBg: Color(0xFFFFF3E0),
      issues: [
        'Wrong Food Packed',
        'Missing Items',
        'Missing Drinks',
        'Missing Side Items',
        'Food Is Cold',
        'Food Spilled During Delivery',
        'Poor Food Quality',
        'Damaged Packaging',
        'Restaurant Delay',
      ],
    ),
    SupportCategory(
      id: 'account',
      title: 'Account',
      subtitle: 'Profile, Addresses Or Account Settings',
      icon: Icons.person_outline,
      iconColor: Color(0xFF1565C0),
      iconBg: Color(0xFFE3F2FD),
      issues: [
        "Can't Update Profile",
        'Documents Pending',
        'Bank Details Issue',
        'Login Issue',
        'Delete Account Request',
      ],
    ),
  ];
}
