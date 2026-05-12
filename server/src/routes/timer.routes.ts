import { Router } from 'express';
import { wrap } from '../middleware/async-handler';
import {
  startTimerHandler,
  stopTimerHandler,
  getTimerStatusHandler,
} from '../controllers/timer.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/start', authenticate, wrap(startTimerHandler));
router.post('/stop', authenticate, wrap(stopTimerHandler));
router.get('/status', authenticate, wrap(getTimerStatusHandler));

export default router;
