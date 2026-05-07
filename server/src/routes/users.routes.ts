import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { wrap, getMe } from '../controllers/auth.controller';

const router = Router();

router.get('/me', authenticate, wrap(getMe));

export default router;
