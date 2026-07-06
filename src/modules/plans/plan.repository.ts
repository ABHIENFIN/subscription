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

export const planPriceRepository = {
  findById: (id: string) => prisma.planPrice.findUnique({ where: { id } }),
  findByPlan: (planId: string) =>
    prisma.planPrice.findMany({
      where: { planId },
      orderBy: { createdAt: 'asc' },
    }),
  create: (data: any) => prisma.planPrice.create({ data }),
  update: (id: string, data: any) => prisma.planPrice.update({ where: { id }, data }),
  delete: (id: string) => prisma.planPrice.delete({ where: { id } }),
};
