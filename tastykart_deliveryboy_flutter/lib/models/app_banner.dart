import 'package:cloud_firestore/cloud_firestore.dart';

/// Promotional banner for delivery partner app.
///
/// Firestore path: banners/{bannerId}
///
/// Fields match FIREBASE_BACKEND_REQUIREMENTS.md:
///   id, title, description, imageUrl, targetScreen, actionUrl,
///   active, priority, startDate, endDate, createdAt
class AppBanner {
  final String id;
  final String title;
  final String description;
  final String imageUrl;
  final String targetScreen;
  final String actionUrl;
  final bool active;
  final int priority;
  final DateTime? startDate;
  final DateTime? endDate;
  final DateTime? createdAt;

  const AppBanner({
    required this.id,
    this.title = '',
    this.description = '',
    this.imageUrl = '',
    this.targetScreen = '',
    this.actionUrl = '',
    this.active = false,
    this.priority = 0,
    this.startDate,
    this.endDate,
    this.createdAt,
  });

  /// Legacy: map old 'status' field to active flag
  static bool _statusToActive(dynamic status) {
    if (status is bool) return status;
    if (status is String) {
      final s = status.toLowerCase().trim();
      return s == 'active' || s == 'true' || s == '1';
    }
    return false;
  }

  factory AppBanner.fromDoc(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>? ?? {};

    DateTime? start;
    final startRaw = data['startDate'];
    if (startRaw is Timestamp) {
      start = startRaw.toDate();
    }

    DateTime? end;
    final endRaw = data['endDate'];
    if (endRaw is Timestamp) {
      end = endRaw.toDate();
    }

    DateTime? created;
    final createdRaw = data['createdAt'];
    if (createdRaw is Timestamp) {
      created = createdRaw.toDate();
    }

    final isActive = data['active'] == true || _statusToActive(data['status']);

    return AppBanner(
      id: data['id'] as String? ?? doc.id,
      title: data['title']?.toString() ?? '',
      description: data['description']?.toString() ?? '',
      imageUrl: data['imageUrl']?.toString() ?? '',
      targetScreen: data['targetScreen']?.toString() ?? '',
      actionUrl: data['actionUrl']?.toString() ?? '',
      active: isActive,
      priority: (data['priority'] as num? ??
              data['order'] as num? ??
              data['sortOrder'] as num? ??
              0)
          .toInt(),
      startDate: start,
      endDate: end,
      createdAt: created,
    );
  }

  /// Check if banner is currently active based on date range + active flag
  bool get isCurrentlyActive {
    if (!active) return false;
    final now = DateTime.now();
    if (startDate != null && now.isBefore(startDate!)) return false;
    if (endDate != null && now.isAfter(endDate!)) return false;
    return true;
  }
}
