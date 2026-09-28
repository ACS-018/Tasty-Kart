import 'package:flutter/material.dart';

import '../../../constants/color_constants.dart';

/// Delivery rider on a scooter against a city skyline.
class VerificationIllustration extends StatelessWidget {
  const VerificationIllustration({super.key});

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _VerificationPainter(),
      child: const SizedBox.expand(),
    );
  }
}

class _VerificationPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    final skyline = Paint()..color = const Color(0xFFD9D9D9);
    final buildings = <Rect>[
      Rect.fromLTWH(w * 0.04, h * 0.42, w * 0.10, h * 0.28),
      Rect.fromLTWH(w * 0.16, h * 0.30, w * 0.12, h * 0.40),
      Rect.fromLTWH(w * 0.30, h * 0.38, w * 0.09, h * 0.32),
      Rect.fromLTWH(w * 0.62, h * 0.34, w * 0.11, h * 0.36),
      Rect.fromLTWH(w * 0.75, h * 0.26, w * 0.10, h * 0.44),
      Rect.fromLTWH(w * 0.87, h * 0.40, w * 0.09, h * 0.30),
    ];
    for (final rect in buildings) {
      canvas.drawRRect(
        RRect.fromRectAndRadius(rect, const Radius.circular(4)),
        skyline,
      );
    }

    canvas.drawRect(
      Rect.fromLTWH(0, h * 0.70, w, h * 0.30),
      Paint()..color = const Color(0xFFF0E6DC),
    );

    final wheel = Paint()..color = const Color(0xFF212121);
    canvas.drawCircle(Offset(w * 0.34, h * 0.72), h * 0.075, wheel);
    canvas.drawCircle(Offset(w * 0.64, h * 0.72), h * 0.075, wheel);
    final hub = Paint()..color = AppColors.white;
    canvas.drawCircle(Offset(w * 0.34, h * 0.72), h * 0.028, hub);
    canvas.drawCircle(Offset(w * 0.64, h * 0.72), h * 0.028, hub);

    final body = Paint()..color = AppColors.primary;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.32, h * 0.54, w * 0.32, h * 0.09),
        const Radius.circular(18),
      ),
      body,
    );

    final stem = Paint()
      ..color = const Color(0xFF455A64)
      ..strokeWidth = 7
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(Offset(w * 0.62, h * 0.56), Offset(w * 0.70, h * 0.40), stem);
    canvas.drawLine(Offset(w * 0.64, h * 0.40), Offset(w * 0.76, h * 0.40), stem);

    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.36, h * 0.36, w * 0.18, h * 0.18),
        const Radius.circular(6),
      ),
      body,
    );

    final head = Paint()..color = const Color(0xFFFFCC80);
    canvas.drawCircle(Offset(w * 0.54, h * 0.30), h * 0.065, head);
    final helmet = Paint()..color = AppColors.primary;
    canvas.drawArc(
      Rect.fromCircle(center: Offset(w * 0.54, h * 0.28), radius: h * 0.07),
      3.14,
      3.14,
      true,
      helmet,
    );

    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(
          center: Offset(w * 0.54, h * 0.46),
          width: w * 0.13,
          height: h * 0.16,
        ),
        const Radius.circular(12),
      ),
      body,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
