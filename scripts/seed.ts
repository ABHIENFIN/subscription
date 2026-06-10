import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PLATFORM_ROLES = [
  { name: 'super_admin', scope: 'PLATFORM' as const, description: 'Full platform access' },
  { name: 'platform_admin', scope: 'PLATFORM' as const, description: 'Manage tenants, view billing' },
];

const TENANT_ROLES = [
  { name: 'tenant_owner', scope: 'TENANT' as const, description: 'Full tenant access' },
  { name: 'tenant_admin', scope: 'TENANT' as const, description: 'Manage plans, users, subscriptions' },
  { name: 'billing_manager', scope: 'TENANT' as const, description: 'Manage invoices, trigger renewals' },
  { name: 'developer', scope: 'TENANT' as const, description: 'Read-only + webhook config, API key management' },
  { name: 'viewer', scope: 'TENANT' as const, description: 'Read-only access' },
];

async function main() {
  console.log('[Seed] Seeding roles...');
  for (const role of [...PLATFORM_ROLES, ...TENANT_ROLES]) {
    await prisma.role.upsert({
      where: { name: role.name },
      create: role,
      update: { scope: role.scope, description: role.description },
    });
  }
  console.log(`[Seed] Seeded ${PLATFORM_ROLES.length + TENANT_ROLES.length} roles.`);

  const superAdminEmail = 'admin@example.com';
  const existing = await prisma.user.findUnique({ where: { email: superAdminEmail } });
  if (!existing) {
    const passwordHash = await bcrypt.hash('changeme123', 12);
    const admin = await prisma.user.create({
      data: {
        email: superAdminEmail,
        passwordHash,
        firstName: 'Super',
        lastName: 'Admin',
      },
    });
    const superAdminRole = await prisma.role.findUnique({ where: { name: 'super_admin' } });
    if (superAdminRole) {
      await prisma.userRole.create({
        data: { userId: admin.id, roleId: superAdminRole.id },
      });
    }
    console.log(`[Seed] Created super_admin user: ${superAdminEmail} / changeme123`);
  } else {
    console.log(`[Seed] Super admin already exists: ${superAdminEmail}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());