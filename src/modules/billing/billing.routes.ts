import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ data: [], message: 'Billing API - implement invoice generation' });
});

export default router;