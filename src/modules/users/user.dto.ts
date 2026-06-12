import { z } from 'zod';

export const UpdateUserSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  status: z.enum(['ACTIVE', 'INVITED', 'SUSPENDED', 'DELETED']).optional(),
}).openapi('UpdateUserRequest', { description: 'Update user profile fields' });

export const InviteUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  roles: z.array(z.string()).min(1),
}).openapi('InviteUserRequest', { description: 'Invite a user to the current tenant with one or more roles' });

export const AssignRoleSchema = z.object({
  roleName: z.string().min(1),
}).openapi('AssignRoleRequest', { description: 'Assign a role to a user by role name (e.g. tenant_admin)' });

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
export type InviteUserDto = z.infer<typeof InviteUserSchema>;
export type AssignRoleDto = z.infer<typeof AssignRoleSchema>;