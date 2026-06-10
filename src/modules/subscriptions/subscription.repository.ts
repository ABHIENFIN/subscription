import prisma from '../../config/database.config';

export const subscriptionRepository = {
  findById: (id: string) =>
    prisma.subscription.findUnique({
      where: { id },
      include: { plan: true, user: true },
    }),
  findByUser: (userId: string, tenantId: string, skip: number, take: number) =>
    prisma.subscription.findMany({
      where: { userId, tenantId },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    }),
  findByTenant: (tenantId: string, skip: number, take: number) =>
    prisma.subscription.findMany({
      where: { tenantId },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { plan: true, user: true },
    }),
  create: (data: any) => prisma.subscription.create({ data }),
  update: (id: string, data: any) => prisma.subscription.update({ where: { id }, data }),
  delete: (id: string) => prisma.subscription.delete({ where: { id } }),
};