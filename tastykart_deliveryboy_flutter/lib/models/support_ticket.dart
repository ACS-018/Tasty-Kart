import 'package:cloud_firestore/cloud_firestore.dart';

/// Status values for a support ticket.
enum TicketStatus { open, inProgress, closed }

extension TicketStatusX on TicketStatus {
  String get value {
    switch (this) {
      case TicketStatus.open:       return 'open';
      case TicketStatus.inProgress: return 'in_progress';
      case TicketStatus.closed:     return 'closed';
    }
  }

  static TicketStatus fromString(String? s) {
    switch ((s ?? '').toLowerCase()) {
      case 'in_progress': return TicketStatus.inProgress;
      case 'closed':      return TicketStatus.closed;
      default:            return TicketStatus.open;
    }
  }
}

class SupportTicket {
  final String id;
  final String partnerId;
  final String partnerName;
  final String partnerPhone;
  final String category;
  final String subject;
  final TicketStatus status;
  final bool unreadByAdmin;
  final bool unreadByPartner;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final DateTime? closedAt;

  const SupportTicket({
    required this.id,
    required this.partnerId,
    required this.partnerName,
    required this.partnerPhone,
    required this.category,
    required this.subject,
    this.status = TicketStatus.open,
    this.unreadByAdmin = true,
    this.unreadByPartner = false,
    this.createdAt,
    this.updatedAt,
    this.closedAt,
  });

  factory SupportTicket.fromDoc(DocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>? ?? {};
    return SupportTicket(
      id: doc.id,
      partnerId: d['partnerId'] as String? ?? '',
      partnerName: d['partnerName'] as String? ?? '',
      partnerPhone: d['partnerPhone'] as String? ?? '',
      category: d['category'] as String? ?? '',
      subject: d['subject'] as String? ?? '',
      status: TicketStatusX.fromString(d['status'] as String?),
      unreadByAdmin: d['unreadByAdmin'] as bool? ?? true,
      unreadByPartner: d['unreadByPartner'] as bool? ?? false,
      createdAt: _ts(d['createdAt']),
      updatedAt: _ts(d['updatedAt']),
      closedAt: _ts(d['closedAt']),
    );
  }

  static DateTime? _ts(dynamic v) {
    if (v is Timestamp) return v.toDate();
    return null;
  }
}

class TicketMessage {
  final String id;
  final String senderId;
  final String senderType; // 'partner' | 'admin'
  final String message;
  final DateTime? sentAt;

  const TicketMessage({
    required this.id,
    required this.senderId,
    required this.senderType,
    required this.message,
    this.sentAt,
  });

  factory TicketMessage.fromDoc(DocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>? ?? {};
    return TicketMessage(
      id: doc.id,
      senderId: d['senderId'] as String? ?? '',
      senderType: d['senderType'] as String? ?? 'partner',
      message: d['message'] as String? ?? '',
      sentAt: SupportTicket._ts(d['sentAt']),
    );
  }
}
