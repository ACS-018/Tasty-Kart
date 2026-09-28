import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';

import 'analytics_service.dart';
import 'firestore_paths.dart';

/// Service for managing delivery partner time slots
class SlotService {
  SlotService._();

  static final FirebaseFirestore _db = FirebaseFirestore.instance;

  /// Convert DateTime to date key format (YYYY-MM-DD)
  static String dateKey(DateTime day) {
    final local = DateTime(day.year, day.month, day.day);
    return '${local.year}-${local.month.toString().padLeft(2, '0')}-'
        '${local.day.toString().padLeft(2, '0')}';
  }

  // ============ Partner Document Slot Management ============

  /// Set slot as booked/unbooked in partner's main document
  static Future<void> setBooked({
    required String partnerId,
    required String slotId,
    required DateTime day,
    required bool booked,
  }) async {
    try {
      final entry = {'slotId': slotId, 'date': dateKey(day)};

      await _db.collection(FirestorePaths.deliveryPartners).doc(partnerId).set({
        'bookedSlots': booked
            ? FieldValue.arrayUnion([entry])
            : FieldValue.arrayRemove([entry]),
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));

      // Track analytics
      if (booked) {
        await AnalyticsService.logSlotBooked(
          partnerId: partnerId,
          slotId: slotId,
          date: dateKey(day),
        );
      }

      debugPrint(
        'Slot ${booked ? 'booked' : 'unbooked'}: $slotId for ${dateKey(day)}',
      );
    } catch (e) {
      debugPrint('Error setting slot booking: $e');
      rethrow;
    }
  }

  // ============ Subcollection Slot Management ============

  /// Get slots subcollection reference for a partner
  static CollectionReference<Map<String, dynamic>> _slotsCollection(
    String partnerId,
  ) {
    return _db
        .collection(FirestorePaths.deliveryPartners)
        .doc(partnerId)
        .collection(FirestorePaths.partnerSlots);
  }

  /// Book slot in subcollection (detailed tracking)
  static Future<void> bookSlot({
    required String partnerId,
    required String slotId,
    required String label,
    required String startTime,
    required String endTime,
    required DateTime day,
  }) async {
    try {
      final date = dateKey(day);
      final slotRef = _slotsCollection(partnerId).doc(date);

      await slotRef.set({
        'date': date,
        'bookedSlots': FieldValue.arrayUnion([
          {
            'slotId': slotId,
            'label': label,
            'startTime': startTime,
            'endTime': endTime,
            'bookedAt': FieldValue.serverTimestamp(),
          },
        ]),
        'status': 'active',
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));

      // Also update main partner document
      await setBooked(
        partnerId: partnerId,
        slotId: slotId,
        day: day,
        booked: true,
      );

      debugPrint('Slot booked in subcollection: $slotId for $date');
    } catch (e) {
      debugPrint('Error booking slot: $e');
      rethrow;
    }
  }

  /// Cancel booked slot
  static Future<void> cancelSlot({
    required String partnerId,
    required String slotId,
    required DateTime day,
  }) async {
    try {
      final date = dateKey(day);
      final slotRef = _slotsCollection(partnerId).doc(date);

      // Get current document to find the exact slot entry
      final doc = await slotRef.get();
      if (doc.exists) {
        final data = doc.data();
        final bookedSlots = data?['bookedSlots'] as List? ?? [];

        // Find and remove the matching slot
        final updatedSlots = bookedSlots.where((slot) {
          return slot['slotId'] != slotId;
        }).toList();

        if (updatedSlots.isEmpty) {
          // No more slots, update status
          await slotRef.update({
            'bookedSlots': updatedSlots,
            'status': 'cancelled',
            'updatedAt': FieldValue.serverTimestamp(),
          });
        } else {
          await slotRef.update({
            'bookedSlots': updatedSlots,
            'updatedAt': FieldValue.serverTimestamp(),
          });
        }
      }

      // Also update main partner document
      await setBooked(
        partnerId: partnerId,
        slotId: slotId,
        day: day,
        booked: false,
      );

      debugPrint('Slot cancelled: $slotId for $date');
    } catch (e) {
      debugPrint('Error cancelling slot: $e');
      rethrow;
    }
  }

  /// Get slots for a specific date
  static Future<Map<String, dynamic>?> getSlotsForDate({
    required String partnerId,
    required DateTime day,
  }) async {
    try {
      final date = dateKey(day);
      final doc = await _slotsCollection(partnerId).doc(date).get();

      if (!doc.exists) return null;
      return doc.data();
    } catch (e) {
      debugPrint('Error getting slots for date: $e');
      return null;
    }
  }

  /// Watch slots for a specific date
  static Stream<Map<String, dynamic>?> watchSlotsForDate({
    required String partnerId,
    required DateTime day,
  }) {
    final date = dateKey(day);
    return _slotsCollection(partnerId).doc(date).snapshots().map((doc) {
      if (!doc.exists) return null;
      return doc.data();
    });
  }

  /// Get slots for date range
  static Future<List<Map<String, dynamic>>> getSlotsForDateRange({
    required String partnerId,
    required DateTime startDate,
    required DateTime endDate,
  }) async {
    try {
      final startKey = dateKey(startDate);
      final endKey = dateKey(endDate);

      final snapshot = await _slotsCollection(partnerId)
          .where('date', isGreaterThanOrEqualTo: startKey)
          .where('date', isLessThanOrEqualTo: endKey)
          .orderBy('date')
          .get();

      return snapshot.docs.map((doc) => doc.data()).toList();
    } catch (e) {
      debugPrint('Error getting slots for date range: $e');
      return [];
    }
  }

  /// Update slot earnings (when orders are completed)
  static Future<void> updateSlotEarnings({
    required String partnerId,
    required DateTime day,
    required int earnings,
    required int ordersCompleted,
  }) async {
    try {
      final date = dateKey(day);
      final slotRef = _slotsCollection(partnerId).doc(date);

      await slotRef.set({
        'earnings': FieldValue.increment(earnings),
        'ordersCompleted': FieldValue.increment(ordersCompleted),
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));

      debugPrint('Slot earnings updated: +$earnings, +$ordersCompleted orders');
    } catch (e) {
      debugPrint('Error updating slot earnings: $e');
    }
  }

  /// Complete slot (end of shift)
  static Future<void> completeSlot({
    required String partnerId,
    required DateTime day,
  }) async {
    try {
      final date = dateKey(day);
      final slotRef = _slotsCollection(partnerId).doc(date);

      await slotRef.update({
        'status': 'completed',
        'completedAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });

      debugPrint('Slot completed for $date');
    } catch (e) {
      debugPrint('Error completing slot: $e');
    }
  }

  /// Check if slot is booked
  static Future<bool> isSlotBooked({
    required String partnerId,
    required String slotId,
    required DateTime day,
  }) async {
    try {
      final doc = await _db
          .collection(FirestorePaths.deliveryPartners)
          .doc(partnerId)
          .get();

      if (!doc.exists) return false;

      final data = doc.data();
      final bookedSlots = data?['bookedSlots'] as List? ?? [];
      final date = dateKey(day);

      return bookedSlots.any((slot) {
        return slot['slotId'] == slotId && slot['date'] == date;
      });
    } catch (e) {
      debugPrint('Error checking if slot is booked: $e');
      return false;
    }
  }

  /// Get all booked slots for partner
  static Future<List<Map<String, dynamic>>> getBookedSlots({
    required String partnerId,
  }) async {
    try {
      final doc = await _db
          .collection(FirestorePaths.deliveryPartners)
          .doc(partnerId)
          .get();

      if (!doc.exists) return [];

      final data = doc.data();
      final bookedSlots = data?['bookedSlots'] as List? ?? [];

      return bookedSlots
          .map((slot) => Map<String, dynamic>.from(slot as Map))
          .toList();
    } catch (e) {
      debugPrint('Error getting booked slots: $e');
      return [];
    }
  }
}
