import { Router } from 'express';
import { wrap } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import {
  createAbsenceHandler,
  deleteAbsenceDocumentHandler,
  deleteAbsenceHandler,
  getAbsencesHandler,
  updateAbsenceHandler,
  uploadAbsenceDocumentHandler,
} from '../controllers/absences.controller';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { upload } = require('../middleware/upload');

const router = Router();

router.get('/', authenticate, wrap(getAbsencesHandler));
router.post('/', authenticate, wrap(createAbsenceHandler));
router.put('/:id', authenticate, wrap(updateAbsenceHandler));
router.delete('/:id', authenticate, wrap(deleteAbsenceHandler));
router.post('/:id/documents', authenticate, ...upload.single('file'), wrap(uploadAbsenceDocumentHandler));
router.delete('/:id/documents/:docId', authenticate, wrap(deleteAbsenceDocumentHandler));

export default router;
