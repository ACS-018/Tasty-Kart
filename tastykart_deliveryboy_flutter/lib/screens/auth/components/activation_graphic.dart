import 'package:flutter/material.dart';

import '../../../constants/color_constants.dart';

class ActivationGraphic extends StatelessWidget {
  const ActivationGraphic({super.key});

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _ActivationPainter(),
      child: const SizedBox.expand(),
    );
  }
}

class _ActivationPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final radius = size.shortestSide * 0.28;

    const dots = [
      Offset(-0.55, -0.62),
      Offset(0.58, -0.55),
      Offset(-0.72, 0.08),
      Offset(0.74, 0.12),
      Offset(-0.42, 0.68),
      Offset(0.48, 0.70),
      Offset(0.08, -0.82),
      Offset(-0.12, 0.84),
      Offset(0.82, -0.22),
      Offset(-0.80, -0.28),
    ];
    const colors = [
      Color(0xFF42A5F5),
      Color(0xFFFFA726),
      Color(0xFFBDBDBD),
      Color(0xFF42A5F5),
      Color(0xFFFFA726),
      Color(0xFFBDBDBD),
      Color(0xFF42A5F5),
      Color(0xFFFFA726),
      Color(0xFFBDBDBD),
      Color(0xFF42A5F5),
    ];
    for (var i = 0; i < dots.length; i++) {
      canvas.drawCircle(
        Offset(cx + dots[i].dx * radius * 1.55, cy + dots[i].dy * radius * 1.55),
        size.shortestSide * 0.018,
        Paint()..color = colors[i],
      );
    }

    canvas.drawCircle(Offset(cx, cy), radius, Paint()..color = AppColors.primary);

    final check = Paint()
      ..color = AppColors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = radius * 0.18
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final path = Path()
      ..moveTo(cx - radius * 0.38, cy)
      ..lineTo(cx - radius * 0.08, cy + radius * 0.28)
      ..lineTo(cx + radius * 0.42, cy - radius * 0.28);
    canvas.drawPath(path, check);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
