/**
 * Express route table for the F05 /clients endpoints.
 * Note: role gating is intentionally NOT done with `requireRole('admin')` for
 * the GET handlers — both admin and user can list/read clients, and the
 * controller is responsible for scoping the result set by role.
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { wrap } from '../controllers/auth.controller';
import { getClients } from '../controllers/clients.controller';

const router = Router();

router.get('/', authenticate, wrap(getClients));

export default router;
