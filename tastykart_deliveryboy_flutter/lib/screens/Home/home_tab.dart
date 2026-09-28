import 'package:flutter/material.dart';

import '../../constants/color_constants.dart';
import '../../models/delivery_order.dart';
import '../../models/delivery_partner.dart';
import '../../services/delivery_partner_service.dart';
import '../../services/order_service.dart';
import '../../services/settings_service.dart';
import '../../utils/app_navigation.dart';
import '../../utils/formatters.dart';
import '../earnings/cash_deposit_screen.dart';
import '../map/high_demand_zone_screen.dart';
import 'surge_request_screen.dart';
import 'components/daily_target_card.dart';
import 'components/demand_banner.dart';
import 'components/home_header.dart';
import 'components/incentives_card.dart';
import 'components/stat_cards_row.dart';

class _CashLimitBanner extends StatelessWidget {
  const _CashLimitBanner({required this.due, required this.onPay});

  final int due;
  final VoidCallback onPay;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFFFFF3E0),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onPay,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          child: Row(
            children: [
              const Icon(Icons.payments_outlined, color: Color(0xFFEF6C00)),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Cash limit reached. Pay ${rupee(due)} to go online.',
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    color: AppColors.textDark,
                  ),
                ),
              ),
              const Icon(Icons.chevron_right, color: AppColors.textLight),
            ],
          ),
        ),
      ),
    );
  }
}

class _SurgeRequestCard extends StatelessWidget {
  const _SurgeRequestCard({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.white,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          child: Row(
            children: const [
              Icon(Icons.bolt, color: Color(0xFFEF6C00)),
              SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Request surge',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: AppColors.textDark,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Take a photo. Admin sets the amount and hours for your city.',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.textMedium,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: AppColors.textLight),
            ],
          ),
        ),
      ),
    );
  }
}

class _DailyTargetReward extends StatefulWidget {
  const _DailyTargetReward({
    required this.partnerId,
    required this.partnerName,
    required this.earned,
    required this.target,
    required this.bonus,
  });

  final String partnerId;
  final String partnerName;
  final int earned;
  final int target;
  final int bonus;

  @override
  State<_DailyTargetReward> createState() => _DailyTargetRewardState();
}

class _DailyTargetRewardState extends State<_DailyTargetReward> {
  String? _lastKey;

  @override
  void initState() {
    super.initState();
    _credit();
  }

  @override
  void didUpdateWidget(covariant _DailyTargetReward oldWidget) {
    super.didUpdateWidget(oldWidget);
    _credit();
  }

  void _credit() {
    final key =
        '${widget.partnerId}|${widget.earned}|${widget.target}|${widget.bonus}';
    if (_lastKey == key) return;
    _lastKey = key;
    DeliveryPartnerService.creditDailyTargetBonus(
      partnerId: widget.partnerId,
      partnerName: widget.partnerName,
      earnedToday: widget.earned,
    );
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}

class HomeTab extends StatelessWidget {
  const HomeTab({super.key, required this.partner});

  final DeliveryPartner partner;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: AppColors.surface,
      // Outer StreamBuilder: live admin settings (incentives + daily target)
      child: StreamBuilder<PlatformSettings>(
        stream: SettingsService.watchSettings(),
        builder: (context, settingsSnap) {
          final dp =
              settingsSnap.data?.deliveryPartner ??
              const DeliveryPartnerSettings();

          // Inner StreamBuilder: partner's orders for today's stats
          return StreamBuilder<List<DeliveryOrder>>(
            stream: OrderService.watchForPartner(partner.id),
            builder: (context, orderSnap) {
              final orders = orderSnap.data ?? const <DeliveryOrder>[];
              final today = OrderService.deliveredToday(orders);
              final earnings = today.fold<int>(0, (sum, o) => sum + o.payout);
              final thisWeek = OrderService.deliveredThisWeek(orders);
              final trips = thisWeek.length;
              final hours = (trips * 0.4).round();
              final incentives = dp.incentiveFor(trips);

              return Column(
                children: [
                  HomeHeader(partner: partner),
                  Expanded(
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
                      children: [
                        if (partner.cashDue(
                              partner.effectiveCashLimit(dp.cashLimitDefault),
                            ) >
                            0) ...[
                          _CashLimitBanner(
                            due: partner.cashDue(
                              partner.effectiveCashLimit(dp.cashLimitDefault),
                            ),
                            onPay: () => AppNavigation.push(
                              context,
                              CashDepositScreen(
                                partner: partner,
                                cashLimit: partner.effectiveCashLimit(
                                  dp.cashLimitDefault,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                        ],
                        StatCardsRow(
                          earnings: earnings,
                          trips: trips,
                          hours: hours,
                          incentives: incentives,
                        ),
                        const SizedBox(height: 12),
                        DailyTargetCard(
                          earned: earnings,
                          target: dp.dailyTarget,
                          bonus: dp.dailyTargetBonus,
                        ),
                        _DailyTargetReward(
                          partnerId: partner.id,
                          partnerName: partner.name,
                          earned: earnings,
                          target: dp.dailyTarget,
                          bonus: dp.dailyTargetBonus,
                        ),
                        const SizedBox(height: 8),
                        IncentivesCard(trips: trips, slots: dp.incentiveSlots),
                        const SizedBox(height: 12),
                        DemandBanner(
                          city: partner.city,
                          onSee: () => AppNavigation.push(
                            context,
                            HighDemandZoneScreen(city: partner.city),
                          ),
                        ),
                        const SizedBox(height: 12),
                        _SurgeRequestCard(
                          onTap: () => AppNavigation.push(
                            context,
                            SurgeRequestScreen(partner: partner),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              );
            },
          );
        },
      ),
    );
  }
}
