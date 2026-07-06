import { planRepository, planPriceRepository } from './plan.repository';
import { CreatePlanDto, UpdatePlanDto, CreatePlanPriceDto, UpdatePlanPriceDto } from './plan.dto';
import { NotFoundException, BadRequestException } from '../../common/exceptions';
import { getGateway } from '../../payments/gateway.factory';
import { fxService } from '../../payments/fx.service';
import { Prisma } from '@prisma/client';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function resolveProvider(): string {
  return process.env.DEFAULT_PAYMENT_PROVIDER ?? 'stripe';
}

export class PlanService {
  async create(tenantId: string, dto: CreatePlanDto) {
    const slug = slugify(dto.name);
    return planRepository.create({
      slug,
      tenantId,
      name: dto.name,
      description: dto.description,
      features: dto.features as Prisma.InputJsonValue | undefined,
      status: 'DRAFT',
    });
  }

  async findById(id: string, tenantId: string) {
    const plan = await planRepository.findById(id);
    if (!plan) throw new NotFoundException('Plan not found');
    if (plan.tenantId !== tenantId) {
      throw new NotFoundException('Plan not found in this tenant');
    }
    return plan;
  }

  async list(tenantId: string, skip = 0, take = 20) {
    return planRepository.findByTenant(tenantId, skip, take);
  }

  async update(id: string, tenantId: string, dto: UpdatePlanDto) {
    await this.findById(id, tenantId);
    return planRepository.update(id, dto);
  }

  async delete(id: string, tenantId: string) {
    await this.findById(id, tenantId);
    await planRepository.delete(id);
  }

  // -------------------------------------------------------
  // Publish — creates the Stripe Product (one per plan tier).
  // -------------------------------------------------------
  async publishPlan(id: string, tenantId: string) {
    const plan = await this.findById(id, tenantId);
    if (plan.status === 'ARCHIVED') {
      throw new BadRequestException('Cannot publish an archived plan');
    }
    if (plan.productId) {
      return plan;
    }
    const gateway = getGateway(resolveProvider());
    const product = await gateway.createProduct({
      name: plan.name,
      description: plan.description ?? undefined,
      metadata: { tenantId, planId: plan.id },
    });
    return planRepository.update(id, {
      status: 'ACTIVE',
      productId: product.id,
    });
  }

  async archivePlan(id: string, tenantId: string) {
    await this.findById(id, tenantId);
    return planRepository.update(id, { status: 'ARCHIVED', isActive: false });
  }

  async duplicatePlan(id: string, tenantId: string) {
    const source = await this.findById(id, tenantId);
    return planRepository.create({
      tenantId,
      name: `${source.name} (copy)`,
      slug: slugify(`${source.name}-copy-${Date.now().toString(36)}`),
      description: source.description,
      features: source.features === null ? Prisma.JsonNull : (source.features as Prisma.InputJsonValue | undefined),
      status: 'DRAFT',
      isActive: true,
    });
  }

  // -------------------------------------------------------
  // Prices — one Stripe price_... per cadence under the plan
  // -------------------------------------------------------
  async listPrices(planId: string, tenantId: string) {
    await this.findById(planId, tenantId);
    return planPriceRepository.findByPlan(planId);
  }

  async addPrice(planId: string, tenantId: string, dto: CreatePlanPriceDto) {
    await this.findById(planId, tenantId);
    if (dto.type === 'RECURRING' && !dto.interval) {
      throw new BadRequestException('interval is required for RECURRING prices');
    }
    return planPriceRepository.create({
      planId,
      amount: dto.amount,
      currency: dto.currency,
      interval: dto.type === 'RECURRING' ? (dto.interval ?? null) : null,
      intervalCount: dto.intervalCount,
      type: dto.type,
      usageType: dto.usageType,
      trialDays: dto.trialDays,
      nickname: dto.nickname,
      status: 'DRAFT',
    });
  }

  async updatePrice(planId: string, priceId: string, tenantId: string, dto: UpdatePlanPriceDto) {
    await this.findById(planId, tenantId);
    const price = await planPriceRepository.findById(priceId);
    if (!price || price.planId !== planId) {
      throw new NotFoundException('PlanPrice not found for this plan');
    }
    return planPriceRepository.update(priceId, dto);
  }

  async publishPrice(planId: string, priceId: string, tenantId: string) {
    let plan = await this.findById(planId, tenantId);
    const price = await planPriceRepository.findById(priceId);
    if (!price || price.planId !== planId) {
      throw new NotFoundException('PlanPrice not found for this plan');
    }
    if (price.status === 'ACTIVE' && price.gatewayPriceId) {
      return price;
    }
    // Auto-publish the parent plan if it's still DRAFT — Stripe requires a Product
    // to exist before a Price can attach to it. Re-runs idempotently (publishPlan
    // short-circuits if productId is already set).
    if (!plan.productId) {
      await this.publishPlan(planId, tenantId);
      plan = await this.findById(planId, tenantId);
      if (!plan.productId) {
        throw new BadRequestException('Plan must be published before prices can be published');
      }
    }
    const gateway = getGateway(resolveProvider());
    const stripePrice = await gateway.createPrice({
      productId: plan.productId,
      amount: price.amount,
      currency: price.currency,
      type: price.type as 'RECURRING' | 'ONE_TIME',
      interval: price.interval as 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | undefined,
      intervalCount: price.intervalCount,
      usageType: price.usageType as 'LICENSED' | 'METERED',
      nickname: price.nickname ?? undefined,
      trialDays: price.trialDays,
      metadata: { tenantId, planId: plan.id, planPriceId: price.id },
    });

    // Snapshot FX at the moment the price hits Stripe. Both the original
    // (amount/currency) and the USD snapshot (amountUsdCents/fxRate/fxAsOf/fxSource)
    // are then immutable. FX failure must not leave the price in a half-published
    // state — so we attempt FX before flipping status to ACTIVE, and on FX error
    // we still mark ACTIVE (price is in Stripe) but log + persist nulls with
    // a manual republish path. For non-USD currencies this would surface as a
    // missing USD aggregate until an operator republishes.
    let fx: Awaited<ReturnType<typeof fxService.snapshot>> | null = null;
    try {
      fx = await fxService.snapshot(price.amount, price.currency);
    } catch (err) {
      console.error(
        `[plan.publishPrice] FX snapshot failed for planPrice=${priceId} currency=${price.currency}:`,
        (err as Error).message,
      );
    }

    return planPriceRepository.update(priceId, {
      status: 'ACTIVE',
      gatewayPriceId: stripePrice.id,
      gatewaySyncedAt: new Date(),
      amountUsdCents: fx?.amountUsdCents ?? null,
      fxRate: fx ? new Prisma.Decimal(fx.fxRate) : null,
      fxAsOf: fx?.fxAsOf ?? null,
      fxSource: fx?.fxSource ?? null,
    });
  }

  async archivePrice(planId: string, priceId: string, tenantId: string) {
    await this.findById(planId, tenantId);
    const price = await planPriceRepository.findById(priceId);
    if (!price || price.planId !== planId) {
      throw new NotFoundException('PlanPrice not found for this plan');
    }
    return planPriceRepository.update(priceId, { status: 'ARCHIVED', isActive: false });
  }
}

export const planService = new PlanService();
