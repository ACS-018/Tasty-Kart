import 'package:flutter/material.dart';

/// Holds in-progress onboarding fields before they are written to Firestore.
class OnboardingController extends ChangeNotifier {
  String phone = '';
  String city = '';
  String fullName = '';
  String dateOfBirth = '';
  String gender = '';
  String vehicle = '';

  /// Prefer in-session draft, then saved partner profile.
  static String pickDraft(String draft, String saved) {
    final d = draft.trim();
    if (d.isNotEmpty) return d;
    return saved.trim();
  }

  void setPhone(String value) {
    phone = value.trim();
    notifyListeners();
  }

  void setCity(String value) {
    city = value.trim();
    notifyListeners();
  }

  void setPersonalDetails({
    required String name,
    required String dob,
    required String selectedGender,
  }) {
    fullName = name.trim();
    dateOfBirth = dob.trim();
    gender = selectedGender.trim();
    notifyListeners();
  }

  void setVehicle(String value) {
    vehicle = value.trim();
    notifyListeners();
  }

  void clear() {
    phone = '';
    city = '';
    fullName = '';
    dateOfBirth = '';
    gender = '';
    vehicle = '';
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
