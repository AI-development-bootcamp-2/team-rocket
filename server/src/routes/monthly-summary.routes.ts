import { Router } from 'express';
import { wrap } from '../controllers/auth.controller';
import { getMonthlySummaryHandler } from '../controllers/monthly-summary.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, wrap(getMonthlySummaryHandler));

export default router;
