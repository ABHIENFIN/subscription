import { z } from 'zod';

export const TENANT_USER_ROLES = [
  'tenant_owner',
  'tenant_admin',
  'billing_manager',
  'developer',
  'viewer',
] as const;

export const CreateUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  tenantId: z.string().uuid().optional()
    .describe('Required for platform callers. Ignored for tenant-scoped callers (pinned to their tenant).'),
  role: z.enum(TENANT_USER_ROLES).default('viewer'),
}).openapi('CreateUserRequest', {
  description: 'Stub user creation. In production this is owned by the external identity service.',
});

export const UserResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  roles: z.array(z.string()).optional(),
  tenants: z.array(z.object({ tenantId: z.string(), role: z.string() })).optional(),
}).openapi('UserResponse');

export const UserListResponseSchema = z.array(UserResponseSchema).openapi('UserListResponse');

export type CreateUserDto = z.infer<typeof CreateUserSchema>;
export type UserResponse = z.infer<typeof UserResponseSchema>;
