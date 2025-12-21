import { Router } from 'express';
import { prisma } from '@lms/db';

const router = Router();

router.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Healthcheck failed', err);
    res.status(500).json({ status: 'error' });
  }
});

export default router;
