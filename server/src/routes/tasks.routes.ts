import { Router } from 'express';
import { wrap } from '../controllers/auth.controller';
import {
  closeTaskHandler,
  createTaskHandler,
  getTaskDetail,
  getTasks,
  updateTaskHandler,
} from '../controllers/tasks.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';

const router = Router();

router.get('/', authenticate, wrap(getTasks));
router.get('/:id', authenticate, wrap(getTaskDetail));
router.post('/', authenticate, requireRole('admin'), wrap(createTaskHandler));
router.put('/:id', authenticate, requireRole('admin'), wrap(updateTaskHandler));
router.delete('/:id', authenticate, requireRole('admin'), wrap(closeTaskHandler));

export default router;
