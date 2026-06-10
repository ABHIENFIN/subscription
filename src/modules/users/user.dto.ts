import { z } from 'zod';

export const UpdateUserSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  status: z.enum(['ACTIVE', 'INVITED', 'SUSPENDED', 'DELETED']).optional(),
});

export const InviteUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  roles: z.array(z.string()).min(1),
});

export const AssignRoleSchema = z.object({
  roleId: z.string().uuid(),
});

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
export type InviteUserDto = z.infer<typeof InviteUserSchema>;
export type AssignRoleDto = z.infer<typeof AssignRoleSchema>;