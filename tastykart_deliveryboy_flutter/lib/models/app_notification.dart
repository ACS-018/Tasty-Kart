import 'package:cloud_firestore/cloud_firestore.dart';

/// In-app notification model
class AppNotification {
  final String id;
  final String userId;
  final String userType;
  final String type;
  final String title;
  final String message;
  final Map<String, dynamic> data;
  final bool read;
  final String priority;
  final DateTime? createdAt;
  final DateTime? expiresAt;

  const AppNotification({
    required this.id,
    this.userId = '',
    this.userType = '',
    this.type = '',
    this.title = '',
    this.message = '',
    this.data = const {},
    this.read = false,
    this.priority = 'medium',
    this.createdAt,
    this.expiresAt,
  });

  /// Check if notification is expired
  bool get isExpired {
    if (expiresAt == null) return false;
    return DateTime.now().isAfter(expiresAt!);
  }

  /// Get icon for notification type
  String get icon {
    switch (type) {
      case 'order_assigned':
        return '🚚';
      case 'order_cancelled':
        return '❌';
      case 'payment_received':
        return '💰';
      case 'account_update':
        return '👤';
      case 'announcement':
        return '📢';
      default:
        return '🔔';
    }
  }

  /// Get action from data
  String get action => data['action']?.toString() ?? '';

  /// Get order ID from data
  String get orderId => data['orderId']?.toString() ?? '';

  /// Get order number from data
  String get orderNumber => data['orderNumber']?.toString() ?? '';

  /// Check if notification has action
  bool get hasAction => action.isNotEmpty;

  /// Check if high priority
  bool get isHighPriority =>
      priority.toLowerCase() == 'high' || priority.toLowerCase() == 'urgent';

  /// Factory method to create from Firestore document
  factory AppNotification.fromDoc(DocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>? ?? {};

    DateTime? created;
    final createdRaw = d['createdAt'];
    if (createdRaw is Timestamp) {
      created = createdRaw.toDate();
    }

    DateTime? expires;
    final expiresRaw = d['expiresAt'];
    if (expiresRaw is Timestamp) {
      expires = expiresRaw.toDate();
    }

    Map<String, dynamic> data = {};
    if (d['data'] is Map) {
      data = Map<String, dynamic>.from(d['data'] as Map);
    }

    return AppNotification(
      id: d['id']?.toString() ?? doc.id,
      userId: d['userId']?.toString() ?? '',
      userType: d['userType']?.toString() ?? '',
      type: d['type']?.toString() ?? '',
      title: d['title']?.toString() ?? '',
      message: d['message']?.toString() ?? '',
      data: data,
      read: d['read'] == true,
      priority: d['priority']?.toString() ?? 'medium',
      createdAt: created,
      expiresAt: expires,
    );
  }

  /// Convert to map
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'userId': userId,
      'userType': userType,
      'type': type,
      'title': title,
      'message': message,
      'data': data,
      'read': read,
      'priority': priority,
      'createdAt': createdAt != null ? Timestamp.fromDate(createdAt!) : null,
      'expiresAt': expiresAt != null ? Timestamp.fromDate(expiresAt!) : null,
    };
  }

  /// Copy with
  AppNotification copyWith({
    String? id,
    String? userId,
    String? userType,
    String? type,
    String? title,
    String? message,
    Map<String, dynamic>? data,
    bool? read,
    String? priority,
    DateTime? createdAt,
    DateTime? expiresAt,
  }) {
    return AppNotification(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      userType: userType ?? this.userType,
      type: type ?? this.type,
      title: title ?? this.title,
      message: message ?? this.message,
      data: data ?? this.data,
      read: read ?? this.read,
      priority: priority ?? this.priority,
      createdAt: createdAt ?? this.createdAt,
      expiresAt: expiresAt ?? this.expiresAt,
    );
  }

  @override
  String toString() {
    return 'AppNotification(id: $id, type: $type, title: $title, read: $read)';
  }
}
