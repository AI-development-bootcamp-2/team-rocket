import { Request, Response } from 'express';
import { AppError } from '../middleware/error.middleware';
import {
  createUserForAdmin,
  deactivateUserForAdmin,
  findUserForAdminById,
  listUsers,
  parseEmploymentPercentage,
  parseEmploymentType,
  parseIsActiveFilter,
  parseOptionalBoolean,
  parseOptionalSmallInt,
  parseOptionalText,
  parseRequiredText,
  parseRoleFilter,
  parseRoleValue,
  parseSortPreferences,
  parseUserId,
  toAuditUserValue,
  updateOwnProfile,
  updateUserSortPreferences,
  updateUserForAdmin,
} from '../services/users.service';
import { writeAuditLog } from '../services/auth.service';
import type { AuthenticatedUser } from '../middleware/auth.middleware';

function toUserListItem(user: {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'user';
  is_active: boolean;
  must_change_password: boolean;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    role: user.role,
    isActive: user.is_active,
    mustChangePassword: user.must_change_password,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

function toSelfProfileDto(user: {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'user';
  must_change_password: boolean;
}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    role: user.role,
    mustChangePassword: user.must_change_password,
  };
}

function parseSearchFilter(rawValue: unknown): string | undefined {
  if (typeof rawValue !== 'string') return undefined;
  const trimmed = rawValue.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function getUsers(req: Request, res: Response): Promise<void> {
  const role = parseRoleFilter(req.query.role);
  const isActive = parseIsActiveFilter(req.query.is_active);
  const search = parseSearchFilter(req.query.search);

  const users = await listUsers({ role, isActive, search });
  res.json({ data: users.map(toUserListItem) });
}

export async function getUserById(req: Request, res: Response): Promise<void> {
  const userId = parseUserId(req.params.id);
  const user = await findUserForAdminById(userId);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json(toUserListItem(user));
}

function getAuthUser(req: Request): AuthenticatedUser {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }
  return req.user;
}

function extractIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() ?? '';
  return req.ip ?? '';
}

function parseUserWriteBody(body: Record<string, unknown>) {
  return {
    firstName: parseRequiredText(body.first_name, 'first_name'),
    lastName: parseRequiredText(body.last_name, 'last_name'),
    email: parseRequiredText(body.email, 'email').toLowerCase(),
    role: parseRoleValue(body.role),
    isActive: parseOptionalBoolean(body.is_active),
    employeeNumber: parseOptionalText(body.employee_number),
    employmentType: parseEmploymentType(body.employment_type),
    employmentPercentage: parseEmploymentPercentage(body.employment_percentage),
    department: parseOptionalText(body.department),
    dailyHoursOverride: parseOptionalSmallInt(body.daily_hours_override, 'daily_hours_override'),
  };
}

export async function createUser(req: Request, res: Response): Promise<void> {
  const actor = getAuthUser(req);
  const body = req.body as Record<string, unknown>;
  const password = parseRequiredText(body.password, 'password');

  const createdUser = await createUserForAdmin({
    ...parseUserWriteBody(body),
    password,
  });

  await writeAuditLog({
    actorUserId: actor.id,
    entityType: 'USER',
    entityId: createdUser.id,
    action: 'CREATE',
    newValue: toAuditUserValue(createdUser),
    ipAddress: extractIp(req),
  });

  res.status(201).json(toUserListItem(createdUser));
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  const actor = getAuthUser(req);
  const userId = parseUserId(req.params.id);
  const { before, after } = await updateUserForAdmin(userId, parseUserWriteBody(req.body));

  await writeAuditLog({
    actorUserId: actor.id,
    entityType: 'USER',
    entityId: userId,
    action: 'UPDATE',
    oldValue: toAuditUserValue(before),
    newValue: toAuditUserValue(after),
    ipAddress: extractIp(req),
  });

  res.json(toUserListItem(after));
}

export async function deactivateUser(req: Request, res: Response): Promise<void> {
  const actor = getAuthUser(req);
  const userId = parseUserId(req.params.id);

  try {
    const { before, after } = await deactivateUserForAdmin(userId, actor.id);

    await writeAuditLog({
      actorUserId: actor.id,
      entityType: 'USER',
      entityId: userId,
      action: 'DEACTIVATE',
      oldValue: toAuditUserValue(before),
      newValue: toAuditUserValue(after),
      ipAddress: extractIp(req),
    });

    res.status(204).send();
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 403 && error.message === 'SELF_DEACTIVATION_FORBIDDEN') {
      res.status(403).json({
        error: 'SELF_DEACTIVATION_FORBIDDEN',
        message: 'אינך יכול לבטל את הפעלת החשבון שלך',
      });
      return;
    }
    throw error;
  }
}

export async function updateOwnUserProfile(req: Request, res: Response): Promise<void> {
  const actor = getAuthUser(req);
  const body = req.body as Record<string, unknown>;
  const { before, after } = await updateOwnProfile(actor.id, {
    firstName: parseRequiredText(body.first_name, 'first_name'),
    lastName: parseRequiredText(body.last_name, 'last_name'),
  });

  await writeAuditLog({
    actorUserId: actor.id,
    entityType: 'USER',
    entityId: actor.id,
    action: 'UPDATE',
    oldValue: toAuditUserValue(before),
    newValue: toAuditUserValue(after),
    ipAddress: extractIp(req),
  });

  res.json(toSelfProfileDto(after));
}

export async function updateOwnSortPreference(req: Request, res: Response): Promise<void> {
  const actor = getAuthUser(req);
  const sortPrefs = parseSortPreferences(req.body);
  const { before, after } = await updateUserSortPreferences(actor.id, sortPrefs);

  await writeAuditLog({
    actorUserId: actor.id,
    entityType: 'USER',
    entityId: actor.id,
    action: 'UPDATE',
    oldValue: {
      ...toAuditUserValue(before),
      sortPrefs: before.sort_prefs ?? null,
    },
    newValue: {
      ...toAuditUserValue(after),
      sortPrefs: after.sort_prefs ?? null,
    },
    ipAddress: extractIp(req),
  });

  res.status(204).send();
}
