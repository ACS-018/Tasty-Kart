import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';

import '../models/support_ticket.dart';
import 'firestore_paths.dart';

class SupportTicketService {
  SupportTicketService._();

  static final _db = FirebaseFirestore.instance;
  static CollectionReference<Map<String, dynamic>> get _col =>
      _db.collection(FirestorePaths.supportTickets);

  // ── Streams ──────────────────────────────────────────────────────────────

  static Stream<List<SupportTicket>> watchForPartner(String partnerId) {
    return _col
        .where('partnerId', isEqualTo: partnerId)
        .orderBy('updatedAt', descending: true)
        .snapshots()
        .map((s) => s.docs.map(SupportTicket.fromDoc).toList());
  }

  static Stream<SupportTicket?> watchTicket(String ticketId) {
    return _col
        .doc(ticketId)
        .snapshots()
        .map((s) => s.exists ? SupportTicket.fromDoc(s) : null);
  }

  static Future<SupportTicket?> getTicket(String ticketId) async {
    final snap = await _col.doc(ticketId).get();
    return snap.exists ? SupportTicket.fromDoc(snap) : null;
  }

  static Stream<List<TicketMessage>> watchMessages(String ticketId) {
    return _col
        .doc(ticketId)
        .collection('messages')
        .orderBy('sentAt', descending: false)
        .snapshots()
        .map((s) => s.docs.map(TicketMessage.fromDoc).toList());
  }

  // ── Writes ────────────────────────────────────────────────────────────────

  /// Creates a new ticket and adds the first message.
  static Future<String> createTicket({
    required String partnerId,
    required String partnerName,
    required String partnerPhone,
    required String category,
    required String subject,
    required String firstMessage,
    // Optional order linking
    String? orderId,
    String? orderNumber,
    String? orderRestaurantName,
    String? orderStatus,
    int? orderTotal,
  }) async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null || uid.isEmpty) {
      throw StateError('Sign in required to submit a support request');
    }
    // Firestore security rules require partnerId == authenticated uid.
    if (partnerId != uid) {
      debugPrint(
        '[SupportTicket] partnerId ($partnerId) != auth uid ($uid); using uid',
      );
    }
    final authPartnerId = uid;

    final now = FieldValue.serverTimestamp();
    final ref = _col.doc();
    final trimmed = firstMessage.trim();
    if (trimmed.isEmpty) {
      throw ArgumentError('Message cannot be empty');
    }

    final batch = _db.batch();
    batch.set(ref, {
      'partnerId': authPartnerId,
      'partnerName': partnerName.isEmpty ? 'Partner' : partnerName,
      'partnerPhone': partnerPhone,
      'category': category,
      'subject': subject,
      'status': 'open',
      'source': 'delivery_partner',
      'unreadByAdmin': true,
      'unreadByPartner': false,
      'partnerViewing': false,
      'lastMessage': trimmed,
      'lastSenderType': 'partner',
      'createdAt': now,
      'updatedAt': now,
      if (orderId != null) 'orderId': orderId,
      if (orderNumber != null) 'orderNumber': orderNumber,
      if (orderRestaurantName != null)
        'orderRestaurantName': orderRestaurantName,
      if (orderStatus != null) 'orderStatus': orderStatus,
      if (orderTotal != null) 'orderTotal': orderTotal,
    });
    batch.set(ref.collection('messages').doc(), {
      'senderId': authPartnerId,
      'senderType': 'partner',
      'message': trimmed,
      'sentAt': now,
    });
    await batch.commit();
    return ref.id;
  }

  /// Partner sends a follow-up message on an existing ticket.
  static Future<void> sendMessage({
    required String ticketId,
    required String partnerId,
    required String message,
  }) async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null || uid.isEmpty) {
      throw StateError('Sign in required to send a message');
    }
    final trimmed = message.trim();
    if (trimmed.isEmpty) return;

    final now = FieldValue.serverTimestamp();
    await _col.doc(ticketId).collection('messages').add({
      'senderId': uid,
      'senderType': 'partner',
      'message': trimmed,
      'sentAt': now,
    });
    await _col.doc(ticketId).update({
      'updatedAt': now,
      'unreadByAdmin': true,
      'lastMessage': trimmed,
      'lastSenderType': 'partner',
    });
  }

  /// Mark ticket messages as read by partner (when they open the chat).
  static Future<void> markReadByPartner(String ticketId) {
    return _col.doc(ticketId).update({'unreadByPartner': false});
  }

  /// While the chat is open the app keeps this fresh; the reply-push Cloud
  /// Function skips the push if `partnerViewingAt` is under 2 minutes old.
  static Future<void> setPartnerViewing(String ticketId, bool viewing) async {
    try {
      await _col.doc(ticketId).update({
        'partnerViewing': viewing,
        'partnerViewingAt': FieldValue.serverTimestamp(),
        if (viewing) 'unreadByPartner': false,
      });
    } catch (_) {}
  }
}
