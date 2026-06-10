import prisma from '../../config/database.config';

export const planRepository = {
  findById: (id: string) => prisma.plan.findUnique({ where: { id } }),
  findByTenant: (tenantId: string, skip: number, take: number) =>
    prisma.plan.findMany({
      where: { tenantId },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
  create: (data: any) => prisma.plan.create({ data }),
  update: (id: string, data: any) => prisma.plan.update({ where: { id }, data }),
  delete: (id: string) => prisma.plan.delete({ where: { id } }),
};