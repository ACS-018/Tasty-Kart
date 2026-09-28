import 'package:flutter/material.dart';

import '../../../constants/app_constants.dart';
import '../../../constants/color_constants.dart';
import '../../../utils/responsive.dart';

class TastyKartLogo extends StatelessWidget {
  const TastyKartLogo({
    super.key,
    this.color = AppColors.white,
    this.showWordmark = true,
    this.iconSize,
  });

  final Color color;
  final bool showWordmark;
  final double? iconSize;

  @override
  Widget build(BuildContext context) {
    final r = Responsive.of(context);
    final size = iconSize ?? r.responsive(mobile: 88.0, tablet: 100.0, desktop: 110.0);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: size,
          height: size,
          child: CustomPaint(painter: _ClochePainter(color: color)),
        ),
        if (showWordmark) ...[
          SizedBox(height: r.responsive(mobile: 8.0, tablet: 10.0, desktop: 12.0)),
          Text(
            AppConstants.appName,
            style: TextStyle(
              color: color,
              fontSize: r.responsive(mobile: 22.0, tablet: 24.0, desktop: 26.0),
              fontWeight: FontWeight.w700,
              letterSpacing: 0.4,
            ),
          ),
        ],
      ],
    );
  }
}

class _ClochePainter extends CustomPainter {
  _ClochePainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.width * 0.055
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final cx = size.width / 2;
    final cy = size.height * 0.46;
    final radius = size.width * 0.32;

    canvas.drawArc(
      Rect.fromCircle(center: Offset(cx, cy + radius * 0.15), radius: radius),
      3.14,
      3.14,
      false,
      paint,
    );

    canvas.drawLine(
      Offset(cx - radius * 1.05, cy + radius * 0.18),
      Offset(cx + radius * 1.05, cy + radius * 0.18),
      paint,
    );

    canvas.drawCircle(
      Offset(cx, cy - radius * 0.95),
      size.width * 0.045,
      paint,
    );

    final forkX = cx - radius * 0.42;
    final spoonX = cx + radius * 0.42;
    final utensilTop = cy + radius * 0.38;
    final utensilBottom = size.height * 0.92;

    canvas.drawLine(Offset(forkX, utensilTop), Offset(forkX, utensilBottom), paint);
    canvas.drawLine(
      Offset(forkX - size.width * 0.04, utensilTop),
      Offset(forkX, utensilTop + size.height * 0.08),
      paint,
    );
    canvas.drawLine(
      Offset(forkX + size.width * 0.04, utensilTop),
      Offset(forkX, utensilTop + size.height * 0.08),
      paint,
    );

    canvas.drawLine(
      Offset(spoonX, utensilTop + size.height * 0.08),
      Offset(spoonX, utensilBottom),
      paint,
    );
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(spoonX, utensilTop),
        width: size.width * 0.12,
        height: size.height * 0.14,
      ),
      paint,
    );
  }

  @override
  bool shouldRepaint(covariant _ClochePainter oldDelegate) =>
      oldDelegate.color != color;
}
