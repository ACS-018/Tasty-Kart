/// User-facing brand strings (launcher name, UI copy).
class AppConstants {
  AppConstants._();

  /// Display name under the icon and in user-visible UI.
  static const String appName = 'TastyKart';

  static const String tagline = 'Deliver Happiness';
  static const String earnLine = 'Earn On Your Terms';
  static const String readyLine = 'Ready To Deliver Happiness';

  static const int dailyTarget = 2000;

  static const List<IncentiveSlot> incentiveSlots = [
    IncentiveSlot(trips: 15, amount: 110),
    IncentiveSlot(trips: 22, amount: 170),
    IncentiveSlot(trips: 25, amount: 225),
    IncentiveSlot(trips: 35, amount: 450),
  ];

  static const List<String> cities = [
    'Bangalore',
    'Mumbai',
    'Delhi',
    'Kolkata',
    'Hyderabad',
    'Chennai',
  ];

  static const List<String> genders = ['Male', 'Female', 'Others'];

  static const List<VehicleOption> vehicles = [
    VehicleOption(id: 'bike', label: 'Bike', icon: 'two_wheeler'),
    VehicleOption(id: 'scooter', label: 'Scooter', icon: 'moped'),
    VehicleOption(id: 'bicycle', label: 'Bicycle', icon: 'pedal_bike'),
    VehicleOption(id: 'electric_scotty', label: 'Electric Scotty', icon: 'electric_scooter'),
    VehicleOption(id: 'walk', label: 'Walk', icon: 'directions_walk'),
  ];

  static const List<PartnerDocumentType> documents = [
    PartnerDocumentType(
      id: 'aadharFront',
      title: 'Aadhar Card',
      subtitle: 'Upload Front Side',
      fileName: 'aadhar_front.jpg',
    ),
    PartnerDocumentType(
      id: 'aadharBack',
      title: 'Aadhar Card',
      subtitle: 'Upload Back Side',
      fileName: 'aadhar_back.jpg',
    ),
    PartnerDocumentType(
      id: 'panFront',
      title: 'PAN Card',
      subtitle: 'Upload Front Side',
      fileName: 'pan_front.jpg',
    ),
    PartnerDocumentType(
      id: 'drivingLicenseFront',
      title: 'Driving License',
      subtitle: 'Upload Front Side',
      fileName: 'driving_license.jpg',
    ),
    PartnerDocumentType(
      id: 'vehicleRcFront',
      title: 'Vehicle RC',
      subtitle: 'Upload Front Side',
      fileName: 'vehicle_rc.jpg',
    ),
    PartnerDocumentType(
      id: 'insuranceFront',
      title: 'Insurance',
      subtitle: 'Upload Front Side',
      fileName: 'insurance.jpg',
    ),
    PartnerDocumentType(
      id: 'profilePhoto',
      title: 'Profile Photo',
      subtitle: 'Take A Clear Photo',
      fileName: 'profile.jpg',
      preferCamera: true,
    ),
  ];

  static const List<TrainingModule> trainingModules = [
    TrainingModule(
      id: 'safety',
      title: 'Safety Guidelines',
      body:
          'Wear a helmet when riding. Follow traffic rules, avoid rash driving, and never use your phone while on the road. Keep the food bag sealed and upright so the order stays safe until handover.',
    ),
    TrainingModule(
      id: 'pickup',
      title: 'Order Pickup Process',
      body:
          'Reach the restaurant on time, share the order ID at the counter, check items against the bill, and confirm packing before you leave. Mark pickup in the app only after you have the order.',
    ),
    TrainingModule(
      id: 'delivery',
      title: 'Delivery Process',
      body:
          'Follow the map to the customer, call if you cannot find the address, and hand over the order politely. Collect cash for COD orders and mark delivered only after the customer has received the food.',
    ),
    TrainingModule(
      id: 'behaviour',
      title: 'Customer Behaviour',
      body:
          'Be polite, wait a few minutes if needed, and never argue. If there is an issue with the order, contact support instead of leaving. Your rating depends on how you treat every customer.',
    ),
    TrainingModule(
      id: 'privacy',
      title: 'Privacy & Policy',
      body:
          'Do not share customer phone numbers, addresses, or order details with anyone. Use customer data only to complete the delivery. Report any app or safety issue to TastyKart support.',
    ),
  ];
}

class VehicleOption {
  const VehicleOption({
    required this.id,
    required this.label,
    required this.icon,
  });

  final String id;
  final String label;
  final String icon;
}

class PartnerDocumentType {
  const PartnerDocumentType({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.fileName,
    this.preferCamera = false,
  });

  final String id;
  final String title;
  final String subtitle;
  final String fileName;
  final bool preferCamera;
}

class TrainingModule {
  const TrainingModule({
    required this.id,
    required this.title,
    required this.body,
  });

  final String id;
  final String title;
  final String body;
}

class IncentiveSlot {
  const IncentiveSlot({required this.trips, required this.amount});

  final int trips;
  final int amount;
}

