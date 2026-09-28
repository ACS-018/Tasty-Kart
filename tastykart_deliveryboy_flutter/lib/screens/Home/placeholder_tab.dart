import 'package:flutter/material.dart';

import '../../constants/color_constants.dart';
import '../../widgets/async_state_message.dart';

class PlaceholderTab extends StatelessWidget {
  const PlaceholderTab({
    super.key,
    required this.title,
    required this.icon,
  });

  final String title;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: AppColors.surface,
      child: Column(
        children: [
          Container(
            width: double.infinity,
            color: AppColors.primary,
            padding: EdgeInsets.only(
              top: MediaQuery.paddingOf(context).top + 16,
              left: 20,
              right: 20,
              bottom: 16,
            ),
            child: Text(
              title,
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 22,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          Expanded(
            child: AsyncStateMessage(
              icon: icon,
              message: '$title will continue in the next screens.',
            ),
          ),
        ],
      ),
    );
  }
}
