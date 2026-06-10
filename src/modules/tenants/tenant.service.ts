import { tenantRepository } from './tenant.repository';
import { CreateTenantDto, UpdateTenantDto } from './tenant.dto';
import { ConflictException, NotFoundException } from '../../common/exceptions';

export class TenantService {
  async create(dto: CreateTenantDto) {
    const existing = await tenantRepository.findBySlug(dto.slug);
    if (existing) {
      throw new ConflictException('Tenant with this slug already exists');
    }
    return tenantRepository.create({
      name: dto.name,
      slug: dto.slug,
      domain: dto.domain,
    });
  }

  async findById(id: string) {
    const tenant = await tenantRepository.findById(id);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  async list(skip = 0, take = 20) {
    return tenantRepository.findMany(skip, take);
  }

  async update(id: string, dto: UpdateTenantDto) {
    const existing = await tenantRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Tenant not found');
    }
    return tenantRepository.update(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.domain !== undefined ? { domain: dto.domain } : {}),
      ...(dto.paymentProvider !== undefined ? { paymentProvider: dto.paymentProvider } : {}),
    });
  }

  async delete(id: string) {
    const existing = await tenantRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Tenant not found');
    }
    await tenantRepository.delete(id);
  }
}

export const tenantService = new TenantService();