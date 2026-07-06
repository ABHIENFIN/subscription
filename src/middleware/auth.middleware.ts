import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.config';
import { JwtPayload, AuthenticatedUser } from '../common/types';
import { UnauthorizedException } from '../common/exceptions';

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  if (process.env.SKIP_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
    console.warn('[auth] SKIP_AUTH enabled — requests are unauthenticated (dev only)');
    req.user = {
      id: 'dev-user',
      email: 'dev@local',
      tenantId: req.header('x-tenant-id') ?? undefined,
      roles: ['super_admin', 'tenant_owner', 'tenant_admin', 'billing_manager'],
    };
    return next();
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, jwtConfig.secret) as JwtPayload;

    if (decoded.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user: AuthenticatedUser = {
      id: decoded.sub,
      email: decoded.email,
      tenantId: decoded.tenantId,
      roles: decoded.roles,
    };

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof UnauthorizedException) {
      next(error);
      return;
    }
    next(new UnauthorizedException('Invalid or expired token'));
  }
};
