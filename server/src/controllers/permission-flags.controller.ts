import { Request, Response } from 'express';
import { writeAuditLog } from '../services/auth.service';
import {
  assertActiveProjectsExist,
  assertUserExists,
  createPermissionFlag,
  deletePermissionFlag,
  listPermissionFlagsForUser,
  parseFlagName,
  parseScopedProjectIds,
} from '../services/permission-flags.service';
import { parseUserId } from '../services/users.service';
import { AppError } from '../middleware/error.middleware';

function getAuthUserId(req: Request): number {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }
  return req.user.id;
}

function extractIp(req: Request): string {
  // app.ts sets trust proxy: 1, so req.ip already reflects the real client IP.
  return req.ip ?? '';
}

function toPermissionFlagDto(flag: {
  id: number;
  user_id: number;
  flag_name: string;
  scoped_project_ids: number[] | null;
  granted_by: number | null;
  created_at: Date;
}) {
  return {
    id: flag.id,
    userId: flag.user_id,
    flagName: flag.flag_name,
    scopedProjectIds: flag.scoped_project_ids ?? [],
    grantedBy: flag.granted_by,
    createdAt: flag.created_at,
  };
}

export async function getPermissionFlags(req: Request, res: Response): Promise<void> {
  const userId = parseUserId(req.params.id);
  await assertUserExists(userId);
  const flags = await listPermissionFlagsForUser(userId);
  res.json({ data: flags.map(toPermissionFlagDto) });
}

export async function getMyPermissionFlags(req: Request, res: Response): Promise<void> {
  const callerId = req.user!.id;
  const flags = await listPermissionFlagsForUser(callerId);
  res.json({ data: flags.map(toPermissionFlagDto) });
}

export async function createPermissionFlagForUser(req: Request, res: Response): Promise<void> {
  const actorUserId = getAuthUserId(req);
  const userId = parseUserId(req.params.id);
  await assertUserExists(userId);

  const body = req.body as Record<string, unknown>;
  const flagName = parseFlagName(body.flag_name);
  const scopedProjectIds = parseScopedProjectIds(body.scoped_project_ids);
  await assertActiveProjectsExist(scopedProjectIds);

  const createdFlag = await createPermissionFlag({
    userId,
    grantedBy: actorUserId,
    flagName,
    scopedProjectIds,
  });

  await writeAuditLog({
    actorUserId,
    entityType: 'USER',
    entityId: userId,
    action: 'UPDATE',
    newValue: {
      permissionFlag: toPermissionFlagDto(createdFlag),
    },
    ipAddress: extractIp(req),
  });

  res.status(201).json(toPermissionFlagDto(createdFlag));
}

export async function revokePermissionFlagForUser(req: Request, res: Response): Promise<void> {
  const actorUserId = getAuthUserId(req);
  const userId = parseUserId(req.params.id);
  const flagId = parseUserId(req.params.flagId);

  const deletedFlag = await deletePermissionFlag(userId, flagId);

  await writeAuditLog({
    actorUserId,
    entityType: 'USER',
    entityId: userId,
    action: 'UPDATE',
    oldValue: {
      permissionFlag: toPermissionFlagDto(deletedFlag),
    },
    ipAddress: extractIp(req),
  });

  res.status(204).send();
}
