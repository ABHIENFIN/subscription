import { Router } from 'express';
import { planController } from './plan.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';

const router = Router();

router.use(authenticate, tenantMiddleware);

router.post(
  '/',
  requireRoles('super_admin', 'tenant_owner', 'tenant_admin'),
  (req, res, next) => planController.create(req, res, next)
);

router.get(
  '/',
  requireRoles('super_admin', 'platform_admin', 'tenant_owner', 'tenant_admin', 'billing_manager', 'developer', 'viewer'),
  (req, res, next) => planController.list(req, res, next)
);

router.get(
  '/:id',
  requireRoles('super_admin', 'platform_admin', 'tenant_owner', 'tenant_admin', 'billing_manager', 'developer', 'viewer'),
  (req, res, next) => planController.getById(req, res, next)
);

router.patch(
  '/:id',
  requireRoles('super_admin', 'tenant_owner', 'tenant_admin'),
  (req, res, next) => planController.update(req, res, next)
);

router.delete(
  '/:id',
  requireRoles('super_admin', 'tenant_owner', 'tenant_admin'),
  (req, res, next) => planController.delete(req, res, next)
);

export default router;