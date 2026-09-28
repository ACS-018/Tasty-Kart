import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../../constants/color_constants.dart';
import '../../models/delivery_order.dart';
import '../../models/delivery_partner.dart';
import '../../services/firestore_paths.dart';
import '../../utils/app_feedback.dart';

class PartnerReviewScreen extends StatefulWidget {
  const PartnerReviewScreen({
    super.key,
    required this.order,
    required this.partner,
  });

  final DeliveryOrder order;
  final DeliveryPartner partner;

  @override
  State<PartnerReviewScreen> createState() => _PartnerReviewScreenState();
}

class _PartnerReviewScreenState extends State<PartnerReviewScreen> {
  int _stars = 0;
  final _comment = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  void _close() {
    Navigator.of(context).popUntil((route) => route.isFirst);
  }

  Future<void> _submit() async {
    if (_saving) return;
    if (_stars <= 0) {
      AppFeedback.showError(context, 'Select a star rating first');
      return;
    }
    setState(() => _saving = true);
    try {
      final id = 'rev_${widget.partner.id}_${widget.order.id}';
      await FirebaseFirestore.instance
          .collection(FirestorePaths.reviews)
          .doc(id)
          .set({
        'id': id,
        'reviewerName': widget.partner.name.trim().isEmpty
            ? 'Delivery partner'
            : widget.partner.name.trim(),
        'partnerName': widget.partner.name,
        'partnerId': widget.partner.id,
        'reviewerRole': 'delivery_partner',
        'type': 'restaurant',
        'rating': _stars,
        'comment': _comment.text.trim(),
        'status': 'published',
        'orderId': widget.order.id,
        'restaurantId': widget.order.restaurantId,
        'restaurantName': widget.order.restaurantName,
        'createdAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
      if (!mounted) return;
      AppFeedback.showSuccess(context, 'Review sent');
      _close();
    } catch (_) {
      if (!mounted) return;
      setState(() => _saving = false);
      AppFeedback.showError(context, 'Could not save the review');
    }
  }

  @override
  Widget build(BuildContext context) {
    final place = widget.order.restaurantName.trim().isEmpty
        ? 'the restaurant'
        : widget.order.restaurantName.trim();
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.white,
        foregroundColor: AppColors.textDark,
        elevation: 0,
        title: const Text(
          'Rate restaurant',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: _saving ? null : _close,
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Text(
            'How was $place?',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          const Text(
            'Your name is sent with this restaurant review.',
            style: TextStyle(color: AppColors.textMedium),
          ),
          const SizedBox(height: 16),
          Row(
            children: List.generate(5, (i) {
              final filled = i < _stars;
              return IconButton(
                onPressed: _saving
                    ? null
                    : () => setState(() => _stars = _stars == i + 1 ? 0 : i + 1),
                icon: Icon(
                  Icons.star_rounded,
                  size: 36,
                  color: filled
                      ? const Color(0xFFFFB300)
                      : const Color(0xFFDDDDDD),
                ),
              );
            }),
          ),
          TextField(
            controller: _comment,
            maxLines: 3,
            decoration: const InputDecoration(
              hintText: 'Optional comment',
              filled: true,
              fillColor: AppColors.white,
              border: OutlineInputBorder(borderSide: BorderSide.none),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _saving ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: Text(_saving ? 'Saving...' : 'Submit review'),
            ),
          ),
          TextButton(onPressed: _saving ? null : _close, child: const Text('Skip')),
        ],
      ),
    );
  }
}
