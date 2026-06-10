import { Router } from 'express';
import { userController } from './user.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';

const router = Router();

router.use(authenticate, tenantMiddleware);

router.post(
  '/invite',
  requireRoles('super_admin', 'tenant_owner', 'tenant_admin'),
  (req, res, next) => userController.invite(req, res, next)
);

router.get(
  '/',
  requireRoles('super_admin', 'platform_admin', 'tenant_owner', 'tenant_admin', 'developer', 'viewer'),
  (req, res, next) => userController.list(req, res, next)
);

router.get(
  '/:id',
  requireRoles('super_admin', 'platform_admin', 'tenant_owner', 'tenant_admin', 'developer', 'viewer'),
  (req, res, next) => userController.getById(req, res, next)
);

router.patch(
  '/:id',
  requireRoles('super_admin', 'tenant_owner', 'tenant_admin'),
  (req, res, next) => userController.update(req, res, next)
);

router.delete(
  '/:id',
  requireRoles('super_admin', 'tenant_owner', 'tenant_admin'),
  (req, res, next) => userController.remove(req, res, next)
);

router.post(
  '/:id/roles',
  requireRoles('super_admin', 'tenant_owner', 'tenant_admin'),
  (req, res, next) => userController.assignRole(req, res, next)
);

router.delete(
  '/:id/roles',
  requireRoles('super_admin', 'tenant_owner', 'tenant_admin'),
  (req, res, next) => userController.removeRole(req, res, next)
);

export default router;