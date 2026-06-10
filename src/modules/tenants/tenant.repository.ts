import prisma from '../../config/database.config';

export const tenantRepository = {
  findById: (id: string) => prisma.tenant.findUnique({ where: { id } }),
  findBySlug: (slug: string) => prisma.tenant.findUnique({ where: { slug } }),
  findMany: (skip: number, take: number) =>
    prisma.tenant.findMany({ skip, take, orderBy: { createdAt: 'desc' } }),
  create: (data: { name: string; slug: string; domain?: string }) =>
    prisma.tenant.create({ data }),
  update: (id: string, data: Partial<{ name: string; domain: string; paymentProvider: string }>) =>
    prisma.tenant.update({ where: { id }, data }),
  delete: (id: string) => prisma.tenant.delete({ where: { id } }),
};
