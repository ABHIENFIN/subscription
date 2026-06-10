import { Request, Response, NextFunction } from 'express';
import { userService } from './user.service';
import {
  UpdateUserSchema,
  InviteUserSchema,
} from './user.dto';

export class UserController {
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.findById(req.params.id, req.tenantId);
      res.json({ data: user });
    } catch (err) {
      next(err);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const skip = parseInt((req.query.skip as string) ?? '0', 10);
      const take = Math.min(parseInt((req.query.take as string) ?? '20', 10), 100);
      const users = await userService.listByTenant(req.tenantId!, skip, take);
      res.json({ data: users });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = UpdateUserSchema.parse(req.body);
      const user = await userService.update(req.params.id, dto, req.tenantId);
      res.json({ data: user });
    } catch (err) {
      next(err);
    }
  }

  async invite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = InviteUserSchema.parse(req.body);
      const user = await userService.invite(req.tenantId!, dto);
      res.status(201).json({ data: user });
    } catch (err) {
      next(err);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await userService.remove(req.params.id, req.tenantId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async assignRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roleName } = req.body;
      const user = await userService.assignRole(req.params.id, roleName, req.tenantId);
      res.json({ data: user });
    } catch (err) {
      next(err);
    }
  }

  async removeRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roleName } = req.body;
      await userService.removeRole(req.params.id, roleName, req.tenantId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}

export const userController = new UserController();