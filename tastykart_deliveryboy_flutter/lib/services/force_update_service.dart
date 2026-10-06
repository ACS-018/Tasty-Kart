import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../constants/color_constants.dart';
import '../utils/app_navigation.dart';
import 'firestore_paths.dart';

/// Force-update guard for the TastyKart delivery partner app.
///
/// How it works:
///   1. On startup it subscribes to `settings/admin` with a **live stream**.
///      Every time the admin changes `appVersions.deliveryApp.minBuild` the
///      change is pushed to ALL running app instances immediately.
///   2. The update screen is a full-screen route with an empty back-stack —
///      the user cannot navigate back or dismiss it.
///   3. `onPopInvokedWithResult` sends the app to background if the system
///      tries to pop the route.
///
/// Usage — call [ForceUpdateService.start] once from the root [initState].
class ForceUpdateService with WidgetsBindingObserver {
  ForceUpdateService._();

  static final _instance = ForceUpdateService._();

  static bool _started = false;
  static StreamSubscription<DocumentSnapshot>? _sub;
  static bool _updateScreenShown = false;

  // ── Public API ─────────────────────────────────────────────────────────────

  /// Call exactly once from the root widget's [initState].
  static Future<void> start() async {
    if (_started) return;
    _started = true;

    WidgetsBinding.instance.addObserver(_instance);

    final info = await PackageInfo.fromPlatform();
    final currentBuild = int.tryParse(info.buildNumber) ?? 0;
    final currentVersion = '${info.version}+${info.buildNumber}';

    debugPrint('[ForceUpdate] installed build=$currentBuild ($currentVersion)');

    _sub = FirebaseFirestore.instance
        .collection(FirestorePaths.settings)
        .doc(FirestorePaths.settingsAdminDoc)
        .snapshots()
        .listen(
          (snap) => _instance._onSettingsSnapshot(
            snap,
            currentBuild: currentBuild,
            currentVersion: currentVersion,
          ),
          onError: (e) => debugPrint('[ForceUpdate] stream error: $e'),
        );
  }

  // ── WidgetsBindingObserver ─────────────────────────────────────────────────

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _updateScreenShown) {
      final ctx = AppNavigation.rootNavigatorKey.currentContext;
      if (ctx != null) {
        // ignore: use_build_context_synchronously
        final route = ModalRoute.of(ctx);
        final onUpdateScreen = route?.settings.name == '/force-update';
        if (!onUpdateScreen) {
          _instance._pushUpdateScreenIfNeeded(ctx, currentVersion: '');
        }
      }
    }
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  void _onSettingsSnapshot(
    DocumentSnapshot snap, {
    required int currentBuild,
    required String currentVersion,
  }) {
    if (!snap.exists) return;
    final data = snap.data() as Map<String, dynamic>? ?? {};

    final appVersions = data['appVersions'];
    if (appVersions is! Map) return;

    final deliveryApp = appVersions['deliveryApp'];
    if (deliveryApp is! Map) return;

    final minBuild = (deliveryApp['minBuild'] as num?)?.toInt() ?? 0;
    final minVersionName =
        (deliveryApp['minVersionName'] as String?)?.trim() ?? '';
    final playStoreUrl = (deliveryApp['playStoreUrl'] as String?)?.trim() ?? '';

    debugPrint(
      '[ForceUpdate] snapshot → minBuild=$minBuild currentBuild=$currentBuild',
    );

    if (minBuild <= 0 || currentBuild >= minBuild) {
      _updateScreenShown = false;
      debugPrint('[ForceUpdate] no update required');
      return;
    }

    if (_updateScreenShown) return;

    // Defer navigation to the next frame to avoid "dirty widget in wrong
    // build scope" when the first snapshot arrives during initState.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx = AppNavigation.rootNavigatorKey.currentContext;
      if (ctx == null) {
        Future<void>.delayed(const Duration(milliseconds: 600), () {
          final ctx2 = AppNavigation.rootNavigatorKey.currentContext;
          if (ctx2 != null) {
            _pushUpdateScreenIfNeeded(
              ctx2,
              currentVersion: currentVersion,
              minVersionName: minVersionName,
              playStoreUrl: playStoreUrl,
            );
          }
        });
        return;
      }
      _pushUpdateScreenIfNeeded(
        ctx,
        currentVersion: currentVersion,
        minVersionName: minVersionName,
        playStoreUrl: playStoreUrl,
      );
    });
  }

  void _pushUpdateScreenIfNeeded(
    BuildContext context, {
    required String currentVersion,
    String minVersionName = '',
    String playStoreUrl = '',
  }) {
    _updateScreenShown = true;
    // ignore: use_build_context_synchronously
    Navigator.of(context, rootNavigator: true).pushAndRemoveUntil(
      PageRouteBuilder<void>(
        settings: const RouteSettings(name: '/force-update'),
        pageBuilder: (_, __, ___) => _ForceUpdateScreen(
          currentVersion: currentVersion,
          requiredVersionName: minVersionName,
          playStoreUrl: playStoreUrl,
        ),
        transitionsBuilder: (_, anim, __, child) =>
            FadeTransition(opacity: anim, child: child),
      ),
      (_) => false,
    );
  }
}

// ── Full-screen update screen ─────────────────────────────────────────────────

class _ForceUpdateScreen extends StatelessWidget {
  const _ForceUpdateScreen({
    required this.currentVersion,
    required this.requiredVersionName,
    required this.playStoreUrl,
  });

  final String currentVersion;
  final String requiredVersionName;
  final String playStoreUrl;

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        SystemNavigator.pop();
      },
      child: Scaffold(
        backgroundColor: AppColors.white,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Spacer(),
                Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.system_update_rounded,
                    size: 52,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(height: 32),
                const Text(
                  'Update Required',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textDark,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  requiredVersionName.isNotEmpty
                      ? 'Version $requiredVersionName is required to continue using TastyKart Delivery. Please update now.'
                      : 'A newer version of TastyKart Delivery is required. Please update to continue.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 15,
                    color: Color(0xFF6B7280),
                    height: 1.6,
                  ),
                ),
                if (currentVersion.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Your version: $currentVersion',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF9CA3AF),
                    ),
                  ),
                ],
                const Spacer(),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: playStoreUrl.isEmpty
                        ? null
                        : () async {
                            final uri = Uri.tryParse(playStoreUrl);
                            if (uri != null && await canLaunchUrl(uri)) {
                              await launchUrl(
                                uri,
                                mode: LaunchMode.externalApplication,
                              );
                            }
                          },
                    icon: const Icon(Icons.open_in_new_rounded, size: 20),
                    label: const Text(
                      'Update on Play Store',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: AppColors.white,
                      minimumSize: const Size.fromHeight(54),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                      elevation: 0,
                    ),
                  ),
                ),
                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
