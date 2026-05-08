/**
 * Express route table for the F05 /clients endpoints.
 * Note: role gating is intentionally NOT done with `requireRole('admin')` for
 * the GET handlers — both admin and user can list/read clients, and the
 * controller is responsible for scoping the result set by role.
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { wrap } from '../controllers/auth.controller';
import {
  createClient,
  getClientById,
  getClients,
  updateClient,
} from '../controllers/clients.controller';

const router = Router();

router.get('/', authenticate, wrap(getClients));
router.post('/', authenticate, requireRole('admin'), wrap(createClient));
router.get('/:id', authenticate, wrap(getClientById));
router.put('/:id', authenticate, requireRole('admin'), wrap(updateClient));

export default router;
