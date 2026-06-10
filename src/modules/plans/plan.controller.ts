import { Request, Response, NextFunction } from 'express';
import { planService } from './plan.service';
import { CreatePlanSchema, UpdatePlanSchema } from './plan.dto';

export class PlanController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = CreatePlanSchema.parse(req.body);
      const plan = await planService.create(req.tenantId!, dto);
      res.status(201).json({ data: plan });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await planService.findById(req.params.id, req.tenantId!);
      res.json({ data: plan });
    } catch (err) {
      next(err);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const skip = parseInt((req.query.skip as string) ?? '0', 10);
      const take = Math.min(parseInt((req.query.take as string) ?? '20', 10), 100);
      const plans = await planService.list(req.tenantId!, skip, take);
      res.json({ data: plans });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = UpdatePlanSchema.parse(req.body);
      const plan = await planService.update(req.params.id, req.tenantId!, dto);
      res.json({ data: plan });
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await planService.delete(req.params.id, req.tenantId!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}

export const planController = new PlanController();