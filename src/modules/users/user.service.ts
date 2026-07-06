import { randomUUID } from 'crypto';
import { UserResponse } from './user.dto';

const now = () => new Date().toISOString();

const seed: UserResponse[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    roles: ['super_admin', 'platform_admin', 'tenant_owner', 'tenant_admin', 'billing_manager', 'developer', 'viewer'],
    tenants: [{ tenantId: '00000000-0000-0000-0000-0000000000ac', role: 'tenant_owner' }],
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'alice@acme.test',
    firstName: 'Alice',
    lastName: 'Anderson',
    isActive: true,
    createdAt: '2024-02-01T00:00:00.000Z',
    roles: ['tenant_admin'],
    tenants: [{ tenantId: '00000000-0000-0000-0000-0000000000ac', role: 'tenant_admin' }],
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'bob@acme.test',
    firstName: 'Bob',
    lastName: 'Brown',
    isActive: true,
    createdAt: '2024-02-15T00:00:00.000Z',
    roles: ['billing_manager'],
    tenants: [{ tenantId: '00000000-0000-0000-0000-0000000000ac', role: 'billing_manager' }],
  },
];

const store = new Map<string, UserResponse>(seed.map((u) => [u.id, u]));

export const userService = {
  list({ tenantId, skip = 0, take = 20 }: { tenantId?: string; skip?: number; take?: number } = {}): UserResponse[] {
    let rows = Array.from(store.values());
    if (tenantId) {
      rows = rows.filter((u) => (u.tenants ?? []).some((t) => t.tenantId === tenantId));
    }
    return rows
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(skip, skip + take);
  },

  findById(id: string): UserResponse | null {
    return store.get(id) ?? null;
  },

  findByEmail(email: string): UserResponse | null {
    for (const u of store.values()) {
      if (u.email === email) return u;
    }
    return null;
  },

  create({
    email,
    firstName,
    lastName,
    tenantId,
    role = 'viewer',
  }: {
    email: string;
    firstName?: string;
    lastName?: string;
    tenantId: string;
    role?: string;
  }): UserResponse {
    if (this.findByEmail(email)) {
      const err = new Error('User with this email already exists');
      (err as Error & { code: string }).code = 'UNIQUE_VIOLATION';
      throw err;
    }
    const user: UserResponse = {
      id: randomUUID(),
      email,
      firstName: firstName ?? null,
      lastName: lastName ?? null,
      isActive: true,
      createdAt: now(),
      roles: [role],
      tenants: [{ tenantId, role }],
    };
    store.set(user.id, user);
    return user;
  },
};
