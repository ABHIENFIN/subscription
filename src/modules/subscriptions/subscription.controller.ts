import { Request, Response, NextFunction } from 'express';
import { subscriptionService } from './subscription.service';
import {
  CreateSubscriptionSchema,
  CancelSubscriptionSchema,
  RecordUsageSchema,
} from './subscription.dto';
import { resolveTenantId } from '../../common/tenant';

export class SubscriptionController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = CreateSubscriptionSchema.parse(req.body);
      const tenantId = resolveTenantId(req, dto.tenantId);
      const sub = await subscriptionService.create(
        tenantId,
        req.user!.id,
        dto
      );
      res.status(201).json({ data: sub });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = resolveTenantId(req);
      const sub = await subscriptionService.findById(req.params.id, tenantId);
      res.json({ data: sub });
    } catch (err) {
      next(err);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = resolveTenantId(req);
      const skip = parseInt((req.query.skip as string) ?? '0', 10);
      const take = Math.min(parseInt((req.query.take as string) ?? '20', 10), 100);
      const subs = await subscriptionService.listByTenant(tenantId, skip, take);
      res.json({ data: subs });
    } catch (err) {
      next(err);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = CancelSubscriptionSchema.parse(req.body ?? {});
      const tenantId = resolveTenantId(req, dto.tenantId);
      const sub = await subscriptionService.cancel(req.params.id, tenantId, dto);
      res.json({ data: sub });
    } catch (err) {
      next(err);
    }
  }

  async pause(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = resolveTenantId(req);
      const sub = await subscriptionService.pause(req.params.id, tenantId);
      res.json({ data: sub });
    } catch (err) {
      next(err);
    }
  }

  async resume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = resolveTenantId(req);
      const sub = await subscriptionService.resume(req.params.id, tenantId);
      res.json({ data: sub });
    } catch (err) {
      next(err);
    }
  }

  async recordUsage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = RecordUsageSchema.parse(req.body);
      const tenantId = resolveTenantId(req, dto.tenantId);
      const result = await subscriptionService.recordUsage(req.params.id, tenantId, dto);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const subscriptionController = new SubscriptionController();