import 'package:flutter/material.dart';

import '../../constants/color_constants.dart';
import '../../constants/legal_content.dart';
import '../../services/auth_service.dart';
import '../../services/delivery_partner_service.dart';
import '../../utils/app_feedback.dart';
import '../../utils/responsive.dart';
import 'components/onboarding_scaffold.dart';
import 'components/onboarding_title_block.dart';

class LegalContentScreen extends StatefulWidget {
  const LegalContentScreen({
    super.key,
    required this.page,
    this.isLastPage = false,
  });

  final LegalPage page;
  final bool isLastPage;

  @override
  State<LegalContentScreen> createState() => _LegalContentScreenState();
}

class _LegalContentScreenState extends State<LegalContentScreen> {
  bool _isLoading = false;
  bool _leaving = false;

  Future<void> _onBack() async {
    if (_isLoading || _leaving) return;
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
      return;
    }
    final user = AuthService.currentUser;
    if (user == null) return;

    setState(() => _leaving = true);
    try {
      final partnerId = await DeliveryPartnerService.docIdFor(user);
      await DeliveryPartnerService.stepBackFromLegalPage(
        partnerId: partnerId,
        pageId: widget.page.id,
      );
    } catch (_) {
      if (!mounted) return;
      AppFeedback.showError(context, 'Could not go back. Try again.');
    } finally {
      if (mounted) setState(() => _leaving = false);
    }
  }

  Future<void> _onNext() async {
    if (_leaving) return;
    final user = AuthService.currentUser;
    if (user == null) {
      AppFeedback.showError(context, 'Please sign in again');
      return;
    }
    setState(() => _isLoading = true);
    try {
      final partnerId = await DeliveryPartnerService.docIdFor(user);
      await DeliveryPartnerService.acceptLegalPage(
        partnerId: partnerId,
        pageId: widget.page.id,
        completeTerms: widget.isLastPage,
      );
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
    final page = widget.page;

    return OnboardingScaffold(
      buttonLabel: 'Next',
      isLoading: _isLoading || _leaving,
      buttonEnabled: !_leaving,
      onPressed: _onNext,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          OnboardingTitleBlock(
            title: page.title,
            subtitle: page.subtitle,
            showBack: true,
            onBack: _onBack,
          ),
          SizedBox(
            height: r.responsive(mobile: 20.0, tablet: 24.0, desktop: 28.0),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: EdgeInsets.zero,
              child: _LegalCard(page: page),
            ),
          ),
        ],
      ),
    );
  }
}

class _LegalCard extends StatelessWidget {
  const _LegalCard({required this.page});

  final LegalPage page;

  @override
  Widget build(BuildContext context) {
    final r = Responsive.of(context);
    final bodySize = r.responsive(mobile: 13.0, tablet: 14.0, desktop: 15.0);
    final headingSize = r.responsive(mobile: 14.0, tablet: 15.0, desktop: 16.0);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 18),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.divider),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < page.sections.length; i++) ...[
            if (i > 0) const SizedBox(height: 16),
            if (page.sections[i].heading != null) ...[
              Text(
                page.sections[i].heading!,
                style: TextStyle(
                  fontSize: headingSize,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textDark,
                ),
              ),
              const SizedBox(height: 8),
            ],
            for (final bullet in page.sections[i].bullets)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Padding(
                      padding: EdgeInsets.only(top: 7),
                      child: Icon(
                        Icons.circle,
                        size: 6,
                        color: AppColors.textDark,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        bullet,
                        style: TextStyle(
                          fontSize: bodySize,
                          height: 1.45,
                          color: AppColors.textDark,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ],
      ),
    );
  }
}
