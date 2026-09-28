import 'package:flutter/material.dart';

import '../../../constants/color_constants.dart';

/// Delivery partner on a red scooter with a TastyKart box.
class ScooterIllustration extends StatelessWidget {
  const ScooterIllustration({super.key});

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _ScooterPainter(),
      child: const SizedBox.expand(),
    );
  }
}

class _ScooterPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    canvas.drawRect(
      Rect.fromLTWH(0, h * 0.78, w, h * 0.22),
      Paint()..color = const Color(0xFFE8D5C4),
    );

    final wheel = Paint()..color = const Color(0xFF212121);
    canvas.drawCircle(Offset(w * 0.30, h * 0.78), h * 0.08, wheel);
    canvas.drawCircle(Offset(w * 0.68, h * 0.78), h * 0.08, wheel);
    final hub = Paint()..color = AppColors.white;
    canvas.drawCircle(Offset(w * 0.30, h * 0.78), h * 0.03, hub);
    canvas.drawCircle(Offset(w * 0.68, h * 0.78), h * 0.03, hub);

    final body = Paint()..color = AppColors.primary;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.28, h * 0.58, w * 0.40, h * 0.10),
        const Radius.circular(16),
      ),
      body,
    );

    final stem = Paint()
      ..color = const Color(0xFF455A64)
      ..strokeWidth = 8
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(Offset(w * 0.66, h * 0.60), Offset(w * 0.74, h * 0.42), stem);
    canvas.drawLine(Offset(w * 0.68, h * 0.42), Offset(w * 0.80, h * 0.42), stem);

    final box = Paint()..color = AppColors.primary;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.34, h * 0.36, w * 0.22, h * 0.22),
        const Radius.circular(6),
      ),
      box,
    );
    final lid = Paint()..color = const Color(0xFF8E1F20);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.33, h * 0.33, w * 0.24, h * 0.05),
        const Radius.circular(4),
      ),
      lid,
    );

    final textPainter = TextPainter(
      text: const TextSpan(
        text: 'TastyKart',
        style: TextStyle(
          color: Colors.white,
          fontSize: 9,
          fontWeight: FontWeight.w700,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    textPainter.paint(canvas, Offset(w * 0.365, h * 0.44));

    final head = Paint()..color = const Color(0xFFFFCC80);
    canvas.drawCircle(Offset(w * 0.58, h * 0.30), h * 0.07, head);
    final helmet = Paint()..color = const Color(0xFF37474F);
    canvas.drawArc(
      Rect.fromCircle(center: Offset(w * 0.58, h * 0.28), radius: h * 0.075),
      3.14,
      3.14,
      true,
      helmet,
    );

    final shirt = Paint()..color = AppColors.primary;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(
          center: Offset(w * 0.58, h * 0.46),
          width: w * 0.12,
          height: h * 0.16,
        ),
        const Radius.circular(10),
      ),
      shirt,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
