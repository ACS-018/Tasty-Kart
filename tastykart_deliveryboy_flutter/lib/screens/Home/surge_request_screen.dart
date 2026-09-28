import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../constants/color_constants.dart';
import '../../global_widgets/loading_overlay.dart';
import '../../models/delivery_partner.dart';
import '../../services/storage_service.dart';
import '../../services/surge_service.dart';
import '../../utils/app_feedback.dart';

class SurgeRequestScreen extends StatefulWidget {
  const SurgeRequestScreen({super.key, required this.partner});

  final DeliveryPartner partner;

  @override
  State<SurgeRequestScreen> createState() => _SurgeRequestScreenState();
}

class _SurgeRequestScreenState extends State<SurgeRequestScreen> {
  final _picker = ImagePicker();
  Uint8List? _bytes;
  bool _submitting = false;

  Future<void> _capture() async {
    final file = await _picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 60,
      maxWidth: 1400,
      maxHeight: 1400,
    );
    if (file == null || !mounted) return;
    final bytes = await file.readAsBytes();
    if (!mounted) return;
    setState(() => _bytes = bytes);
  }

  Future<void> _submit() async {
    final bytes = _bytes;
    final city = widget.partner.city.trim();
    if (city.isEmpty) {
      AppFeedback.showError(context, 'Select your city before requesting surge');
      return;
    }
    if (bytes == null) {
      AppFeedback.showError(context, 'Take a photo of the demand first');
      return;
    }

    setState(() => _submitting = true);
    try {
      final stamp = DateTime.now().millisecondsSinceEpoch;
      final url = await StorageService.uploadImage(
        partnerId: widget.partner.id,
        relativePath: 'surge/$stamp.jpg',
        bytes: bytes,
      );
      await SurgeService.submit(
        partnerId: widget.partner.id,
        partnerName: widget.partner.name,
        phone: widget.partner.phone,
        city: city,
        imageUrl: url,
      );
      if (!mounted) return;
      AppFeedback.showSuccess(
        context,
        'Surge request sent for $city. An admin will set the amount and hours.',
      );
      Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      AppFeedback.showError(context, 'Could not send surge request');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final city = widget.partner.city.trim();
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.white,
        foregroundColor: AppColors.textDark,
        elevation: 0,
        title: const Text(
          'Request surge',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      body: LoadingOverlay(
        isLoading: _submitting,
        child: StreamBuilder<List<SurgeRequest>>(
          stream: SurgeService.watchForPartner(widget.partner.id),
          builder: (context, snap) {
            final requests = snap.data ?? const <SurgeRequest>[];
            final pending = requests.where((r) => r.isPending).length;
            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                Text(
                  city.isEmpty
                      ? 'Your city is not set yet. Set it in your profile, then send a photo so admin can turn on surge.'
                      : 'Photograph the rush in $city. After review, admin sets a rupee amount that applies in this city for the hours they choose.',
                  style: const TextStyle(
                    color: AppColors.textMedium,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 16),
                GestureDetector(
                  onTap: _submitting ? null : _capture,
                  child: Container(
                    height: 220,
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: AppColors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFFFE0B2)),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: _bytes == null
                        ? const Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.photo_camera_outlined,
                                size: 40,
                                color: Color(0xFFEF6C00),
                              ),
                              SizedBox(height: 8),
                              Text(
                                'Take photo',
                                style: TextStyle(fontWeight: FontWeight.w700),
                              ),
                            ],
                          )
                        : Image.memory(_bytes!, fit: BoxFit.cover),
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _submitting ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: AppColors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: Text(
                      pending > 0 ? 'Send another request' : 'Send for review',
                    ),
                  ),
                ),
                if (requests.isNotEmpty) ...[
                  const SizedBox(height: 24),
                  const Text(
                    'Your requests',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                  ),
                  const SizedBox(height: 8),
                  ...requests.take(8).map(_requestTile),
                ],
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _requestTile(SurgeRequest request) {
    final color = request.isLive
        ? AppColors.online
        : request.isRejected
        ? AppColors.error
        : const Color(0xFFEF6C00);
    final detail = request.isApproved
        ? '₹${request.amount} · ${request.hours}h'
        : request.isRejected && request.rejectionReason.isNotEmpty
        ? request.rejectionReason
        : 'Waiting for admin';
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          if (request.imageUrl.isNotEmpty)
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.network(
                request.imageUrl,
                width: 48,
                height: 48,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => const SizedBox(width: 48, height: 48),
              ),
            )
          else
            const SizedBox(width: 48, height: 48),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  request.city.isEmpty ? 'City surge' : request.city,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                Text(
                  detail,
                  style: const TextStyle(
                    color: AppColors.textMedium,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          Text(
            request.statusLabel,
            style: TextStyle(color: color, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}
