class BookedSlot {
  const BookedSlot({required this.slotId, required this.date});

  final String slotId;
  final String date;

  Map<String, String> toMap() => {'slotId': slotId, 'date': date};

  factory BookedSlot.fromMap(Map<String, dynamic> map) {
    return BookedSlot(
      slotId: map['slotId']?.toString() ?? '',
      date: map['date']?.toString() ?? '',
    );
  }
}
