import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { resolveTenantId } from '../../common/tenant';
import { getGateway } from '../../payments/gateway.factory';
import { CreateCustomerSchema } from './customer.dto';

const router = Router();

router.use(authenticate, tenantMiddleware);

router.post(
  '/',
  requireRoles('super_admin', 'tenant_owner', 'tenant_admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = CreateCustomerSchema.parse(req.body);
      const tenantId = resolveTenantId(req);
      const provider = process.env.DEFAULT_PAYMENT_PROVIDER ?? 'stripe';
      const gateway = getGateway(provider);
      const customer = await gateway.createCustomer({
        email: dto.email,
        name: dto.name,
        tenantId,
        metadata: dto.metadata,
      });
      res.status(201).json({ data: customer });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
