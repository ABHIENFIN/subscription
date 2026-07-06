import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { ConflictException, NotFoundException } from '../../common/exceptions';
import { PaginationQuery } from '../../docs/components';
import {
  CreateTenantSchema,
  UpdateTenantSchema,
  TenantResponseSchema,
  TenantListResponseSchema,
} from './tenant.dto';
import { tenantService } from './tenant.service';

const router = Router();

router.use(authenticate, tenantMiddleware);

const paramsSchema = z.object({ id: z.string().uuid() });

router.post(
  '/',
  requireRoles('super_admin', 'platform_admin'),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = CreateTenantSchema.parse(req.body);
      const tenant = tenantService.create(dto);
      res.status(201).json({ data: tenant });
    } catch (err) {
      if ((err as Error & { code?: string }).code === 'UNIQUE_VIOLATION') {
        next(new ConflictException((err as Error).message));
        return;
      }
      next(err);
    }
  }
);

router.get(
  '/',
  requireRoles('super_admin', 'platform_admin', 'tenant_owner', 'tenant_admin', 'billing_manager', 'developer', 'viewer'),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { skip, take } = PaginationQuery.parse(req.query);
      res.status(200).json({ data: tenantService.list({ skip, take }) });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id',
  requireRoles('super_admin', 'platform_admin', 'tenant_owner', 'tenant_admin', 'billing_manager', 'developer', 'viewer'),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = paramsSchema.parse(req.params);
      const tenant = tenantService.findById(id);
      if (!tenant) {
        next(new NotFoundException('Tenant not found'));
        return;
      }
      res.status(200).json({ data: tenant });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:id',
  requireRoles('super_admin', 'platform_admin'),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = paramsSchema.parse(req.params);
      const dto = UpdateTenantSchema.parse(req.body);
      const tenant = tenantService.update(id, dto);
      if (!tenant) {
        next(new NotFoundException('Tenant not found'));
        return;
      }
      res.status(200).json({ data: tenant });
    } catch (err) {
      if ((err as Error & { code?: string }).code === 'UNIQUE_VIOLATION') {
        next(new ConflictException((err as Error).message));
        return;
      }
      next(err);
    }
  }
);

router.delete(
  '/:id',
  requireRoles('super_admin', 'platform_admin'),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = paramsSchema.parse(req.params);
      const removed = tenantService.delete(id);
      if (!removed) {
        next(new NotFoundException('Tenant not found'));
        return;
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/deactivate',
  requireRoles('super_admin', 'platform_admin'),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = paramsSchema.parse(req.params);
      const tenant = tenantService.deactivate(id);
      if (!tenant) {
        next(new NotFoundException('Tenant not found'));
        return;
      }
      res.status(200).json({ data: tenant });
    } catch (err) {
      next(err);
    }
  }
);

export { TenantResponseSchema, TenantListResponseSchema };
export default router;
