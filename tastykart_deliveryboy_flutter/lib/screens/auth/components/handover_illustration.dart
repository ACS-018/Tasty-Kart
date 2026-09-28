import 'package:flutter/material.dart';

import '../../../constants/color_constants.dart';

/// Delivery partner handing a TastyKart bag to a customer at the door.
class HandoverIllustration extends StatelessWidget {
  const HandoverIllustration({super.key});

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _HandoverPainter(),
      child: const SizedBox.expand(),
    );
  }
}

class _HandoverPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    final ground = Paint()..color = const Color(0xFFE8D5C4);
    canvas.drawRect(Rect.fromLTWH(0, h * 0.78, w, h * 0.22), ground);

    final wall = Paint()..color = const Color(0xFFF3E6D8);
    canvas.drawRect(Rect.fromLTWH(w * 0.62, h * 0.08, w * 0.38, h * 0.70), wall);

    final door = Paint()..color = const Color(0xFF5D4037);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.70, h * 0.22, w * 0.22, h * 0.56),
        const Radius.circular(8),
      ),
      door,
    );
    final doorWindow = Paint()..color = const Color(0xFFBBDEFB);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.735, h * 0.28, w * 0.15, h * 0.16),
        const Radius.circular(4),
      ),
      doorWindow,
    );

    _drawPerson(
      canvas,
      origin: Offset(w * 0.58, h * 0.42),
      scale: h * 0.00115,
      shirt: const Color(0xFFFFCC80),
      pants: const Color(0xFF5D4037),
    );

    _drawPerson(
      canvas,
      origin: Offset(w * 0.28, h * 0.40),
      scale: h * 0.0012,
      shirt: AppColors.primary,
      pants: const Color(0xFF37474F),
      cap: true,
    );

    final bag = Paint()..color = AppColors.primary;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.40, h * 0.52, w * 0.12, h * 0.12),
        const Radius.circular(6),
      ),
      bag,
    );
    final bagHandle = Paint()
      ..color = AppColors.primary
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3;
    canvas.drawArc(
      Rect.fromLTWH(w * 0.42, h * 0.48, w * 0.08, h * 0.06),
      3.14,
      3.14,
      false,
      bagHandle,
    );
  }

  void _drawPerson(
    Canvas canvas, {
    required Offset origin,
    required double scale,
    required Color shirt,
    required Color pants,
    bool cap = false,
  }) {
    final s = 100 * scale;
    final head = Paint()..color = const Color(0xFFFFCC80);
    canvas.drawCircle(Offset(origin.dx, origin.dy), s * 0.28, head);

    if (cap) {
      final capPaint = Paint()..color = AppColors.primary;
      canvas.drawArc(
        Rect.fromCircle(center: Offset(origin.dx, origin.dy - s * 0.08), radius: s * 0.30),
        3.14,
        3.14,
        true,
        capPaint,
      );
    }

    final body = Paint()..color = shirt;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(
          center: Offset(origin.dx, origin.dy + s * 0.70),
          width: s * 0.72,
          height: s * 0.85,
        ),
        const Radius.circular(12),
      ),
      body,
    );

    final leg = Paint()..color = pants;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(origin.dx - s * 0.28, origin.dy + s * 1.05, s * 0.24, s * 0.70),
        const Radius.circular(6),
      ),
      leg,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(origin.dx + s * 0.04, origin.dy + s * 1.05, s * 0.24, s * 0.70),
        const Radius.circular(6),
      ),
      leg,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
