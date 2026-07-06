import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { resolveTenantId } from '../../common/tenant';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '../../common/exceptions';
import { PaginationQuery } from '../../docs/components';
import {
  CreateUserSchema,
  UserResponseSchema,
  UserListResponseSchema,
} from './user.dto';
import { userService } from './user.service';

const router = Router();

router.use(authenticate, tenantMiddleware);

const paramsSchema = z.object({ id: z.string().uuid() });

const listQuery = PaginationQuery.extend({
  tenantId: z.string().uuid().optional(),
});

const PLATFORM_ROLES = ['super_admin', 'platform_admin'];

router.get(
  '/',
  requireRoles('super_admin', 'platform_admin', 'tenant_owner', 'tenant_admin', 'billing_manager', 'developer', 'viewer'),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { skip, take, tenantId } = listQuery.parse(req.query);
      const isPlatform = req.user!.roles.some((r) => PLATFORM_ROLES.includes(r));
      const filterTenantId = isPlatform ? tenantId : req.tenantId;
      res.status(200).json({ data: userService.list({ tenantId: filterTenantId, skip, take }) });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/',
  requireRoles('super_admin', 'platform_admin', 'tenant_owner', 'tenant_admin'),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = CreateUserSchema.parse(req.body);
      const isPlatform = req.user!.roles.some((r) => PLATFORM_ROLES.includes(r));
      let tenantId: string;
      try {
        tenantId = isPlatform
          ? (dto.tenantId ?? resolveTenantId(req))
          : req.tenantId ?? resolveTenantId(req);
      } catch {
        throw new BadRequestException('tenantId is required for platform users');
      }
      if (!isPlatform && dto.tenantId && dto.tenantId !== req.tenantId) {
        throw new ForbiddenException('Cannot create users in other tenants');
      }
      const user = userService.create({ ...dto, tenantId });
      res.status(201).json({ data: user });
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
  '/:id',
  requireRoles('super_admin', 'platform_admin', 'tenant_owner', 'tenant_admin', 'billing_manager', 'developer', 'viewer'),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = paramsSchema.parse(req.params);
      const user = userService.findById(id);
      if (!user) {
        next(new NotFoundException('User not found'));
        return;
      }
      const isPlatform = req.user!.roles.some((r) => PLATFORM_ROLES.includes(r));
      if (!isPlatform) {
        const userTenantIds = (user.tenants ?? []).map((t) => t.tenantId);
        if (!req.tenantId || !userTenantIds.includes(req.tenantId)) {
          next(new NotFoundException('User not found'));
          return;
        }
      }
      res.status(200).json({ data: user });
    } catch (err) {
      next(err);
    }
  }
);

export { UserResponseSchema, UserListResponseSchema };
export default router;
