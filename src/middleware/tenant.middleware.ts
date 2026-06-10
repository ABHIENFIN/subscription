import { Request, Response, NextFunction } from 'express';
import { ForbiddenException } from '../common/exceptions';

export const tenantMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    next(new ForbiddenException('Authentication required'));
    return;
  }

  const platformRoles = ['super_admin', 'platform_admin'];
  const isPlatformUser = req.user.roles.some((r) => platformRoles.includes(r));

  if (isPlatformUser) {
    const headerTenantId = req.headers['x-tenant-id'] as string | undefined;
    req.tenantId = headerTenantId;
    next();
    return;
  }

  if (!req.user.tenantId) {
    next(new ForbiddenException('No tenant associated with user'));
    return;
  }

  const headerTenantId = req.headers['x-tenant-id'] as string | undefined;
  if (headerTenantId && headerTenantId !== req.user.tenantId) {
    next(new ForbiddenException('Cannot access other tenant resources'));
    return;
  }

  req.tenantId = req.user.tenantId;
  next();
};