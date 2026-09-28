import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../constants/color_constants.dart';
import '../../widgets/page_header.dart';

class SimpleInfoScreen extends StatelessWidget {
  const SimpleInfoScreen({
    super.key,
    required this.title,
    required this.message,
  });

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
      ),
    );

    return Scaffold(
      backgroundColor: AppColors.white,
      body: Column(
        children: [
          PageHeader(title: title),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                message,
                style: const TextStyle(
                  fontSize: 15,
                  height: 1.5,
                  color: AppColors.textDark,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
