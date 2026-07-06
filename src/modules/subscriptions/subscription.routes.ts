import { Router } from 'express';
import { subscriptionController } from './subscription.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';

const router = Router();

router.use(authenticate, tenantMiddleware);

router.post(
  '/',
  requireRoles('tenant_owner', 'tenant_admin', 'billing_manager'),
  (req, res, next) => subscriptionController.create(req, res, next)
);

router.get(
  '/',
  requireRoles('super_admin', 'platform_admin', 'tenant_owner', 'tenant_admin', 'billing_manager', 'developer', 'viewer'),
  (req, res, next) => subscriptionController.list(req, res, next)
);

router.get(
  '/:id',
  requireRoles('super_admin', 'platform_admin', 'tenant_owner', 'tenant_admin', 'billing_manager', 'developer', 'viewer'),
  (req, res, next) => subscriptionController.getById(req, res, next)
);

router.post(
  '/:id/cancel',
  requireRoles('tenant_owner', 'tenant_admin', 'billing_manager'),
  (req, res, next) => subscriptionController.cancel(req, res, next)
);

router.post(
  '/:id/pause',
  requireRoles('tenant_owner', 'tenant_admin', 'billing_manager'),
  (req, res, next) => subscriptionController.pause(req, res, next)
);

router.post(
  '/:id/resume',
  requireRoles('tenant_owner', 'tenant_admin', 'billing_manager'),
  (req, res, next) => subscriptionController.resume(req, res, next)
);

router.post(
  '/:id/usage',
  requireRoles('tenant_owner', 'tenant_admin', 'billing_manager'),
  (req, res, next) => subscriptionController.recordUsage(req, res, next)
);

export default router;