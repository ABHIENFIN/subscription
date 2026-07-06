import { Request, Response, NextFunction } from 'express';
import { planService } from './plan.service';
import {
  CreatePlanSchema,
  UpdatePlanSchema,
  CreatePlanPriceSchema,
  UpdatePlanPriceSchema,
} from './plan.dto';
import { resolveTenantId } from '../../common/tenant';

export class PlanController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = CreatePlanSchema.parse(req.body);
      const tenantId = resolveTenantId(req, dto.tenantId);
      const plan = await planService.create(tenantId, dto);
      res.status(201).json({ data: plan });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = resolveTenantId(req);
      const plan = await planService.findById(req.params.id, tenantId);
      res.json({ data: plan });
    } catch (err) {
      next(err);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = resolveTenantId(req);
      const skip = parseInt((req.query.skip as string) ?? '0', 10);
      const take = Math.min(parseInt((req.query.take as string) ?? '20', 10), 100);
      const plans = await planService.list(tenantId, skip, take);
      res.json({ data: plans });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = UpdatePlanSchema.parse(req.body);
      const tenantId = resolveTenantId(req, dto.tenantId);
      const plan = await planService.update(req.params.id, tenantId, dto);
      res.json({ data: plan });
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = resolveTenantId(req);
      await planService.delete(req.params.id, tenantId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async publish(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = resolveTenantId(req);
      const plan = await planService.publishPlan(req.params.id, tenantId);
      res.json({ data: plan });
    } catch (err) {
      next(err);
    }
  }

  async archive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = resolveTenantId(req);
      const plan = await planService.archivePlan(req.params.id, tenantId);
      res.json({ data: plan });
    } catch (err) {
      next(err);
    }
  }

  async duplicate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = resolveTenantId(req);
      const plan = await planService.duplicatePlan(req.params.id, tenantId);
      res.status(201).json({ data: plan });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------- Prices -----------------------

  async listPrices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = resolveTenantId(req);
      const prices = await planService.listPrices(req.params.id, tenantId);
      res.json({ data: prices });
    } catch (err) {
      next(err);
    }
  }

  async addPrice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = CreatePlanPriceSchema.parse(req.body);
      const tenantId = resolveTenantId(req);
      const price = await planService.addPrice(req.params.id, tenantId, dto);
      res.status(201).json({ data: price });
    } catch (err) {
      next(err);
    }
  }

  async updatePrice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = UpdatePlanPriceSchema.parse(req.body);
      const tenantId = resolveTenantId(req);
      const price = await planService.updatePrice(
        req.params.id,
        req.params.priceId,
        tenantId,
        dto
      );
      res.json({ data: price });
    } catch (err) {
      next(err);
    }
  }

  async publishPrice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = resolveTenantId(req);
      const price = await planService.publishPrice(
        req.params.id,
        req.params.priceId,
        tenantId
      );
      res.json({ data: price });
    } catch (err) {
      next(err);
    }
  }

  async archivePrice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = resolveTenantId(req);
      const price = await planService.archivePrice(
        req.params.id,
        req.params.priceId,
        tenantId
      );
      res.json({ data: price });
    } catch (err) {
      next(err);
    }
  }
}

export const planController = new PlanController();
