import { subscriptionRepository } from './subscription.repository';
import { planPriceRepository } from '../plans/plan.repository';
import { planService } from '../plans/plan.service';
import { getGateway } from '../../payments/gateway.factory';
import { CreateSubscriptionDto, CancelSubscriptionDto, RecordUsageDto } from './subscription.dto';
import { NotFoundException, BadRequestException } from '../../common/exceptions';
import { SubscriptionStatus, BillingInterval } from '../../common/enums';

function resolveProvider(): string {
  return process.env.DEFAULT_PAYMENT_PROVIDER ?? 'stripe';
}

function nextPeriod(from: Date, interval: BillingInterval | null | undefined, count: number | null | undefined): Date {
  const next = new Date(from);
  const n = count && count > 0 ? count : 1;
  if (!interval) return next;
  switch (interval) {
    case BillingInterval.DAY:  next.setDate(next.getDate() + n); break;
    case BillingInterval.WEEK: next.setDate(next.getDate() + n * 7); break;
    case BillingInterval.MONTH: next.setMonth(next.getMonth() + n); break;
    case BillingInterval.YEAR: next.setFullYear(next.getFullYear() + n); break;
  }
  return next;
}

export class SubscriptionService {
  async create(
    tenantId: string,
    userId: string,
    dto: CreateSubscriptionDto
  ) {
    const plan = await planService.findById(dto.planId, tenantId);
    if (!plan.productId) {
      throw new BadRequestException('Plan must be published before subscriptions can be created');
    }

    const primaryPrice = await planPriceRepository.findById(dto.planPriceId);
    if (!primaryPrice || primaryPrice.planId !== plan.id) {
      throw new NotFoundException('PlanPrice not found for this plan');
    }
    if (primaryPrice.type !== 'RECURRING') {
      throw new BadRequestException('planPriceId must be a RECURRING price; one-time prices go in addons[]');
    }
    if (!primaryPrice.gatewayPriceId) {
      throw new BadRequestException('PlanPrice must be published first');
    }

    const addonPrices: { id: string; gatewayPriceId: string | null; type: string }[] = [];
    for (const addonId of dto.addons ?? []) {
      const p = await planPriceRepository.findById(addonId);
      if (!p || p.planId !== plan.id) {
        throw new NotFoundException(`Addon PlanPrice ${addonId} not found for this plan`);
      }
      if (!p.gatewayPriceId) {
        throw new BadRequestException(`Addon PlanPrice ${addonId} must be published first`);
      }
      addonPrices.push({ id: p.id, gatewayPriceId: p.gatewayPriceId, type: p.type });
    }

    const paymentProvider = resolveProvider();
    const gateway = getGateway(paymentProvider);

    // Approach A:
    //   RECURRING addons → subscription items (paid each period)
    //   ONE_TIME addons  → invoice items on the upcoming invoice (paid once)
    const recurringAddonPrices = addonPrices.filter((a) => a.type === 'RECURRING');
    const oneTimeAddonPrices = addonPrices.filter((a) => a.type === 'ONE_TIME');

    const items = [
      { gatewayPriceId: primaryPrice.gatewayPriceId! },
      ...recurringAddonPrices.map((a) => ({ gatewayPriceId: a.gatewayPriceId! })),
    ];

    const gatewaySub = await gateway.createSubscription({
      planId: plan.id,
      userId,
      paymentMethodId: dto.paymentMethodId,
      items,
    });

    // Attach one-time fees to the first invoice of this subscription.
    // Must be done AFTER subscription creation so `subscription` is set on the invoice item.
    for (const ot of oneTimeAddonPrices) {
      await gateway.addInvoiceItem({
        customerId: gatewaySub.customerId,
        subscriptionId: gatewaySub.id,
        priceId: ot.gatewayPriceId!,
        quantity: 1,
      });
    }

    // Determine the primary recurring cadence for local bookkeeping.
    // Use the primary price's interval; fallback to monthly.
    const periodStart = new Date();
    const periodEnd = nextPeriod(periodStart, primaryPrice.interval as BillingInterval, primaryPrice.intervalCount);

    return subscriptionRepository.create({
      tenantId,
      userId,
      planId: plan.id,
      planPriceId: primaryPrice.id,
      addons: addonPrices.map((a) => a.id),
      status: SubscriptionStatus.ACTIVE,
      gatewayProvider: paymentProvider,
      gatewaySubscriptionId: gatewaySub.id,
      gatewayCustomerId: gatewaySub.customerId,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    });
  }

  async findById(id: string, tenantId: string) {
    const sub = await subscriptionRepository.findById(id);
    if (!sub) throw new NotFoundException('Subscription not found');
    if (sub.tenantId !== tenantId) {
      throw new NotFoundException('Subscription not found in this tenant');
    }
    return sub;
  }

  async listByTenant(tenantId: string, skip = 0, take = 20) {
    return subscriptionRepository.findByTenant(tenantId, skip, take);
  }

  async listByUser(userId: string, tenantId: string, skip = 0, take = 20) {
    return subscriptionRepository.findByUser(userId, tenantId, skip, take);
  }

  async cancel(id: string, tenantId: string, dto: CancelSubscriptionDto) {
    const sub = await this.findById(id, tenantId);
    if (sub.status === SubscriptionStatus.CANCELLED) {
      throw new BadRequestException('Subscription already cancelled');
    }
    if (dto.immediately) {
      const gateway = getGateway(sub.gatewayProvider);
      await gateway.cancelSubscription(sub.gatewaySubscriptionId!, true);
      return subscriptionRepository.update(id, {
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
      });
    }
    const gateway = getGateway(sub.gatewayProvider);
    await gateway.cancelSubscription(sub.gatewaySubscriptionId!, false);
    return subscriptionRepository.update(id, {
      cancelAtPeriodEnd: true,
    });
  }

  async pause(id: string, tenantId: string) {
    const sub = await this.findById(id, tenantId);
    if (sub.status === SubscriptionStatus.PAUSED) {
      throw new BadRequestException('Subscription already paused');
    }
    const gateway = getGateway(sub.gatewayProvider);
    await gateway.pauseSubscription(sub.gatewaySubscriptionId!);
    return subscriptionRepository.update(id, {
      status: SubscriptionStatus.PAUSED,
    });
  }

  async resume(id: string, tenantId: string) {
    const sub = await this.findById(id, tenantId);
    if (sub.status !== SubscriptionStatus.PAUSED) {
      throw new BadRequestException('Subscription is not paused');
    }
    const gateway = getGateway(sub.gatewayProvider);
    await gateway.resumeSubscription(sub.gatewaySubscriptionId!);
    return subscriptionRepository.update(id, {
      status: SubscriptionStatus.ACTIVE,
    });
  }

  async recordUsage(id: string, tenantId: string, dto: RecordUsageDto) {
    const sub = await this.findById(id, tenantId);
    if (!sub.gatewaySubscriptionId) {
      throw new BadRequestException('Subscription has no gateway ID; cannot record usage');
    }
    const price = await planPriceRepository.findById(dto.planPriceId);
    if (!price || price.planId !== sub.planId) {
      throw new NotFoundException('PlanPrice not found for this subscription');
    }
    if (price.type !== 'RECURRING' || price.usageType !== 'METERED') {
      throw new BadRequestException('PlanPrice must be RECURRING and METERED to record usage');
    }
    const gateway = getGateway(sub.gatewayProvider);
    const stripeSub = await (gateway as any).stripe?.subscriptions?.retrieve?.(sub.gatewaySubscriptionId, {
      expand: ['items.data.price'],
    }).catch(() => null) as any;
    let itemId: string | undefined;
    if (stripeSub?.items?.data) {
      itemId = stripeSub.items.data.find(
        (it: any) => (typeof it.price === 'string' ? it.price : it.price.id) === price.gatewayPriceId
      )?.id;
    }
    if (!itemId) {
      throw new NotFoundException('No matching subscription item found on Stripe for this price');
    }
    await gateway.recordUsage({
      subscriptionItemId: itemId,
      quantity: dto.quantity,
      timestamp: dto.timestamp ? new Date(dto.timestamp) : undefined,
      action: dto.action,
    });
    return { ok: true };
  }
}

export const subscriptionService = new SubscriptionService();
