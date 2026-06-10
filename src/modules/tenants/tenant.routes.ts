import { Router } from 'express';
import { tenantController } from './tenant.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';

const router = Router();

router.use(authenticate, tenantMiddleware);

router.post(
  '/',
  requireRoles('super_admin'),
  (req, res, next) => tenantController.create(req, res, next)
);

router.get(
  '/',
  requireRoles('super_admin', 'platform_admin'),
  (req, res, next) => tenantController.list(req, res, next)
);

router.get(
  '/:id',
  requireRoles('super_admin', 'platform_admin', 'tenant_owner', 'tenant_admin', 'billing_manager', 'developer', 'viewer'),
  (req, res, next) => tenantController.getById(req, res, next)
);

router.patch(
  '/:id',
  requireRoles('super_admin', 'tenant_owner'),
  (req, res, next) => tenantController.update(req, res, next)
);

router.delete(
  '/:id',
  requireRoles('super_admin'),
  (req, res, next) => tenantController.delete(req, res, next)
);

export default router;