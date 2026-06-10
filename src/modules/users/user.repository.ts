import prisma from '../../config/database.config';

export const userRepository = {
  findById: (id: string) =>
    prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    }),
  findByEmail: (email: string) => prisma.user.findUnique({ where: { email } }),
  findByTenant: (tenantId: string, skip: number, take: number) =>
    prisma.user.findMany({
      where: { tenantId },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { roles: { include: { role: true } } },
    }),
  update: (id: string, data: { firstName?: string; lastName?: string; status?: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'DELETED' }) =>
    prisma.user.update({ where: { id }, data }),
  delete: (id: string) => prisma.user.delete({ where: { id } }),
  assignRole: (userId: string, roleId: string) =>
    prisma.userRole.create({ data: { userId, roleId } }),
  removeRole: (userId: string, roleId: string) =>
    prisma.userRole.delete({ where: { userId_roleId: { userId, roleId } } }),
};