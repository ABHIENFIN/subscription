import { Request, Response, NextFunction } from 'express';
import { subscriptionService } from './subscription.service';
import {
  CreateSubscriptionSchema,
  CancelSubscriptionSchema,
} from './subscription.dto';

export class SubscriptionController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = CreateSubscriptionSchema.parse(req.body);
      const sub = await subscriptionService.create(
        req.tenantId!,
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
      const sub = await subscriptionService.findById(req.params.id, req.tenantId!);
      res.json({ data: sub });
    } catch (err) {
      next(err);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const skip = parseInt((req.query.skip as string) ?? '0', 10);
      const take = Math.min(parseInt((req.query.take as string) ?? '20', 10), 100);
      const subs = await subscriptionService.listByTenant(req.tenantId!, skip, take);
      res.json({ data: subs });
    } catch (err) {
      next(err);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = CancelSubscriptionSchema.parse(req.body ?? {});
      const sub = await subscriptionService.cancel(req.params.id, req.tenantId!, dto);
      res.json({ data: sub });
    } catch (err) {
      next(err);
    }
  }

  async pause(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sub = await subscriptionService.pause(req.params.id, req.tenantId!);
      res.json({ data: sub });
    } catch (err) {
      next(err);
    }
  }

  async resume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sub = await subscriptionService.resume(req.params.id, req.tenantId!);
      res.json({ data: sub });
    } catch (err) {
      next(err);
    }
  }
}

export const subscriptionController = new SubscriptionController();