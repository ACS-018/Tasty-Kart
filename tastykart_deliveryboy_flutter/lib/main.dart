import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:firebase_performance/firebase_performance.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'constants/app_constants.dart';
import 'constants/color_constants.dart';
import 'screens/auth_gate.dart';
import 'services/fcm_service.dart';
import 'state/onboarding_controller.dart';
import 'utils/app_navigation.dart';

/// Background message handler - must be top-level function
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  debugPrint('Handling background message: ${message.messageId}');
}

/// Global notification plugin instance
final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
    FlutterLocalNotificationsPlugin();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Firebase
  await Firebase.initializeApp();

  // Enable Firestore offline persistence
  FirebaseFirestore.instance.settings = const Settings(
    persistenceEnabled: true,
    cacheSizeBytes: Settings.CACHE_SIZE_UNLIMITED,
  );

  // Initialize Firebase Performance Monitoring
  FirebasePerformance.instance.setPerformanceCollectionEnabled(true);

  // Initialize Firebase Analytics
  await FirebaseAnalytics.instance.setAnalyticsCollectionEnabled(true);

  // Configure Crashlytics
  FlutterError.onError = (errorDetails) {
    FirebaseCrashlytics.instance.recordFlutterFatalError(errorDetails);
  };

  // Pass all uncaught asynchronous errors to Crashlytics
  PlatformDispatcher.instance.onError = (error, stack) {
    FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
    return true;
  };

  // Initialize FCM background handler
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

  // Initialize local notifications
  const androidInitialize = AndroidInitializationSettings(
    '@mipmap/ic_launcher',
  );
  const initializationSettings = InitializationSettings(
    android: androidInitialize,
  );
  await flutterLocalNotificationsPlugin.initialize(
    initializationSettings,
    onDidReceiveNotificationResponse: (NotificationResponse response) {
      debugPrint('Notification tapped: ${response.payload}');
      if (response.payload != null) {
        FCMService.handleNotificationTap(response.payload!);
      }
    },
  );

  // Request notification permissions
  await FirebaseMessaging.instance.requestPermission(
    alert: true,
    announcement: false,
    badge: true,
    carPlay: false,
    criticalAlert: false,
    provisional: false,
    sound: true,
  );

  runApp(const TastyKartDeliveryApp());
}

class TastyKartDeliveryApp extends StatefulWidget {
  const TastyKartDeliveryApp({super.key});

  @override
  State<TastyKartDeliveryApp> createState() => _TastyKartDeliveryAppState();
}

class _TastyKartDeliveryAppState extends State<TastyKartDeliveryApp> {
  final OnboardingController _onboarding = OnboardingController();

  @override
  void dispose() {
    _onboarding.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return OnboardingScope(
      controller: _onboarding,
      child: MaterialApp(
        title: AppConstants.appName,
        navigatorKey: AppNavigation.rootNavigatorKey,
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: AppColors.primary,
            surface: AppColors.white,
          ),
          scaffoldBackgroundColor: AppColors.white,
          fontFamily: 'Roboto',
          useMaterial3: true,
          pageTransitionsTheme: const PageTransitionsTheme(
            builders: {
              TargetPlatform.android: CupertinoPageTransitionsBuilder(),
              TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
              TargetPlatform.macOS: CupertinoPageTransitionsBuilder(),
            },
          ),
        ),
        home: const AuthGate(),
      ),
    );
  }
}
