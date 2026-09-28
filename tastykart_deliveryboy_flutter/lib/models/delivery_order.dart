import 'package:cloud_firestore/cloud_firestore.dart';

import '../constants/delivery_stage.dart';

/// Admin `orders/{id}` fields used by the delivery partner app.
class DeliveryOrder {
  final String id;
  final String orderNumber;
  final String customerId;
  final String customerName;
  final String customerPhone;
  final String restaurantId;
  final String restaurantName;
  final String restaurantAddress;
  final String restaurantPhone;
  final String status;
  final String deliveryPartnerId;
  final String deliveryPartnerName;
  final bool partnerAccepted;
  final String deliveryStage;
  final String pickupCode;
  final int deliveryFee;
  final int total;
  final String address;
  final double pickupKm;
  final double dropKm;
  final double? destLat;
  final double? destLng;
  final double? restaurantLat;
  final double? restaurantLng;
  final String paymentMethod;
  final String addressLabel;
  final String addressLandmark;
  final String addressCity;
  final String cancelReason;
  final String cancelPhase;
  final String cancelledBy;
  final String collectedVia;
  final String deniedPartnerId;
  final bool multiPickup;
  final DateTime? createdAt;
  final DateTime? pickedAt;
  final DateTime? deliveredAt;

  /// Partners excluded from receiving this order again (transferred + denied).
  /// Written to Firestore as `excludedPartnerIds` (list of partner IDs).
  final List<String> excludedPartnerIds;

  /// 4-digit OTP the customer must show to the delivery partner at drop-off.
  /// Written by the user app into Firestore as `deliveryOtp`.
  final String deliveryOtp;

  /// Tip the customer added for the delivery partner.
  /// Written by the user app into Firestore as `tip`.
  final int tip;

  const DeliveryOrder({
    required this.id,
    this.orderNumber = '',
    this.customerId = '',
    this.customerName = '',
    this.customerPhone = '',
    this.restaurantId = '',
    this.restaurantName = '',
    this.restaurantAddress = '',
    this.restaurantPhone = '',
    this.status = '',
    this.deliveryPartnerId = '',
    this.deliveryPartnerName = '',
    this.partnerAccepted = false,
    this.deliveryStage = '',
    this.pickupCode = '',
    this.deliveryFee = 0,
    this.total = 0,
    this.address = '',
    this.pickupKm = 0,
    this.dropKm = 0,
    this.destLat,
    this.destLng,
    this.restaurantLat,
    this.restaurantLng,
    this.paymentMethod = '',
    this.addressLabel = '',
    this.addressLandmark = '',
    this.addressCity = '',
    this.cancelReason = '',
    this.cancelPhase = '',
    this.cancelledBy = '',
    this.collectedVia = '',
    this.deniedPartnerId = '',
    this.multiPickup = false,
    this.createdAt,
    this.pickedAt,
    this.deliveredAt,
    this.excludedPartnerIds = const [],
    this.deliveryOtp = '',
    this.tip = 0,
  });

  String get statusValue => status.toLowerCase().trim();

  bool get isDelivered => statusValue == 'delivered';

  bool get isCancelled =>
      statusValue == 'cancelled' || statusValue == 'refunded';

  bool get isIncoming {
    if (partnerAccepted) return false;
    return statusValue == 'accepted' ||
        statusValue == 'preparing' ||
        statusValue == 'pending' ||
        statusValue == 'placed';
  }

  /// Whether this order should appear as an incoming assignment for [partnerId].
  /// Returns false if the partner previously transferred or rejected the order
  /// (i.e. they are in [excludedPartnerIds] or [deniedPartnerId]).
  bool isIncomingFor(String partnerId) {
    if (!isIncoming) return false;
    if (excludedPartnerIds.contains(partnerId)) return false;
    if (deniedPartnerId == partnerId && deniedPartnerId.isNotEmpty) {
      return false;
    }
    return true;
  }

  bool get isActiveTrip => partnerAccepted && !isDelivered && !isCancelled;

  String get resolvedStage {
    if (deliveryStage.isNotEmpty) return deliveryStage;
    if (statusValue == 'picked') return DeliveryStage.toCustomer;
    return DeliveryStage.toRestaurant;
  }

  int get payout => (deliveryFee > 0 ? deliveryFee : total) + tip;

  String get totalDistanceLabel {
    final sum = pickupKm + dropKm;
    if (sum <= 0) return '';
    return '${sum.toStringAsFixed(1)} Km Away';
  }

  String get displayOrderNumber {
    final n = orderNumber.isEmpty ? id : orderNumber;
    return n.startsWith('#') ? n : '#$n';
  }

  String get expectedPickupCode {
    if (pickupCode.length == 4) return pickupCode;
    final digits = orderNumber.replaceAll(RegExp(r'\D'), '');
    if (digits.length >= 4) return digits.substring(digits.length - 4);
    return '';
  }

  String get addressPrimary {
    if (addressLabel.isNotEmpty) return addressLabel;
    if (address.isEmpty) return 'Delivery address';
    return address.split(',').first.trim();
  }

  String get addressSecondary {
    final parts = <String>[
      if (addressLandmark.isNotEmpty) addressLandmark,
      if (addressCity.isNotEmpty) addressCity,
    ];
    if (parts.isNotEmpty) return parts.join(', ');
    final segs = address
        .split(',')
        .map((e) => e.trim())
        .where((e) => e.isNotEmpty)
        .toList();
    if (segs.length > 1) return segs.sublist(1).join(', ');
    return '';
  }

  DateTime get sortTime =>
      deliveredAt ??
      pickedAt ??
      createdAt ??
      DateTime.fromMillisecondsSinceEpoch(0);

  double get tripKm {
    final sum = pickupKm + dropKm;
    return sum < 0 ? 0 : sum;
  }

  int get collectedMoney {
    if (!isDelivered) return 0;
    if (isOnlinePaid) return 0;
    if (collectedVia.isEmpty) return 0;
    return total;
  }

  int get tripMinutes {
    if (pickedAt != null && deliveredAt != null) {
      return deliveredAt!
          .difference(pickedAt!)
          .inMinutes
          .abs()
          .clamp(1, 24 * 60);
    }
    if (createdAt != null && deliveredAt != null) {
      return deliveredAt!
          .difference(createdAt!)
          .inMinutes
          .abs()
          .clamp(1, 24 * 60);
    }
    return 25;
  }

  bool get isDenied {
    final reason = cancelReason.toLowerCase();
    return reason.contains('denied') || reason.contains('reject');
  }

  bool deniedBy(String partnerId) =>
      partnerId.isNotEmpty && deniedPartnerId == partnerId;

  bool get isSpilled {
    final reason = cancelReason.toLowerCase();
    return reason.contains('spilled') ||
        reason.contains('damaged') ||
        reason.contains('leaking');
  }

  bool get isFoodNotDelivered {
    if (!isCancelled || isSpilled) return false;
    final reason = cancelReason.toLowerCase();
    return cancelPhase == 'customer' ||
        reason.contains('unable to reach') ||
        reason.contains('not available') ||
        reason.contains('not delivered') ||
        reason.contains('customer');
  }

  bool get isHistoryItem => isDelivered || isCancelled;

  String get dropStopName {
    if (customerName.isNotEmpty) return customerName;
    if (addressPrimary.isNotEmpty) return addressPrimary;
    return 'Customer';
  }

  bool get isOnlinePaid {
    final value = paymentMethod.toLowerCase();
    if (value.contains('cash') || value.contains('cod')) return false;
    return value.contains('razorpay') ||
        value.contains('online') ||
        value.contains('upi') ||
        value.contains('paid') ||
        value.contains('card') ||
        value.contains('gpay') ||
        value.contains('phonepe') ||
        value.contains('paytm');
  }

  factory DeliveryOrder.fromDoc(DocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>? ?? {};
    DateTime? created = _asDate(d['createdAt']);

    final delivery = d['deliveryAddress'];
    var address = d['address']?.toString() ?? '';
    var addressLabel = '';
    var addressLandmark = '';
    var addressCity = '';
    double? destLat;
    double? destLng;
    if (delivery is Map) {
      if (address.isEmpty) {
        address = (delivery['fullAddress'] ?? delivery['address'] ?? '')
            .toString();
      }
      addressLabel = (delivery['label'] ?? '').toString();
      addressLandmark = (delivery['landmark'] ?? '').toString();
      addressCity = (delivery['city'] ?? '').toString();
      destLat = _asDouble(delivery['lat']);
      destLng = _asDouble(delivery['lng']);
    }
    destLat ??= _asDouble(d['destLat'] ?? d['customerLat']);
    destLng ??= _asDouble(d['destLng'] ?? d['customerLng']);

    return DeliveryOrder(
      id: d['id'] as String? ?? doc.id,
      orderNumber: d['orderNumber']?.toString() ?? doc.id,
      customerId: d['customerId']?.toString() ?? d['userId']?.toString() ?? '',
      customerName: d['customerName']?.toString() ?? '',
      customerPhone: d['customerPhone']?.toString() ?? '',
      restaurantId: d['restaurantId']?.toString() ?? '',
      restaurantName: d['restaurantName']?.toString() ?? '',
      restaurantAddress: d['restaurantAddress']?.toString() ?? '',
      restaurantPhone: d['restaurantPhone']?.toString() ?? '',
      status: (d['status'] ?? d['orderStatus'] ?? '').toString(),
      deliveryPartnerId: (d['deliveryPartnerId'] ?? d['riderId'] ?? '')
          .toString(),
      deliveryPartnerName: d['deliveryPartnerName']?.toString() ?? '',
      partnerAccepted: d['partnerAccepted'] == true,
      deliveryStage: d['deliveryStage']?.toString() ?? '',
      pickupCode: d['pickupCode']?.toString() ?? '',
      deliveryFee: (d['deliveryFee'] as num? ?? 0).toInt(),
      total: (d['total'] as num? ?? d['grandTotal'] as num? ?? 0).toInt(),
      address: address,
      pickupKm: (d['pickupKm'] as num? ?? 0).toDouble(),
      dropKm: (d['dropKm'] as num? ?? 0).toDouble(),
      destLat: destLat,
      destLng: destLng,
      restaurantLat: _asDouble(d['restaurantLat']),
      restaurantLng: _asDouble(d['restaurantLng']),
      paymentMethod: d['paymentMethod']?.toString() ?? '',
      addressLabel: addressLabel,
      addressLandmark: addressLandmark,
      addressCity: addressCity,
      cancelReason: d['cancelReason']?.toString() ?? '',
      cancelPhase: d['cancelPhase']?.toString() ?? '',
      cancelledBy: d['cancelledBy']?.toString() ?? '',
      collectedVia: d['collectedVia']?.toString() ?? '',
      deniedPartnerId: d['deniedPartnerId']?.toString() ?? '',
      multiPickup: d['multiPickup'] == true || d['multiPicking'] == true,
      createdAt: created,
      pickedAt: _asDate(d['pickedAt']),
      deliveredAt: _asDate(d['deliveredAt']),
      excludedPartnerIds: List<String>.from(
        (d['excludedPartnerIds'] as List? ?? []).map((e) => e.toString()),
      ),
      deliveryOtp: d['deliveryOtp']?.toString() ?? '',
      tip: (d['tip'] as num? ?? 0).toInt(),
    );
  }

  static DateTime? _asDate(dynamic raw) {
    if (raw is Timestamp) return raw.toDate();
    return null;
  }

  static double? _asDouble(dynamic value) {
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value);
    return null;
  }
}
