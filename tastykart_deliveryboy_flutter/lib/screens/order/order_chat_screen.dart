import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../../constants/color_constants.dart';
import '../../models/delivery_order.dart';
import '../../models/delivery_partner.dart';

// Delivery boy app shares the same FirestoreService chat methods via direct Firestore calls.
class DeliveryOrderChatScreen extends StatefulWidget {
  const DeliveryOrderChatScreen({
    super.key,
    required this.order,
    required this.partner,
  });

  final DeliveryOrder order;
  final DeliveryPartner partner;

  @override
  State<DeliveryOrderChatScreen> createState() =>
      _DeliveryOrderChatScreenState();
}

class _DeliveryOrderChatScreenState extends State<DeliveryOrderChatScreen> {
  final _ctrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  bool _sending = false;

  Stream<QuerySnapshot> get _chatStream => FirebaseFirestore.instance
      .collection('orders')
      .doc(widget.order.id)
      .collection('chat')
      .orderBy('sentAt', descending: false)
      .snapshots();

  Future<void> _send() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    _ctrl.clear();
    try {
      final ref = FirebaseFirestore.instance
          .collection('orders')
          .doc(widget.order.id)
          .collection('chat')
          .doc();
      await ref.set({
        'id': ref.id,
        'senderId': widget.partner.id,
        'senderName': widget.partner.name,
        'senderType': 'partner',
        'message': text,
        'sentAt': FieldValue.serverTimestamp(),
        'read': false,
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scrollCtrl.hasClients) {
          _scrollCtrl.animateTo(
            _scrollCtrl.position.maxScrollExtent,
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOut,
          );
        }
      });
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not send message'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return Scaffold(
      backgroundColor: const Color(0xFFF7F7F7),
      body: Column(
        children: [
          // Header
          Container(
            color: AppColors.primary,
            padding: EdgeInsets.fromLTRB(4, top + 4, 16, 12),
            child: Row(
              children: [
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.arrow_back, color: AppColors.white),
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.order.customerName.isEmpty
                            ? 'Customer'
                            : widget.order.customerName,
                        style: const TextStyle(
                          color: AppColors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                        ),
                      ),
                      Text(
                        widget.order.displayOrderNumber,
                        style: TextStyle(
                          color: AppColors.white.withValues(alpha: 0.7),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Messages
          Expanded(
            child: StreamBuilder<QuerySnapshot>(
              stream: _chatStream,
              builder: (context, snap) {
                if (snap.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                final docs = snap.data?.docs ?? [];
                if (docs.isEmpty) {
                  return const Center(
                    child: Text(
                      'No messages yet.\nSend a message to the customer.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.textMedium),
                    ),
                  );
                }
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (_scrollCtrl.hasClients) {
                    _scrollCtrl.jumpTo(_scrollCtrl.position.maxScrollExtent);
                  }
                });
                return ListView.builder(
                  controller: _scrollCtrl,
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                  itemCount: docs.length,
                  itemBuilder: (context, i) {
                    final d = docs[i].data() as Map<String, dynamic>;
                    final isMe = d['senderType'] == 'partner';
                    final text = d['message'] as String? ?? '';
                    final name = d['senderName'] as String? ?? '';
                    final ts = d['sentAt'];
                    String timeStr = '';
                    if (ts is Timestamp) {
                      final dt = ts.toDate().toLocal();
                      timeStr =
                          '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
                    }
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Row(
                        mainAxisAlignment: isMe
                            ? MainAxisAlignment.end
                            : MainAxisAlignment.start,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          if (!isMe) ...[
                            CircleAvatar(
                              radius: 16,
                              backgroundColor: const Color(0xFFE8F5E9),
                              child: const Icon(
                                Icons.person,
                                size: 16,
                                color: AppColors.success,
                              ),
                            ),
                            const SizedBox(width: 8),
                          ],
                          Flexible(
                            child: Column(
                              crossAxisAlignment: isMe
                                  ? CrossAxisAlignment.end
                                  : CrossAxisAlignment.start,
                              children: [
                                if (!isMe)
                                  Padding(
                                    padding: const EdgeInsets.only(
                                      left: 4,
                                      bottom: 3,
                                    ),
                                    child: Text(
                                      name,
                                      style: const TextStyle(
                                        fontSize: 11,
                                        color: AppColors.textMedium,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 14,
                                    vertical: 10,
                                  ),
                                  decoration: BoxDecoration(
                                    color: isMe
                                        ? AppColors.primary
                                        : AppColors.white,
                                    borderRadius: BorderRadius.only(
                                      topLeft: const Radius.circular(16),
                                      topRight: const Radius.circular(16),
                                      bottomLeft: Radius.circular(
                                        isMe ? 16 : 4,
                                      ),
                                      bottomRight: Radius.circular(
                                        isMe ? 4 : 16,
                                      ),
                                    ),
                                  ),
                                  child: Text(
                                    text,
                                    style: TextStyle(
                                      fontSize: 14,
                                      color: isMe
                                          ? AppColors.white
                                          : AppColors.textDark,
                                    ),
                                  ),
                                ),
                                if (timeStr.isNotEmpty)
                                  Padding(
                                    padding: const EdgeInsets.only(
                                      top: 3,
                                      left: 4,
                                      right: 4,
                                    ),
                                    child: Text(
                                      timeStr,
                                      style: const TextStyle(
                                        fontSize: 10,
                                        color: AppColors.textLight,
                                      ),
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
              },
            ),
          ),

          // Input
          SafeArea(
            top: false,
            child: Container(
              color: AppColors.white,
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _ctrl,
                      textCapitalization: TextCapitalization.sentences,
                      maxLines: 4,
                      minLines: 1,
                      style: const TextStyle(fontSize: 14),
                      decoration: InputDecoration(
                        hintText: 'Message customer…',
                        hintStyle: const TextStyle(
                          color: AppColors.textLight,
                          fontSize: 14,
                        ),
                        filled: true,
                        fillColor: const Color(0xFFF5F5F5),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 10,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                          borderSide: BorderSide.none,
                        ),
                      ),
                      onSubmitted: (_) => _send(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: _send,
                    child: Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: _sending
                            ? AppColors.primary.withValues(alpha: 0.5)
                            : AppColors.primary,
                      ),
                      child: _sending
                          ? const Padding(
                              padding: EdgeInsets.all(12),
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: AppColors.white,
                              ),
                            )
                          : const Icon(
                              Icons.send_rounded,
                              color: AppColors.white,
                              size: 20,
                            ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
