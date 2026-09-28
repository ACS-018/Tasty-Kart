import 'package:cloud_firestore/cloud_firestore.dart';

import 'firestore_paths.dart';

class SurgeRequest {
  final String id;
  final String city;
  final String imageUrl;
  final String status;
  final int amount;
  final int hours;
  final DateTime? requestedAt;
  final DateTime? endsAt;
  final String rejectionReason;

  const SurgeRequest({
    required this.id,
    required this.city,
    required this.imageUrl,
    required this.status,
    required this.amount,
    required this.hours,
    this.requestedAt,
    this.endsAt,
    this.rejectionReason = '',
  });

  bool get isPending => status.toUpperCase() == 'PENDING';
  bool get isApproved => status.toUpperCase() == 'APPROVED';
  bool get isRejected => status.toUpperCase() == 'REJECTED';

  bool get isLive =>
      isApproved && endsAt != null && endsAt!.isAfter(DateTime.now());

  String get statusLabel {
    if (isLive) return 'Live';
    if (isApproved) return 'Approved';
    if (isRejected) return 'Rejected';
    return 'Pending';
  }

  factory SurgeRequest.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return SurgeRequest(
      id: doc.id,
      city: (data['city'] as String? ?? '').trim(),
      imageUrl: data['imageUrl'] as String? ?? '',
      status: (data['status'] as String? ?? 'PENDING').toUpperCase(),
      amount: (data['amount'] as num?)?.toInt() ?? 0,
      hours: (data['hours'] as num?)?.toInt() ?? 0,
      requestedAt: _readTime(data['requestedAt']),
      endsAt: _readTime(data['endsAt']),
      rejectionReason: data['rejectionReason'] as String? ?? '',
    );
  }
}

DateTime? _readTime(dynamic value) {
  if (value is Timestamp) return value.toDate();
  if (value is String) return DateTime.tryParse(value);
  return null;
}

class SurgeService {
  SurgeService._();

  static final FirebaseFirestore _db = FirebaseFirestore.instance;

  static CollectionReference<Map<String, dynamic>> get _col =>
      _db.collection(FirestorePaths.surgeRequests);

  static Stream<List<SurgeRequest>> watchForPartner(String partnerId) {
    return _col.where('partnerId', isEqualTo: partnerId).snapshots().map((
      snap,
    ) {
      final rows = snap.docs.map(SurgeRequest.fromDoc).toList();
      rows.sort((a, b) {
        final at = a.requestedAt?.millisecondsSinceEpoch ?? 0;
        final bt = b.requestedAt?.millisecondsSinceEpoch ?? 0;
        return bt.compareTo(at);
      });
      return rows;
    });
  }

  static Future<void> submit({
    required String partnerId,
    required String partnerName,
    required String phone,
    required String city,
    required String imageUrl,
  }) async {
    final id = 'sg_${partnerId}_${DateTime.now().millisecondsSinceEpoch}';
    await _col.doc(id).set({
      'id': id,
      'partnerId': partnerId,
      'partnerName': partnerName,
      'phone': phone,
      'city': city.trim(),
      'imageUrl': imageUrl,
      'status': 'PENDING',
      'amount': 0,
      'hours': 0,
      'startsAt': null,
      'endsAt': null,
      'requestedAt': FieldValue.serverTimestamp(),
      'rejectionReason': '',
    });
  }
}
