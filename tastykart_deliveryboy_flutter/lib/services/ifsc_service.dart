import 'dart:convert';

import 'package:http/http.dart' as http;

class IfscLookup {
  const IfscLookup({required this.bank, required this.branch});

  final String bank;
  final String branch;
}

class IfscService {
  IfscService._();

  static final _pattern = RegExp(r'^[A-Z]{4}0[A-Z0-9]{6}$');

  static bool isValidFormat(String ifsc) {
    return _pattern.hasMatch(ifsc.trim().toUpperCase());
  }

  /// Public Razorpay IFSC directory — no new backend.
  static Future<IfscLookup> verify(String ifsc) async {
    final code = ifsc.trim().toUpperCase();
    if (!isValidFormat(code)) {
      throw const FormatException('Enter a valid 11-character IFSC');
    }
    final response = await http.get(
      Uri.parse('https://ifsc.razorpay.com/$code'),
    );
    if (response.statusCode != 200) {
      throw Exception('Could not verify this IFSC');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return IfscLookup(
      bank: data['BANK']?.toString() ?? '',
      branch: data['BRANCH']?.toString() ?? '',
    );
  }
}
