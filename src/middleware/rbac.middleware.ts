import { Request, Response, NextFunction } from 'express';
import { ForbiddenException } from '../common/exceptions';

export const requireRoles = (...allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ForbiddenException('Unauthenticated'));
      return;
    }

    const userRoles = req.user.roles ?? [];
    const hasRole = allowedRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      next(
        new ForbiddenException(
          `Access denied. Required roles: ${allowedRoles.join(', ')}`
        )
      );
      return;
    }

    next();
  };
};