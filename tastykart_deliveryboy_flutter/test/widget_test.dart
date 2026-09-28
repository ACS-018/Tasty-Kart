import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tastykart_deliveryboy/constants/app_constants.dart';
import 'package:tastykart_deliveryboy/screens/auth/welcome_screen.dart';

void main() {
  testWidgets('Welcome screen shows TastyKart branding', (tester) async {
    await tester.pumpWidget(
      MaterialApp(home: WelcomeScreen(onContinue: () {})),
    );

    expect(find.text(AppConstants.appName), findsWidgets);
    expect(find.text(AppConstants.tagline), findsOneWidget);
    expect(find.text(AppConstants.earnLine), findsOneWidget);
  });
}
