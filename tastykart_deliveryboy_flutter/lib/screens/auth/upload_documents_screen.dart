import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../constants/app_constants.dart';
import '../../constants/color_constants.dart';
import '../../models/delivery_partner.dart';
import '../../services/auth_service.dart';
import '../../services/delivery_partner_service.dart';
import '../../services/storage_service.dart';
import '../../utils/app_feedback.dart';
import '../../utils/responsive.dart';
import '../../widgets/onboarding_nav_tile.dart';
import 'components/onboarding_scaffold.dart';
import 'components/onboarding_title_block.dart';

class UploadDocumentsScreen extends StatefulWidget {
  const UploadDocumentsScreen({super.key, this.partner});

  final DeliveryPartner? partner;

  @override
  State<UploadDocumentsScreen> createState() => _UploadDocumentsScreenState();
}

class _UploadDocumentsScreenState extends State<UploadDocumentsScreen> {
  final _picker = ImagePicker();

  /// True while one document image is uploading. The row shows the spinner.
  bool _uploading = false;

  /// True while the final documents-complete write runs. Only the Next button spins.
  bool _marking = false;

  String? _uploadingId;

  Map<String, String> get _docs => widget.partner?.documents ?? const {};

  bool _isUploaded(String id) {
    final url = _docs[id];
    return url != null && url.isNotEmpty;
  }

  bool get _allUploaded =>
      AppConstants.documents.every((doc) => _isUploaded(doc.id));

  Future<void> _pickAndUpload(PartnerDocumentType doc) async {
    final user = AuthService.currentUser;
    if (user == null) {
      AppFeedback.showError(context, 'Please sign in again');
      return;
    }

    final source = await _chooseSource(preferCamera: doc.preferCamera);
    if (source == null || !mounted) return;

    final file = await _picker.pickImage(
      source: source,
      imageQuality: 40,
      maxWidth: 960,
      maxHeight: 960,
    );
    if (file == null || !mounted) return;

    setState(() {
      _uploading = true;
      _uploadingId = doc.id;
    });
    try {
      final partnerId = await DeliveryPartnerService.docIdFor(user);
      final bytes = await file.readAsBytes();
      final url = await StorageService.uploadImage(
        partnerId: partnerId,
        relativePath: 'documents/${doc.fileName}',
        bytes: bytes,
      );
      await DeliveryPartnerService.saveDocumentUrl(
        partnerId: partnerId,
        documentId: doc.id,
        url: url,
      );
      if (!mounted) return;
      AppFeedback.showSuccess(context, '${doc.title} uploaded');
    } catch (e) {
      if (!mounted) return;
      AppFeedback.showError(context, _uploadError(e));
    } finally {
      if (mounted) {
        setState(() {
          _uploading = false;
          _uploadingId = null;
        });
      }
    }
  }

  String _uploadError(Object error) {
    final text = error.toString().toLowerCase();
    if (text.contains('unauthorized') || text.contains('permission-denied')) {
      return 'Upload is not allowed yet. Ask admin to enable Storage for partner documents.';
    }
    return AuthService.messageFromError(error);
  }

  Future<ImageSource?> _chooseSource({required bool preferCamera}) {
    if (preferCamera) return Future.value(ImageSource.camera);
    return showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: AppColors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.photo_camera_outlined),
                title: const Text('Camera'),
                onTap: () => Navigator.pop(context, ImageSource.camera),
              ),
              ListTile(
                leading: const Icon(Icons.photo_library_outlined),
                title: const Text('Gallery'),
                onTap: () => Navigator.pop(context, ImageSource.gallery),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _onNext() async {
    if (!_allUploaded) {
      AppFeedback.showError(context, 'Please upload all documents');
      return;
    }
    final user = AuthService.currentUser;
    if (user == null) {
      AppFeedback.showError(context, 'Please sign in again');
      return;
    }
    setState(() => _marking = true);
    try {
      final partnerId = await DeliveryPartnerService.docIdFor(user);
      await DeliveryPartnerService.markDocumentsComplete(partnerId: partnerId);
    } catch (e) {
      if (!mounted) return;
      AppFeedback.showError(context, AuthService.messageFromError(e));
    } finally {
      if (mounted) setState(() => _marking = false);
    }
  }

  /// Back — clear vehicle AND uploaded documents so AuthGate steps back to
  /// SelectVehicleScreen and the next time this screen is shown it starts fresh.
  Future<void> _onBack() async {
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
      return;
    }
    final user = AuthService.currentUser;
    if (user == null) return;
    try {
      final partnerId = await DeliveryPartnerService.docIdFor(user);
      // Clear uploads so the screen starts fresh on the next registration attempt.
      await DeliveryPartnerService.clearDocuments(partnerId: partnerId);
      // Then step back to vehicle selection.
      await DeliveryPartnerService.clearVehicle(partnerId: partnerId);
    } catch (_) {
      if (!mounted) return;
      AppFeedback.showError(context, 'Could not go back. Try again.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = Responsive.of(context);
    final complete = _allUploaded;

    return OnboardingScaffold(
        buttonLabel: 'Next',
        isLoading: _marking,
        buttonEnabled: !_uploading,
        onPressed: _onNext,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            OnboardingTitleBlock(
              title: complete ? 'Uploaded Documents' : 'Upload Document',
              subtitle: complete
                  ? 'Your Documents Are Uploaded'
                  : 'Please Upload Clear And Valid Documents.',
              showBack: true,
              onBack: _onBack,
            ),
            SizedBox(
              height: r.responsive(mobile: 12.0, tablet: 16.0, desktop: 20.0),
            ),
            Expanded(
              child: ListView.separated(
                padding: EdgeInsets.zero,
                itemCount: AppConstants.documents.length,
                separatorBuilder: (_, __) =>
                    const Divider(height: 1, color: AppColors.divider),
                itemBuilder: (context, index) {
                  final doc = AppConstants.documents[index];
                  final uploaded = _isUploaded(doc.id);
                  final isThisUploading = _uploadingId == doc.id;
                  return OnboardingNavTile(
                    title: doc.title,
                    subtitle: doc.subtitle,
                    completed: uploaded,
                    busy: isThisUploading,
                    onTap: _uploading ? () {} : () => _pickAndUpload(doc),
                  );
                },
              ),
            ),
          ],
        ),
    );
  }
}
