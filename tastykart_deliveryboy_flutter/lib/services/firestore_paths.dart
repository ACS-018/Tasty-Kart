/// Collection / doc paths shared with TastyKart Admin.
/// Do **not** invent new top-level collections — admin CRUD + rules own these.
class FirestorePaths {
  FirestorePaths._();

  static const users = 'users';
  static const orders = 'orders';
  static const restaurants = 'restaurants';
  static const restaurantCategories = 'restaurantCategories';
  static const foodCategories = 'foodCategories';
  static const foodItems = 'foodItems';
  static const addons = 'addons';
  static const offers = 'offers';
  static const coupons = 'coupons';
  static const banners = 'banners';
  static const customers = 'customers';
  static const deliveryPartners = 'deliveryPartners';
  static const subscriptions = 'subscriptions';
  static const transactions = 'transactions';
  static const payoutRequests = 'payoutRequests';
  static const surgeRequests = 'surgeRequests';
  static const reviews = 'reviews';
  static const notifications = 'notifications';
  static const settings = 'settings';
  static const admins = 'admins';
  static const cities = 'cities';
  static const supportTickets = 'supportTickets';

  /// Single platform settings document written by Admin.
  static const settingsAdminDoc = 'admin';

  // ── Subcollections under deliveryPartners/{partnerId} ────────────────────

  /// Daily time slots for delivery partners.
  /// Document ID: Date in format YYYY-MM-DD
  static const partnerSlots = 'slots';

  /// Location history for tracking and dispute resolution.
  /// Document ID: Timestamp-based (auto-generated)
  static const partnerLocations = 'locations';

  // ── Helper path builders ──────────────────────────────────────────────────

  /// Build: deliveryPartners/{partnerId}
  static String partnerDoc(String partnerId) => '$deliveryPartners/$partnerId';

  /// Build: deliveryPartners/{partnerId}/slots/{date}
  static String partnerSlotDoc(String partnerId, String date) =>
      '$deliveryPartners/$partnerId/$partnerSlots/$date';

  /// Build: deliveryPartners/{partnerId}/locations
  static String partnerLocationsCol(String partnerId) =>
      '$deliveryPartners/$partnerId/$partnerLocations';

  /// Build: settings/admin
  static String get settingsDoc => '$settings/$settingsAdminDoc';
}
