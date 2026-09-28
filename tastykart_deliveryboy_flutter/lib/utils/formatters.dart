String greetingFor(DateTime now) {
  final hour = now.hour;
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

String rupee(num amount) {
  if (amount == amount.roundToDouble()) return '₹${amount.round()}';
  return '₹${amount.toStringAsFixed(0)}';
}

String rupeeSigned(num amount) {
  if (amount < 0) return '-₹${amount.abs().round()}';
  if (amount > 0) return '+₹${amount.round()}';
  return '₹0';
}

const _monthsShort = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const _monthsLong = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

String formatDayMonth(DateTime d) =>
    '${d.day.toString().padLeft(2, '0')} ${_monthsShort[d.month - 1]}';

String formatDayMonthYear(DateTime d) =>
    '${d.day.toString().padLeft(2, '0')} ${_monthsShort[d.month - 1]} ${d.year.toString().substring(2)}';

String formatMonthYear(DateTime d) => '${_monthsLong[d.month - 1]} ${d.year}';

String formatHoursPad(int hours) => hours.abs().toString().padLeft(2, '0');

String formatDistanceStat(double km) {
  if (km <= 0) return '00';
  if (km == km.roundToDouble()) return km.round().toString();
  return km.toStringAsFixed(1);
}

String formatTimeAmPm(DateTime d) {
  final period = d.hour >= 12 ? 'PM' : 'AM';
  final hour = d.hour % 12 == 0 ? 12 : d.hour % 12;
  final minute = d.minute.toString().padLeft(2, '0');
  return '$hour:$minute $period';
}

String formatDayTime(DateTime d) => '${formatDayMonth(d)}, ${formatTimeAmPm(d)}';

String formatWeekRange(DateTime now) {
  final start = DateTime(now.year, now.month, now.day)
      .subtract(Duration(days: now.weekday - 1));
  final end = start.add(const Duration(days: 6));
  return '${start.day} ${_monthsLong[start.month - 1]} - ${end.day} ${_monthsLong[end.month - 1]}';
}

String formatDurationHm(int minutes) {
  final safe = minutes < 0 ? 0 : minutes;
  final h = safe ~/ 60;
  final m = safe % 60;
  return '$h h ${m.toString().padLeft(2, '0')} Min';
}

String formatTimeAgo(DateTime? time) {
  if (time == null) return '';
  final diff = DateTime.now().difference(time);
  if (diff.inMinutes < 1) return 'Just Now';
  if (diff.inMinutes < 60) return '${diff.inMinutes} Min Ago';
  if (diff.inHours < 24) return '${diff.inHours} Hrs Ago';
  if (diff.inDays == 1) return '1 Day Ago';
  return '${diff.inDays} Days Ago';
}

DateTime startOfDay(DateTime d) => DateTime(d.year, d.month, d.day);

DateTime startOfWeek(DateTime d) =>
    startOfDay(d).subtract(Duration(days: d.weekday - 1));

DateTime startOfMonth(DateTime d) => DateTime(d.year, d.month, 1);

