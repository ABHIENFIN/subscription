import { Router, raw } from 'express';
import { webhookController } from './webhook.controller';

const router = Router();

router.post(
  '/',
  raw({ type: 'application/json' }),
  (req, res, next) => webhookController.handle(req, res, next)
);

export default router;