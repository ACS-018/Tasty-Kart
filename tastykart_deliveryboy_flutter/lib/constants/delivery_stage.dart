/// Partner-only trip phase stored on existing `orders/{id}` (`deliveryStage`).
class DeliveryStage {
  DeliveryStage._();

  static const toRestaurant = 'to_restaurant';
  static const preparing = 'preparing';
  static const pickup = 'pickup';
  static const toCustomer = 'to_customer';
  static const arrivedCustomer = 'arrived_customer';
}
