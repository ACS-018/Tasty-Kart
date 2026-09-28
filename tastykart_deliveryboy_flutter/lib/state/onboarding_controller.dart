import 'package:flutter/material.dart';

/// Holds in-progress onboarding fields before they are written to Firestore.
class OnboardingController extends ChangeNotifier {
  String phone = '';
  String city = '';
  String fullName = '';
  String dateOfBirth = '';
  String gender = '';

  void setPhone(String value) {
    phone = value.trim();
    notifyListeners();
  }

  void setCity(String value) {
    city = value;
    notifyListeners();
  }

  void setPersonalDetails({
    required String name,
    required String dob,
    required String selectedGender,
  }) {
    fullName = name.trim();
    dateOfBirth = dob.trim();
    gender = selectedGender;
    notifyListeners();
  }

  void clear() {
    phone = '';
    city = '';
    fullName = '';
    dateOfBirth = '';
    gender = '';
    notifyListeners();
  }
}

class OnboardingScope extends InheritedNotifier<OnboardingController> {
  const OnboardingScope({
    super.key,
    required OnboardingController controller,
    required super.child,
  }) : super(notifier: controller);

  static OnboardingController of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<OnboardingScope>();
    assert(scope != null, 'OnboardingScope not found');
    return scope!.notifier!;
  }

  static OnboardingController? maybeOf(BuildContext context) {
    return context
        .dependOnInheritedWidgetOfExactType<OnboardingScope>()
        ?.notifier;
  }
}
