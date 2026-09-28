import 'package:cloud_firestore/cloud_firestore.dart';

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
  }) async {
    final now = FieldValue.serverTimestamp();
    final ref = _col.doc();
    await ref.set({
      'partnerId': partnerId,
      'partnerName': partnerName.isEmpty ? 'Partner' : partnerName,
      'partnerPhone': partnerPhone,
      'category': category,
      'subject': subject,
      'status': 'open',
      'unreadByAdmin': true,
      'unreadByPartner': false,
      'createdAt': now,
      'updatedAt': now,
    });
    await ref.collection('messages').add({
      'senderId': partnerId,
      'senderType': 'partner',
      'message': firstMessage.trim(),
      'sentAt': now,
    });
    return ref.id;
  }

  /// Partner sends a follow-up message on an existing ticket.
  static Future<void> sendMessage({
    required String ticketId,
    required String partnerId,
    required String message,
  }) async {
    final now = FieldValue.serverTimestamp();
    await _col.doc(ticketId).collection('messages').add({
      'senderId': partnerId,
      'senderType': 'partner',
      'message': message.trim(),
      'sentAt': now,
    });
    await _col.doc(ticketId).update({
      'updatedAt': now,
      'unreadByAdmin': true,
    });
  }

  /// Mark ticket messages as read by partner (when they open the chat).
  static Future<void> markReadByPartner(String ticketId) {
    return _col.doc(ticketId).update({'unreadByPartner': false});
  }
}
