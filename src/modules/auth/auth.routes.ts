import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { LoginSchema, AuthResponseSchema, UserResponseSchema } from './auth.dto';
import { signAccess, signRefresh, verifyRefresh } from './auth.service';
import { AuthenticatedUser } from '../../common/types';

const router = Router();

const DUMMY_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'admin@example.com',
  firstName: 'Admin',
  lastName: 'User',
  isActive: true,
  createdAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
  roles: ['super_admin', 'platform_admin', 'tenant_owner', 'tenant_admin', 'billing_manager', 'developer', 'viewer'],
  tenants: [
    {
      tenantId: '00000000-0000-0000-0000-0000000000ac',
      role: 'tenant_owner',
    },
  ],
};

function buildAuthenticatedUser(): AuthenticatedUser {
  return {
    id: DUMMY_USER.id,
    email: DUMMY_USER.email,
    tenantId: DUMMY_USER.tenants[0].tenantId,
    roles: DUMMY_USER.roles,
  };
}

function buildAuthResponse() {
  const user = buildAuthenticatedUser();
  return {
    user: DUMMY_USER,
    accessToken: signAccess(user),
    refreshToken: signRefresh(user),
  };
}

router.post(
  '/login',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      LoginSchema.parse(req.body);
      const payload = buildAuthResponse();
      res.status(200).json({ data: payload });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/refresh',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = (req.body as { refreshToken?: string })?.refreshToken;
      if (!refreshToken) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing refreshToken' } });
        return;
      }
      const decoded = verifyRefresh(refreshToken);
      const user: AuthenticatedUser = {
        id: decoded.sub,
        email: decoded.email,
        tenantId: decoded.tenantId,
        roles: decoded.roles,
      };
      res.status(200).json({
        data: {
          user: DUMMY_USER,
          accessToken: signAccess(user),
          refreshToken: signRefresh(user),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/me',
  authenticate,
  (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json({ data: DUMMY_USER });
    } catch (err) {
      next(err);
    }
  }
);

export { AuthResponseSchema, UserResponseSchema };
export default router;
