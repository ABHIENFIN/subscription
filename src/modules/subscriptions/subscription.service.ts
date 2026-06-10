import { subscriptionRepository } from './subscription.repository';
import { planService } from '../plans/plan.service';
import { tenantRepository } from '../tenants/tenant.repository';
import { getGateway } from '../../payments/gateway.factory';
import { CreateSubscriptionDto, CancelSubscriptionDto } from './subscription.dto';
import { NotFoundException, BadRequestException, ForbiddenException } from '../../common/exceptions';
import { SubscriptionStatus } from '../../common/enums';

export class SubscriptionService {
  async create(
    tenantId: string,
    userId: string,
    dto: CreateSubscriptionDto
  ) {
    const plan = await planService.findById(dto.planId, tenantId);

    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (!tenant.paymentProvider) {
      throw new BadRequestException(
        'Tenant has not configured a payment provider. Set tenant.paymentProvider first.'
      );
    }

    const gateway = getGateway(tenant.paymentProvider);

    const periodStart = new Date();
    const periodEnd = this.calculateNextPeriod(periodStart, plan.interval, plan.intervalCount);

    const gatewaySub = await gateway.createSubscription({
      planId: plan.id,
      gatewayPlanId: plan.gatewayPlanId ?? undefined,
      userId,
      paymentMethodId: dto.paymentMethodId,
    });

    return subscriptionRepository.create({
      tenantId,
      userId,
      planId: plan.id,
      status: SubscriptionStatus.ACTIVE,
      gatewayProvider: tenant.paymentProvider,
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

  private calculateNextPeriod(
    from: Date,
    interval: string,
    count: number
  ): Date {
    const next = new Date(from);
    switch (interval) {
      case 'DAY':
        next.setDate(next.getDate() + count);
        break;
      case 'WEEK':
        next.setDate(next.getDate() + count * 7);
        break;
      case 'MONTH':
        next.setMonth(next.getMonth() + count);
        break;
      case 'YEAR':
        next.setFullYear(next.getFullYear() + count);
        break;
    }
    return next;
  }
}

export const subscriptionService = new SubscriptionService();