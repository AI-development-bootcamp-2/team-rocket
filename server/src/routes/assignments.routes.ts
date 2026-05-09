import { Router } from 'express';
import { wrap } from '../controllers/auth.controller';
import {
  createAssignmentHandler,
  getAssignmentsHandler,
  getAssignmentByIdHandler,
  toggleAssignmentHandler,
} from '../controllers/assignments.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, wrap(getAssignmentsHandler));
router.get('/:id', authenticate, wrap(getAssignmentByIdHandler));
router.post('/', authenticate, wrap(createAssignmentHandler));
router.put('/:id', authenticate, wrap(toggleAssignmentHandler));

export default router;
