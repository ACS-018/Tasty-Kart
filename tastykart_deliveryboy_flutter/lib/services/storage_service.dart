import 'dart:typed_data';

import 'package:firebase_storage/firebase_storage.dart';

/// Uploads partner images under `partners/{partnerId}/...` per requirements.
///
/// Storage structure (from FIREBASE_BACKEND_REQUIREMENTS.md):
///   partners/
///     {partnerId}/
///       avatar.jpg           (profile picture)
///       documents/
///         aadhar.jpg
///         pan.jpg
///         driving_license.jpg
///         vehicle_rc.jpg
///         profile_photo.jpg
///       temp/                (temporary uploads)
class StorageService {
  StorageService._();

  static final _storage = FirebaseStorage.instance;

  // ── Avatar ───────────────────────────────────────────────────────────────

  static Future<String> uploadAvatar({
    required String partnerId,
    required Uint8List bytes,
  }) {
    return uploadImage(
      partnerId: partnerId,
      relativePath: 'avatar.jpg',
      bytes: bytes,
    );
  }

  // ── KYC Documents ────────────────────────────────────────────────────────

  static Future<String> uploadDocument({
    required String partnerId,
    required String documentId,
    required Uint8List bytes,
  }) {
    return uploadImage(
      partnerId: partnerId,
      relativePath: 'documents/$documentId.jpg',
      bytes: bytes,
      contentType: 'image/jpeg',
    );
  }

  // ── Generic Upload ───────────────────────────────────────────────────────

  static Future<String> uploadImage({
    required String partnerId,
    required String relativePath,
    required Uint8List bytes,
    String contentType = 'image/jpeg',
  }) async {
    final ref = _storage.ref('partners/$partnerId/$relativePath');
    await ref.putData(
      bytes,
      SettableMetadata(contentType: contentType),
    );
    return ref.getDownloadURL();
  }

  /// Backward-compatible alias — also used by legacy callers.
  static Future<String> uploadUserImage({
    required String uid,
    required String fileName,
    required Uint8List bytes,
  }) {
    return uploadImage(
      partnerId: uid,
      relativePath: fileName,
      bytes: bytes,
    );
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  static String avatarPath(String partnerId) =>
      'partners/$partnerId/avatar.jpg';

  static String documentPath(String partnerId, String documentId) =>
      'partners/$partnerId/documents/$documentId.jpg';
}
