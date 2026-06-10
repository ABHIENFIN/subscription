import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { appConfig } from './config/app.config';
import { errorHandler } from './middleware/errorHandler.middleware';

import authRoutes from './modules/auth/auth.routes';
import tenantRoutes from './modules/tenants/tenant.routes';
import userRoutes from './modules/users/user.routes';
import planRoutes from './modules/plans/plan.routes';
import subscriptionRoutes from './modules/subscriptions/subscription.routes';
import webhookRoutes from './modules/webhooks/webhook.routes';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: appConfig.corsOrigins }));

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api', limiter);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use(`${appConfig.apiPrefix}/auth`, authRoutes);
  app.use(`${appConfig.apiPrefix}/tenants`, tenantRoutes);
  app.use(`${appConfig.apiPrefix}/users`, userRoutes);
  app.use(`${appConfig.apiPrefix}/plans`, planRoutes);
  app.use(`${appConfig.apiPrefix}/subscriptions`, subscriptionRoutes);
  app.use(`${appConfig.apiPrefix}/webhooks`, webhookRoutes);

  app.use(errorHandler);

  return app;
}

export default createApp;