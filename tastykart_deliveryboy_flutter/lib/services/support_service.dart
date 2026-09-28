import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/delivery_partner.dart';
import 'firestore_paths.dart';
import 'settings_service.dart';

class SupportService {
  SupportService._();

  static final FirebaseFirestore _db = FirebaseFirestore.instance;

  static Future<void> submitIssue({
    required DeliveryPartner partner,
    required String category,
    required String issue,
  }) async {
    final settings = await SettingsService.getSettings(forceRefresh: true);
    final supportPhone = settings.supportPhone.trim();
    final supportEmail = settings.supportEmail.trim();
    final who = partner.name.trim().isEmpty ? 'A partner' : partner.name.trim();
    final contact = [
      if (supportPhone.isNotEmpty) supportPhone,
      if (supportEmail.isNotEmpty) supportEmail,
    ].join(' · ');
    await _db.collection(FirestorePaths.notifications).add({
      'type': 'support',
      'userId': '',
      'partnerId': partner.id,
      'partnerName': who,
      'phone': partner.phone,
      'category': category,
      'issue': issue,
      'supportPhone': supportPhone,
      'supportEmail': supportEmail,
      'title': 'Partner support · $category',
      'message': contact.isEmpty
          ? '$who reported "$issue" under $category.'
          : '$who (${partner.phone}) reported "$issue" under $category. Reply via $contact.',
      'read': false,
      'createdAt': FieldValue.serverTimestamp(),
    });
  }
}
