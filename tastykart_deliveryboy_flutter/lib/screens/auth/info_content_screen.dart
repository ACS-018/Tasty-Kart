import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../../constants/color_constants.dart';
import '../../global_widgets/app_button.dart';
import '../../utils/responsive.dart';
import 'components/onboarding_title_block.dart';

class InfoContentScreen extends StatefulWidget {
  const InfoContentScreen({
    super.key,
    required this.title,
    required this.body,
    this.videoUrl = '',
    this.buttonLabel = 'Done',
  });

  final String title;
  final String body;
  final String videoUrl;
  final String buttonLabel;

  @override
  State<InfoContentScreen> createState() => _InfoContentScreenState();
}

class _InfoContentScreenState extends State<InfoContentScreen> {
  VideoPlayerController? _controller;
  String? _videoError;

  @override
  void initState() {
    super.initState();
    final url = widget.videoUrl.trim();
    if (url.isEmpty) return;
    final controller = VideoPlayerController.networkUrl(Uri.parse(url));
    _controller = controller;
    _prepareVideo(controller);
  }

  Future<void> _prepareVideo(VideoPlayerController controller) async {
    try {
      await controller.initialize();
      if (!mounted) return;
      setState(() {});
      await controller.play();
    } catch (_) {
      if (!mounted) return;
      setState(() => _videoError = 'Could not play this training video.');
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final r = Responsive.of(context);
    final horizontal = r.responsive(mobile: 24.0, tablet: 40.0, desktop: 48.0);
    final controller = _controller;

    return Scaffold(
      backgroundColor: AppColors.white,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: EdgeInsets.fromLTRB(horizontal, 20, horizontal, 0),
              child: OnboardingTitleBlock(
                title: widget.title,
                subtitle: '',
                showBack: true,
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: EdgeInsets.fromLTRB(horizontal, 16, horizontal, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (controller != null) ...[
                      ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: AspectRatio(
                          aspectRatio: controller.value.isInitialized
                              ? controller.value.aspectRatio
                              : 16 / 9,
                          child: ColoredBox(
                            color: Colors.black,
                            child: controller.value.isInitialized
                                ? Stack(
                                    alignment: Alignment.center,
                                    children: [
                                      VideoPlayer(controller),
                                      IconButton(
                                        onPressed: () {
                                          setState(() {
                                            controller.value.isPlaying
                                                ? controller.pause()
                                                : controller.play();
                                          });
                                        },
                                        icon: Icon(
                                          controller.value.isPlaying
                                              ? Icons.pause_circle_filled
                                              : Icons.play_circle_fill,
                                          color: Colors.white,
                                          size: 56,
                                        ),
                                      ),
                                    ],
                                  )
                                : Center(
                                    child: _videoError == null
                                        ? const CircularProgressIndicator(
                                            color: Colors.white,
                                          )
                                        : Padding(
                                            padding: const EdgeInsets.all(16),
                                            child: Text(
                                              _videoError!,
                                              textAlign: TextAlign.center,
                                              style: const TextStyle(
                                                color: Colors.white,
                                              ),
                                            ),
                                          ),
                                  ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],
                    if (widget.body.trim().isNotEmpty)
                      Text(
                        widget.body,
                        style: TextStyle(
                          fontSize: r.responsive(
                            mobile: 14.0,
                            tablet: 15.0,
                            desktop: 16.0,
                          ),
                          height: 1.5,
                          color: AppColors.textDark,
                        ),
                      ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(
                horizontal,
                12,
                horizontal,
                r.responsive(mobile: 20.0, tablet: 28.0, desktop: 32.0),
              ),
              child: AppButton(
                label: widget.buttonLabel,
                onPressed: () => Navigator.of(context).pop(true),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
