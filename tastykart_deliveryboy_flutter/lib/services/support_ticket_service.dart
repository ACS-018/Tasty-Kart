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
      'source': 'delivery_partner',
      'unreadByAdmin': true,
      'unreadByPartner': false,
      'partnerViewing': false,
      'lastMessage': firstMessage.trim(),
      'lastSenderType': 'partner',
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
      'lastMessage': message.trim(),
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
