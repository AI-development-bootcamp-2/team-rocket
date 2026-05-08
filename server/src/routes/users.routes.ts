import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { wrap, getMe, adminResetPassword } from '../controllers/auth.controller';
import {
  createPermissionFlagForUser,
  getPermissionFlags,
  revokePermissionFlagForUser,
} from '../controllers/permission-flags.controller';
import {
  createUser,
  deactivateUser,
  getUserById,
  getUsers,
  updateOwnSortPreference,
  updateOwnUserProfile,
  updateUser,
} from '../controllers/users.controller';

const router = Router();

router.get('/me', authenticate, wrap(getMe));
router.put('/me', authenticate, wrap(updateOwnUserProfile));
router.post('/me/sort-preference', authenticate, wrap(updateOwnSortPreference));
router.get('/', authenticate, requireRole('admin'), wrap(getUsers));
router.post('/', authenticate, requireRole('admin'), wrap(createUser));
router.get('/:id', authenticate, requireRole('admin'), wrap(getUserById));
router.put('/:id', authenticate, requireRole('admin'), wrap(updateUser));
router.delete('/:id', authenticate, requireRole('admin'), wrap(deactivateUser));
router.get('/:id/permissions', authenticate, requireRole('admin'), wrap(getPermissionFlags));
router.post('/:id/permissions', authenticate, requireRole('admin'), wrap(createPermissionFlagForUser));
router.delete(
  '/:id/permissions/:flagId',
  authenticate,
  requireRole('admin'),
  wrap(revokePermissionFlagForUser),
);
router.post('/:id/reset-password', authenticate, requireRole('admin'), wrap(adminResetPassword));

export default router;
