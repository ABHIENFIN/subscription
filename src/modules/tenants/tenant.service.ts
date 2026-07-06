import { randomUUID } from 'crypto';
import { TenantResponse } from './tenant.dto';

const now = () => new Date().toISOString();

const seed: TenantResponse[] = [
  {
    id: '00000000-0000-0000-0000-0000000000ac',
    name: 'Acme',
    slug: 'acme',
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: '00000000-0000-0000-0000-0000000000b0',
    name: 'Globex',
    slug: 'globex',
    isActive: true,
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
  },
];

const store = new Map<string, TenantResponse>(seed.map((t) => [t.id, t]));

export const tenantService = {
  list({ skip = 0, take = 20 }: { skip?: number; take?: number } = {}): TenantResponse[] {
    return Array.from(store.values())
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(skip, skip + take);
  },

  findById(id: string): TenantResponse | null {
    return store.get(id) ?? null;
  },

  findBySlug(slug: string): TenantResponse | null {
    for (const tenant of store.values()) {
      if (tenant.slug === slug) return tenant;
    }
    return null;
  },

  create({ name, slug }: { name: string; slug: string }): TenantResponse {
    if (this.findBySlug(slug)) {
      const err = new Error('Tenant with this slug already exists');
      (err as Error & { code: string }).code = 'UNIQUE_VIOLATION';
      throw err;
    }
    const tenant: TenantResponse = {
      id: randomUUID(),
      name,
      slug,
      isActive: true,
      createdAt: now(),
      updatedAt: now(),
    };
    store.set(tenant.id, tenant);
    return tenant;
  },

  update(id: string, patch: Partial<{ name: string; slug: string; isActive: boolean }>): TenantResponse | null {
    const existing = store.get(id);
    if (!existing) return null;
    if (patch.slug && patch.slug !== existing.slug) {
      if (this.findBySlug(patch.slug)) {
        const err = new Error('Tenant with this slug already exists');
        (err as Error & { code: string }).code = 'UNIQUE_VIOLATION';
        throw err;
      }
    }
    const updated: TenantResponse = {
      ...existing,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.slug !== undefined ? { slug: patch.slug } : {}),
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      updatedAt: now(),
    };
    store.set(id, updated);
    return updated;
  },

  delete(id: string): boolean {
    return store.delete(id);
  },

  deactivate(id: string): TenantResponse | null {
    return this.update(id, { isActive: false });
  },
};
