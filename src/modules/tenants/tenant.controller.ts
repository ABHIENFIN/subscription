import { Request, Response, NextFunction } from 'express';
import { tenantService } from './tenant.service';
import { CreateTenantSchema, UpdateTenantSchema } from './tenant.dto';

export class TenantController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = CreateTenantSchema.parse(req.body);
      const tenant = await tenantService.create(dto);
      res.status(201).json({ data: tenant });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenant = await tenantService.findById(req.params.id);
      res.json({ data: tenant });
    } catch (err) {
      next(err);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const skip = parseInt((req.query.skip as string) ?? '0', 10);
      const take = Math.min(parseInt((req.query.take as string) ?? '20', 10), 100);
      const tenants = await tenantService.list(skip, take);
      res.json({ data: tenants });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = UpdateTenantSchema.parse(req.body);
      const tenant = await tenantService.update(req.params.id, dto);
      res.json({ data: tenant });
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await tenantService.delete(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}

export const tenantController = new TenantController();