import 'package:cloud_firestore/cloud_firestore.dart';

import 'firestore_paths.dart';

class FirestoreService {
  FirestoreService._();

  static final FirebaseFirestore _db = FirebaseFirestore.instance;

  static Stream<DocumentSnapshot<Map<String, dynamic>>> adminSettings() {
    return _db
        .collection(FirestorePaths.settings)
        .doc(FirestorePaths.settingsAdminDoc)
        .snapshots();
  }

  static Future<Map<String, String>> legalCopy() async {
    final snap = await _db
        .collection(FirestorePaths.settings)
        .doc(FirestorePaths.settingsAdminDoc)
        .get();
    final legal = snap.data()?['legal'];
    if (legal is! Map) return const {};
    return {
      'terms': (legal['terms'] ?? '').toString(),
      'privacy': (legal['privacy'] ?? '').toString(),
      'refund': (legal['refund'] ?? '').toString(),
    };
  }
}
