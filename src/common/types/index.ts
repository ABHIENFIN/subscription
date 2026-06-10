declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      tenantId?: string;
    }
  }
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  tenantId?: string;
  roles: string[];
}

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId?: string;
  roles: string[];
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}
