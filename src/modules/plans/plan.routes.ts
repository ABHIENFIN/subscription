import { Router } from 'express';
import { planController } from './plan.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';

const router = Router();

router.use(authenticate, tenantMiddleware);

// Plan CRUD
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

router.post(
  '/:id/publish',
  requireRoles('super_admin', 'tenant_owner', 'tenant_admin'),
  (req, res, next) => planController.publish(req, res, next)
);

router.post(
  '/:id/archive',
  requireRoles('super_admin', 'tenant_owner', 'tenant_admin'),
  (req, res, next) => planController.archive(req, res, next)
);

router.post(
  '/:id/duplicate',
  requireRoles('super_admin', 'tenant_owner', 'tenant_admin'),
  (req, res, next) => planController.duplicate(req, res, next)
);

// PlanPrice sub-resource
router.get(
  '/:id/prices',
  requireRoles('super_admin', 'platform_admin', 'tenant_owner', 'tenant_admin', 'billing_manager', 'developer', 'viewer'),
  (req, res, next) => planController.listPrices(req, res, next)
);

router.post(
  '/:id/prices',
  requireRoles('super_admin', 'tenant_owner', 'tenant_admin'),
  (req, res, next) => planController.addPrice(req, res, next)
);

router.patch(
  '/:id/prices/:priceId',
  requireRoles('super_admin', 'tenant_owner', 'tenant_admin'),
  (req, res, next) => planController.updatePrice(req, res, next)
);

router.post(
  '/:id/prices/:priceId/publish',
  requireRoles('super_admin', 'tenant_owner', 'tenant_admin'),
  (req, res, next) => planController.publishPrice(req, res, next)
);

router.post(
  '/:id/prices/:priceId/archive',
  requireRoles('super_admin', 'tenant_owner', 'tenant_admin'),
  (req, res, next) => planController.archivePrice(req, res, next)
);

export default router;
