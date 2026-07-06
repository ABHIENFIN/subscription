import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
}).openapi('LoginRequest', {
  description:
    'Stub login. In production this is handled by the external identity service. ' +
    'For local dev, any non-empty email/password returns a hardcoded admin user with ' +
    'both platform (super_admin) and tenant (tenant_owner) roles.',
});

export const UserResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  createdAt: z.string().datetime().optional(),
  roles: z.array(z.string()).optional(),
  tenants: z.array(z.object({ tenantId: z.string(), role: z.string() })).optional(),
}).openapi('UserResponse');

export const AuthResponseSchema = z.object({
  user: UserResponseSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
}).openapi('AuthResponse');

export type LoginDto = z.infer<typeof LoginSchema>;
export type UserResponse = z.infer<typeof UserResponseSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
