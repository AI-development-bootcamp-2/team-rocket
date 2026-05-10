import { Router } from 'express';
import { wrap } from '../controllers/auth.controller';
import {
  getTimeEntriesHandler,
  getTimeEntryByIdHandler,
  createTimeEntryHandler,
  updateTimeEntryHandler,
  deleteTimeEntryHandler,
  getDailySummaryHandler,
  getDropdownDataHandler,
} from '../controllers/time-entries.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Named sub-routes must be registered BEFORE the /:id wildcard.
router.get('/', authenticate, wrap(getTimeEntriesHandler));
router.post('/', authenticate, wrap(createTimeEntryHandler));
router.get('/dropdown-data', authenticate, wrap(getDropdownDataHandler));
router.get('/daily-summary', authenticate, wrap(getDailySummaryHandler));
router.get('/:id', authenticate, wrap(getTimeEntryByIdHandler));
router.put('/:id', authenticate, wrap(updateTimeEntryHandler));
router.delete('/:id', authenticate, wrap(deleteTimeEntryHandler));

export default router;
