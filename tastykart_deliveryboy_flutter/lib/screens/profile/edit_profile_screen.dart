import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import '../../constants/color_constants.dart';
import '../../global_widgets/app_button.dart';
import '../../global_widgets/app_text_field.dart';
import '../../models/delivery_partner.dart';
import '../../services/delivery_partner_service.dart';
import '../../services/storage_service.dart';
import '../../utils/app_feedback.dart';
import '../../widgets/page_header.dart';

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key, required this.partner});

  final DeliveryPartner partner;

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _phone;
  late final TextEditingController _email;
  final _picker = ImagePicker();
  String? _avatar;
  Uint8List? _newPhoto;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: widget.partner.name);
    _phone = TextEditingController(text: widget.partner.phone);
    _email = TextEditingController(text: widget.partner.email);
    _avatar = widget.partner.avatar;
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _email.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto() async {
    final file = await _picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 40,
      maxWidth: 800,
    );
    if (file == null || !mounted) return;
    final bytes = await file.readAsBytes();
    if (!mounted) return;
    setState(() => _newPhoto = bytes);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate() || _saving) return;
    setState(() => _saving = true);
    try {
      var avatar = _avatar;
      final photo = _newPhoto;
      if (photo != null) {
        avatar = await StorageService.uploadAvatar(
          partnerId: widget.partner.id,
          bytes: photo,
        );
      }
      await DeliveryPartnerService.updateProfile(
        partnerId: widget.partner.id,
        name: _name.text,
        phone: _phone.text,
        email: _email.text,
        avatar: avatar,
      );
      if (mounted) {
        AppFeedback.showSuccess(context, 'Profile updated');
        Navigator.pop(context);
      }
    } catch (_) {
      if (mounted) {
        AppFeedback.showError(context, 'Could not update profile');
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
      ),
    );

    final letter = widget.partner.firstName.isEmpty
        ? 'P'
        : widget.partner.firstName[0].toUpperCase();

    final bottom = MediaQuery.paddingOf(context).bottom;
    final photo = _newPhoto;

    return Scaffold(
      backgroundColor: AppColors.white,
      resizeToAvoidBottomInset: true,
      body: Column(
        children: [
          const PageHeader(title: 'Edit Profile'),
          Expanded(
            child: Form(
              key: _formKey,
              child: ListView(
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
                children: [
                  Center(
                    child: Stack(
                      children: [
                        CircleAvatar(
                          radius: 56,
                          backgroundColor: const Color(0xFFFCE8E8),
                          backgroundImage: photo != null
                              ? MemoryImage(photo)
                              : (_avatar != null && _avatar!.isNotEmpty
                                    ? NetworkImage(_avatar!)
                                    : null),
                          child: photo == null &&
                                  (_avatar == null || _avatar!.isEmpty)
                              ? Text(
                                  letter,
                                  style: const TextStyle(
                                    fontSize: 36,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.primary,
                                  ),
                                )
                              : null,
                        ),
                          Positioned(
                            right: 0,
                            bottom: 0,
                            child: InkWell(
                              onTap: _pickPhoto,
                              child: Container(
                                width: 36,
                                height: 36,
                                decoration: const BoxDecoration(
                                  color: AppColors.primary,
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.photo_camera_outlined,
                                  color: AppColors.white,
                                  size: 18,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 28),
                    AppTextField(
                      label: 'Name',
                      controller: _name,
                      textCapitalization: TextCapitalization.words,
                      validator: (v) =>
                          (v == null || v.trim().isEmpty) ? 'Enter name' : null,
                    ),
                    const SizedBox(height: 16),
                    AppTextField(
                      label: 'Phone Number',
                      controller: _phone,
                      keyboardType: TextInputType.phone,
                      textInputAction: TextInputAction.next,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      validator: (v) {
                        final digits = (v ?? '').replaceAll(RegExp(r'\D'), '');
                        if (digits.isEmpty) return 'Enter phone number';
                        if (digits.length < 10) return 'Enter a valid phone number';
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),
                    AppTextField(
                      label: 'Email',
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.done,
                    ),
                  ],
                ),
              ),
            ),
          Padding(
              padding: EdgeInsets.fromLTRB(24, 8, 24, 16 + bottom),
              child: AppButton(
                label: 'Update',
                isLoading: _saving,
                onPressed: _saving ? null : _save,
              ),
            ),
          ],
        ),
    );
  }
}
