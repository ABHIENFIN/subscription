import jwt from 'jsonwebtoken';
import { jwtConfig } from '../../config/jwt.config';
import { JwtPayload, AuthenticatedUser } from '../../common/types';
import { UnauthorizedException } from '../../common/exceptions';

export function signAccess(user: AuthenticatedUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles: user.roles,
      type: 'access',
    } as Omit<JwtPayload, 'iat' | 'exp'>,
    jwtConfig.secret,
    { expiresIn: jwtConfig.expiresIn as jwt.SignOptions['expiresIn'] }
  );
}

export function signRefresh(user: AuthenticatedUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles: user.roles,
      type: 'refresh',
    } as Omit<JwtPayload, 'iat' | 'exp'>,
    jwtConfig.refreshSecret,
    { expiresIn: jwtConfig.refreshExpiresIn as jwt.SignOptions['expiresIn'] }
  );
}

export function verifyAccess(token: string): JwtPayload {
  try {
    return jwt.verify(token, jwtConfig.secret) as JwtPayload;
  } catch {
    throw new UnauthorizedException('Invalid or expired access token');
  }
}

export function verifyRefresh(token: string): JwtPayload {
  try {
    return jwt.verify(token, jwtConfig.refreshSecret) as JwtPayload;
  } catch {
    throw new UnauthorizedException('Invalid or expired refresh token');
  }
}
