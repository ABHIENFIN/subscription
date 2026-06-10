import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { jwtConfig } from '../../config/jwt.config';
import { JwtPayload } from '../../common/types';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '../../common/exceptions';
import { RegisterDto, LoginDto } from './auth.dto';

const prisma = new PrismaClient();

export class AuthService {
  async register(dto: RegisterDto) {
    const existing = await prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    let tenantId = dto.tenantId;

    if (dto.tenantName && dto.tenantSlug && !tenantId) {
      const tenant = await prisma.tenant.create({
        data: {
          name: dto.tenantName,
          slug: dto.tenantSlug,
        },
      });
      tenantId = tenant.id;
    }

    const user = await prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        tenantId,
      },
    });

    if (tenantId && !dto.tenantId) {
      await this.assignRoleToUser(user.id, 'tenant_owner');
    }

    const tokens = await this.generateTokens({
      id: user.id,
      email: user.email,
      tenantId: user.tenantId ?? undefined,
      roles: await this.getUserRoles(user.id),
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        tenantId: user.tenantId,
      },
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const roles = await this.getUserRoles(user.id);

    const tokens = await this.generateTokens({
      id: user.id,
      email: user.email,
      tenantId: user.tenantId ?? undefined,
      roles,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        tenantId: user.tenantId,
        roles,
      },
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    try {
      const decoded = jwt.verify(refreshToken, jwtConfig.refreshSecret) as JwtPayload;
      if (decoded.type !== 'refresh') {
        throw new BadRequestException('Invalid token type');
      }
      return this.generateTokens({
        id: decoded.sub,
        email: decoded.email,
        tenantId: decoded.tenantId,
        roles: decoded.roles,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async generateTokens(payload: {
    id: string;
    email: string;
    tenantId?: string;
    roles: string[];
  }) {
    const accessPayload: JwtPayload = {
      sub: payload.id,
      email: payload.email,
      tenantId: payload.tenantId,
      roles: payload.roles,
      type: 'access',
    };

    const refreshPayload: JwtPayload = {
      ...accessPayload,
      type: 'refresh',
    };

    const accessToken = jwt.sign(accessPayload, jwtConfig.secret, {
      expiresIn: jwtConfig.expiresIn,
    } as SignOptions);

    const refreshToken = jwt.sign(refreshPayload, jwtConfig.refreshSecret, {
      expiresIn: jwtConfig.refreshExpiresIn,
    } as SignOptions);

    return { accessToken, refreshToken };
  }

  private async getUserRoles(userId: string): Promise<string[]> {
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
    return userRoles.map((ur) => ur.role.name);
  }

  private async assignRoleToUser(userId: string, roleName: string): Promise<void> {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      throw new BadRequestException(`Role ${roleName} does not exist`);
    }
    await prisma.userRole.create({
      data: { userId, roleId: role.id },
    });
  }
}

export const authService = new AuthService();