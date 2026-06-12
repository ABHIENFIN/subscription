import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  tenantId: z.string().uuid().optional(),
  tenantName: z.string().optional(),
  tenantSlug: z.string().optional(),
}).openapi('RegisterRequest', { description: 'Register a new user; optionally create a tenant in the same call' });

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
}).openapi('LoginRequest', { description: 'Authenticate with email + password' });

export type RegisterDto = z.infer<typeof RegisterSchema>;
export type LoginDto = z.infer<typeof LoginSchema>;
