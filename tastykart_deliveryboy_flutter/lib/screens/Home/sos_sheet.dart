import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../constants/color_constants.dart';
import '../../global_widgets/app_button.dart';
import '../../services/delivery_partner_service.dart';
import '../../utils/app_feedback.dart';
import '../../widgets/app_radio_option.dart';

class SosSheet {
  SosSheet._();

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _SosSheetBody(),
    );
  }
}

class _SosSheetBody extends StatefulWidget {
  const _SosSheetBody();

  @override
  State<_SosSheetBody> createState() => _SosSheetBodyState();
}

class _SosSheetBodyState extends State<_SosSheetBody> {
  String _selected = 'ambulance';
  bool _loading = false;

  static const _options = [
    ('ambulance', 'Call Ambulance - For Medical Emergencies', '108'),
    ('helpline', 'Call Accident Helpline - Talk To Our Emergency Team', ''),
    ('police', 'Call Police - Report A Crime', '100'),
  ];

  Future<void> _confirm() async {
    setState(() => _loading = true);
    try {
      var number = _options.firstWhere((o) => o.$1 == _selected).$3;
      if (number.isEmpty) {
        number = await DeliveryPartnerService.supportPhone();
      }
      final uri = Uri(scheme: 'tel', path: number);
      final launched = await launchUrl(uri);
      if (!launched && mounted) {
        AppFeedback.showError(context, 'Could not open the phone dialer');
      } else if (mounted) {
        Navigator.pop(context);
      }
    } catch (_) {
      if (mounted) {
        AppFeedback.showError(context, 'Could not start the emergency call');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      child: Material(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final option in _options)
                AppRadioOption(
                  label: option.$2,
                  selected: _selected == option.$1,
                  onTap: () {
                    AppFeedback.selection();
                    setState(() => _selected = option.$1);
                  },
                ),
              const SizedBox(height: 12),
              AppButton(
                label: 'Confirm',
                isLoading: _loading,
                onPressed: _confirm,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
