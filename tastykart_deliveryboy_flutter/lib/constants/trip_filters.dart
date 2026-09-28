enum TripFilter {
  all,
  denials,
  cancellation,
  foodNotDelivered,
}

extension TripFilterX on TripFilter {
  String get label {
    switch (this) {
      case TripFilter.all:
        return 'All Trips';
      case TripFilter.denials:
        return 'Denials';
      case TripFilter.cancellation:
        return 'Cancellation';
      case TripFilter.foodNotDelivered:
        return 'Food Not Delivered';
    }
  }
}

class TripFilters {
  TripFilters._();

  static const values = TripFilter.values;
}
