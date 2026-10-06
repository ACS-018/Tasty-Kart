import 'package:flutter/material.dart';

import '../../constants/app_constants.dart';
import '../../constants/color_constants.dart';
import '../../services/auth_service.dart';
import '../../services/delivery_partner_service.dart';
import '../../services/settings_service.dart';
import '../../utils/app_feedback.dart';
import '../../utils/app_navigation.dart';
import '../../utils/responsive.dart';
import '../../widgets/onboarding_nav_tile.dart';
import 'components/onboarding_scaffold.dart';
import 'components/onboarding_title_block.dart';
import 'info_content_screen.dart';

class OnlineTrainingScreen extends StatefulWidget {
  const OnlineTrainingScreen({super.key, this.completedIds = const []});

  final List<String> completedIds;

  @override
  State<OnlineTrainingScreen> createState() => _OnlineTrainingScreenState();
}

class _OnlineTrainingScreenState extends State<OnlineTrainingScreen> {
  late Set<String> _done;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _done = {...widget.completedIds};
  }

  @override
  void didUpdateWidget(covariant OnlineTrainingScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.completedIds != widget.completedIds) {
      _done = {...widget.completedIds};
    }
  }

  Future<void> _openModule({
    required String id,
    required String title,
    required String body,
    required String videoUrl,
  }) async {
    final result = await AppNavigation.push<bool>(
      context,
      InfoContentScreen(title: title, body: body, videoUrl: videoUrl),
    );
    if (result != true) return;

    final user = AuthService.currentUser;
    if (user == null) return;
    setState(() => _done.add(id));
    try {
      final partnerId = await DeliveryPartnerService.docIdFor(user);
      await DeliveryPartnerService.markTrainingModule(
        partnerId: partnerId,
        moduleId: id,
      );
    } catch (_) {}
  }

  /// Goes back to BankDetailsScreen by clearing the bank-detail fields in
  /// Firestore.  AuthGate will re-route to BankDetailsScreen and pre-fill
  /// the form from the saved values, so no data is lost.
  Future<void> _goBack() async {
    final user = AuthService.currentUser;
    if (user == null) return;
    setState(() => _isLoading = true);
    try {
      final partnerId = await DeliveryPartnerService.docIdFor(user);
      await DeliveryPartnerService.clearBankDetails(partnerId: partnerId);
    } catch (_) {
      // Ignore — AuthGate will stay on training screen if the write fails.
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _onNext(List<_Module> modules) async {
    final allDone = modules.every((m) => _done.contains(m.id));
    if (!allDone) {
      AppFeedback.showError(context, 'Please complete all training modules');
      return;
    }
    final user = AuthService.currentUser;
    if (user == null) {
      AppFeedback.showError(context, 'Please sign in again');
      return;
    }
    setState(() => _isLoading = true);
    try {
      final partnerId = await DeliveryPartnerService.docIdFor(user);
      await DeliveryPartnerService.markTrainingComplete(partnerId: partnerId);
    } catch (e) {
      if (!mounted) return;
      AppFeedback.showError(context, AuthService.messageFromError(e));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = Responsive.of(context);

    return StreamBuilder<PlatformSettings>(
      stream: SettingsService.watchSettings(),
      builder: (context, snap) {
        // Resolve modules: prefer admin Firestore list, fall back to
        // AppConstants so the screen is never empty if settings haven't
        // loaded or admin hasn't configured any modules yet.
        final adminModules = snap.data?.deliveryPartner.trainingModules ?? [];
        final modules = adminModules.isNotEmpty
            ? adminModules
                  .map(
                    (m) => _Module(
                      id: m.id,
                      title: m.title,
                      body: m.body,
                      videoUrl: m.videoUrl,
                    ),
                  )
                  .toList()
            : AppConstants.trainingModules
                  .map((m) => _Module(id: m.id, title: m.title, body: m.body))
                  .toList();

        return OnboardingScaffold(
          buttonLabel: 'Next',
          isLoading: _isLoading,
          onPressed: () => _onNext(modules),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              OnboardingTitleBlock(
                title: 'Online Training',
                subtitle: 'Complete The Training To Learn About Delivery',
                showBack: true,
                onBack: _goBack,
              ),
              SizedBox(
                height: r.responsive(mobile: 12.0, tablet: 16.0, desktop: 20.0),
              ),
              Expanded(
                child: ListView.separated(
                  padding: EdgeInsets.zero,
                  itemCount: modules.length,
                  separatorBuilder: (_, __) =>
                      const Divider(height: 1, color: AppColors.divider),
                  itemBuilder: (context, index) {
                    final module = modules[index];
                    return OnboardingNavTile(
                      title: module.title,
                      completed: _done.contains(module.id),
                      onTap: () => _openModule(
                        id: module.id,
                        title: module.title,
                        body: module.body,
                        videoUrl: module.videoUrl,
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// Internal module representation — same fields whether from Firestore or fallback.
class _Module {
  final String id;
  final String title;
  final String body;
  final String videoUrl;
  const _Module({
    required this.id,
    required this.title,
    required this.body,
    this.videoUrl = '',
  });
}
