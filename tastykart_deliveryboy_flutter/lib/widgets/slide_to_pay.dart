import 'package:flutter/material.dart';

import '../constants/color_constants.dart';
import '../utils/app_feedback.dart';

class SlideToPay extends StatefulWidget {
  const SlideToPay({
    super.key,
    required this.label,
    required this.onConfirm,
    this.loading = false,
    this.allowConfirm,
  });

  final String label;
  final VoidCallback? onConfirm;
  final bool loading;

  /// Return false to cancel the swipe and slide the thumb back.
  final bool Function()? allowConfirm;

  @override
  State<SlideToPay> createState() => _SlideToPayState();
}

class _SlideToPayState extends State<SlideToPay> {
  double _dx = 0;

  @override
  void didUpdateWidget(covariant SlideToPay oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.loading && !widget.loading) {
      _dx = 0;
    }
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        const thumb = 48.0;
        final maxDx = (constraints.maxWidth - thumb - 8).clamp(0.0, 400.0);
        return SizedBox(
          height: 56,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Container(
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              Text(
                widget.label,
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              if (widget.loading)
                const Positioned(
                  right: 16,
                  child: SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.white,
                    ),
                  ),
                ),
              Positioned(
                left: 4 + _dx,
                child: GestureDetector(
                  onHorizontalDragUpdate: widget.loading
                      ? null
                      : (details) {
                          setState(() {
                            _dx = (_dx + details.delta.dx).clamp(0.0, maxDx);
                          });
                        },
                  onHorizontalDragEnd: widget.loading
                      ? null
                      : (_) {
                          if (_dx >= maxDx * 0.85) {
                            if (widget.allowConfirm != null &&
                                widget.allowConfirm!() == false) {
                              setState(() => _dx = 0);
                              return;
                            }
                            setState(() => _dx = maxDx);
                            AppFeedback.success();
                            widget.onConfirm?.call();
                          } else {
                            setState(() => _dx = 0);
                          }
                        },
                  child: Container(
                    width: thumb,
                    height: thumb,
                    decoration: BoxDecoration(
                      color: AppColors.white,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.keyboard_double_arrow_right,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
