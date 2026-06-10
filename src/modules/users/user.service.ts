import bcrypt from 'bcryptjs';
import prisma from '../../config/database.config';
import { userRepository } from './user.repository';
import {
  UpdateUserDto,
  InviteUserDto,
} from './user.dto';
import {
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '../../common/exceptions';

export class UserService {
  async findById(id: string, requesterTenantId?: string) {
    const user = await userRepository.findById(id);
    if (!user) throw new NotFoundException('User not found');

    if (
      requesterTenantId &&
      user.tenantId &&
      user.tenantId !== requesterTenantId
    ) {
      throw new ForbiddenException('Cannot access users from other tenants');
    }
    return user;
  }

  async listByTenant(tenantId: string, skip = 0, take = 20) {
    return userRepository.findByTenant(tenantId, skip, take);
  }

  async update(id: string, dto: UpdateUserDto, requesterTenantId?: string) {
    const user = await userRepository.findById(id);
    if (!user) throw new NotFoundException('User not found');

    if (
      requesterTenantId &&
      user.tenantId &&
      user.tenantId !== requesterTenantId
    ) {
      throw new ForbiddenException('Cannot update users from other tenants');
    }
    return userRepository.update(id, dto);
  }

  async invite(tenantId: string, dto: InviteUserDto) {
    const existing = await userRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const tempPassword = await bcrypt.hash(Math.random().toString(36).slice(-12), 12);
    const user = await prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: tempPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        tenantId,
        status: 'INVITED',
      },
    });

    for (const roleName of dto.roles) {
      const role = await prisma.role.findUnique({ where: { name: roleName } });
      if (role) {
        await userRepository.assignRole(user.id, role.id);
      }
    }

    return userRepository.findById(user.id);
  }

  async remove(id: string, requesterTenantId?: string) {
    const user = await userRepository.findById(id);
    if (!user) throw new NotFoundException('User not found');

    if (
      requesterTenantId &&
      user.tenantId &&
      user.tenantId !== requesterTenantId
    ) {
      throw new ForbiddenException('Cannot remove users from other tenants');
    }
    await userRepository.delete(id);
  }

  async assignRole(userId: string, roleName: string, requesterTenantId?: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (
      requesterTenantId &&
      user.tenantId &&
      user.tenantId !== requesterTenantId
    ) {
      throw new ForbiddenException('Cannot assign roles to users from other tenants');
    }

    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new NotFoundException(`Role ${roleName} not found`);

    await userRepository.assignRole(userId, role.id);
    return userRepository.findById(userId);
  }

  async removeRole(userId: string, roleName: string, requesterTenantId?: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (
      requesterTenantId &&
      user.tenantId &&
      user.tenantId !== requesterTenantId
    ) {
      throw new ForbiddenException('Cannot remove roles from users in other tenants');
    }

    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new NotFoundException(`Role ${roleName} not found`);

    await userRepository.removeRole(userId, role.id);
  }
}

export const userService = new UserService();