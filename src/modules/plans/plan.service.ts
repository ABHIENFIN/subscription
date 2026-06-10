import { planRepository } from './plan.repository';
import { CreatePlanDto, UpdatePlanDto } from './plan.dto';
import { NotFoundException } from '../../common/exceptions';

export class PlanService {
  async create(tenantId: string, dto: CreatePlanDto) {
    return planRepository.create({
      ...dto,
      tenantId,
    });
  }

  async findById(id: string, tenantId: string) {
    const plan = await planRepository.findById(id);
    if (!plan) throw new NotFoundException('Plan not found');
    if (plan.tenantId !== tenantId) {
      throw new NotFoundException('Plan not found in this tenant');
    }
    return plan;
  }

  async list(tenantId: string, skip = 0, take = 20) {
    return planRepository.findByTenant(tenantId, skip, take);
  }

  async update(id: string, tenantId: string, dto: UpdatePlanDto) {
    await this.findById(id, tenantId);
    return planRepository.update(id, dto);
  }

  async delete(id: string, tenantId: string) {
    await this.findById(id, tenantId);
    await planRepository.delete(id);
  }
}

export const planService = new PlanService();