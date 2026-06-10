import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { RegisterSchema, LoginSchema } from './auth.dto';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = RegisterSchema.parse(req.body);
      const result = await authService.register(dto);
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = LoginSchema.parse(req.body);
      const result = await authService.login(dto);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        res.status(400).json({ error: { message: 'refreshToken required' } });
        return;
      }
      const tokens = await authService.refresh(refreshToken);
      res.json({ data: tokens });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();