import 'dart:async';

import 'package:flutter/material.dart';

import '../../constants/color_constants.dart';
import '../../models/support_ticket.dart';
import '../../services/support_ticket_service.dart';
import '../../widgets/page_header.dart';

class SupportTicketChatScreen extends StatefulWidget {
  const SupportTicketChatScreen({
    super.key,
    required this.ticket,
    required this.partnerId,
  });

  final SupportTicket ticket;
  final String partnerId;

  @override
  State<SupportTicketChatScreen> createState() =>
      _SupportTicketChatScreenState();
}

class _SupportTicketChatScreenState extends State<SupportTicketChatScreen>
    with WidgetsBindingObserver {
  final _ctrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  bool _sending = false;
  late SupportTicket _ticket = widget.ticket;
  StreamSubscription<SupportTicket?>? _ticketSub;
  Timer? _viewingHeartbeat;
  bool _viewing = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _startViewing();
    _ticketSub = SupportTicketService.watchTicket(widget.ticket.id).listen((t) {
      if (t == null || !mounted) return;
      setState(() => _ticket = t);
      if (_viewing && t.unreadByPartner) {
        SupportTicketService.markReadByPartner(t.id);
      }
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _startViewing();
    } else {
      _stopViewing();
    }
  }

  void _startViewing() {
    if (_viewing) return;
    _viewing = true;
    SupportTicketService.setPartnerViewing(widget.ticket.id, true);
    _viewingHeartbeat?.cancel();
    _viewingHeartbeat = Timer.periodic(
      const Duration(minutes: 1),
      (_) => SupportTicketService.setPartnerViewing(widget.ticket.id, true),
    );
  }

  void _stopViewing() {
    if (!_viewing) return;
    _viewing = false;
    _viewingHeartbeat?.cancel();
    _viewingHeartbeat = null;
    SupportTicketService.setPartnerViewing(widget.ticket.id, false);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _stopViewing();
    _ticketSub?.cancel();
    _ctrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  Color get _statusColor {
    switch (_ticket.status) {
      case TicketStatus.open:       return const Color(0xFF1565C0);
      case TicketStatus.inProgress: return const Color(0xFFE65100);
      case TicketStatus.closed:     return const Color(0xFF2E7D32);
    }
  }

  String get _statusLabel {
    switch (_ticket.status) {
      case TicketStatus.open:       return 'Open';
      case TicketStatus.inProgress: return 'In Progress';
      case TicketStatus.closed:     return 'Closed';
    }
  }

  Future<void> _send() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty || _sending) return;
    if (_ticket.status == TicketStatus.closed) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('This ticket is closed. Open a new ticket if needed.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    setState(() => _sending = true);
    _ctrl.clear();
    try {
      await SupportTicketService.sendMessage(
        ticketId: widget.ticket.id,
        partnerId: widget.partnerId,
        message: text,
      );
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scrollCtrl.hasClients) {
          _scrollCtrl.animateTo(
            _scrollCtrl.position.maxScrollExtent,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOut,
          );
        }
      });
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not send message. Try again.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    final viewInset = MediaQuery.viewInsetsOf(context).bottom;

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: Column(
        children: [
          PageHeader(
            title: widget.ticket.category,
            branded: true,
            subtitle: widget.ticket.subject,
          ),

          // Status badge
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: _statusColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: _statusColor.withValues(alpha: 0.4),
                    ),
                  ),
                  child: Text(
                    _statusLabel,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: _statusColor,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  '#${widget.ticket.id.substring(0, 8).toUpperCase()}',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textMedium,
                  ),
                ),
              ],
            ),
          ),

          // Messages
          Expanded(
            child: StreamBuilder<List<TicketMessage>>(
              stream: SupportTicketService.watchMessages(widget.ticket.id),
              builder: (context, snap) {
                final msgs = snap.data ?? const [];
                if (msgs.isEmpty && snap.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (_scrollCtrl.hasClients) {
                    _scrollCtrl.jumpTo(_scrollCtrl.position.maxScrollExtent);
                  }
                });
                return ListView.builder(
                  controller: _scrollCtrl,
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                  itemCount: msgs.length,
                  itemBuilder: (context, i) => _MessageBubble(
                    msg: msgs[i],
                    isPartner: msgs[i].senderType == 'partner',
                  ),
                );
              },
            ),
          ),

          // Input bar
          if (_ticket.status != TicketStatus.closed)
            Container(
              color: AppColors.white,
              padding: EdgeInsets.fromLTRB(
                12,
                8,
                12,
                8 + viewInset + bottom,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _ctrl,
                      textCapitalization: TextCapitalization.sentences,
                      minLines: 1,
                      maxLines: 4,
                      decoration: InputDecoration(
                        hintText: 'Type a message…',
                        filled: true,
                        fillColor: const Color(0xFFF5F5F5),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 10,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                          borderSide: BorderSide.none,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: _send,
                    child: Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        shape: BoxShape.circle,
                      ),
                      child: _sending
                          ? const Padding(
                              padding: EdgeInsets.all(12),
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: AppColors.white,
                              ),
                            )
                          : const Icon(
                              Icons.send_rounded,
                              color: AppColors.white,
                              size: 20,
                            ),
                    ),
                  ),
                ],
              ),
            )
          else
            Container(
              width: double.infinity,
              color: AppColors.white,
              padding: EdgeInsets.fromLTRB(16, 12, 16, 12 + bottom),
              child: const Text(
                'This ticket is closed. Open a new ticket if you need further help.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 12,
                  color: AppColors.textMedium,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.msg, required this.isPartner});

  final TicketMessage msg;
  final bool isPartner;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: isPartner ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.75,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: isPartner ? AppColors.primary : AppColors.white,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(isPartner ? 16 : 4),
            bottomRight: Radius.circular(isPartner ? 4 : 16),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (!isPartner)
              const Padding(
                padding: EdgeInsets.only(bottom: 4),
                child: Text(
                  'Support Team',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary,
                  ),
                ),
              ),
            Text(
              msg.message,
              style: TextStyle(
                fontSize: 13,
                color: isPartner ? AppColors.white : AppColors.textDark,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              _formatTime(msg.sentAt),
              style: TextStyle(
                fontSize: 10,
                color: isPartner
                    ? AppColors.white.withValues(alpha: 0.7)
                    : AppColors.textLight,
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatTime(DateTime? dt) {
    if (dt == null) return '';
    final h = dt.hour > 12 ? dt.hour - 12 : (dt.hour == 0 ? 12 : dt.hour);
    final m = dt.minute.toString().padLeft(2, '0');
    final ap = dt.hour >= 12 ? 'PM' : 'AM';
    return '$h:$m $ap';
  }
}
