import type { Knex } from 'knex';
import { AppError } from '../middleware/error.middleware';
import { deleteAllUserTokens, findUserById, type UserRow } from './auth.service';
import { hashPassword, validatePasswordPolicy } from '../utils/password';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require('../database/connection') as Knex;

export interface UserListFilters {
  role?: 'admin' | 'user';
  isActive?: boolean;
  search?: string;
}

export interface UserListRow {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'user';
  is_active: boolean;
  must_change_password: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface UserWriteInput {
  firstName: string;
  lastName: string;
  email: string;
  role: 'admin' | 'user';
  isActive?: boolean;
  employeeNumber?: string | null;
  employmentType?: 'full_time' | 'part_time' | 'contractor' | null;
  employmentPercentage?: number;
  department?: string | null;
  dailyHoursOverride?: number | null;
}

export interface UserSelfProfileRow extends UserListRow {
  sort_prefs: Record<string, unknown> | null;
}

export interface CreateUserInput extends UserWriteInput {
  password: string;
}

export async function listUsers(filters: UserListFilters): Promise<UserListRow[]> {
  const query = db<UserListRow>('users')
    .select(
      'id',
      'email',
      'first_name',
      'last_name',
      'role',
      'is_active',
      'must_change_password',
      'created_at',
      'updated_at',
    )
    .orderBy([
      { column: 'last_name', order: 'asc' },
      { column: 'first_name', order: 'asc' },
      { column: 'id', order: 'asc' },
    ]);

  if (filters.role) {
    query.where({ role: filters.role });
  }

  if (typeof filters.isActive === 'boolean') {
    query.where({ is_active: filters.isActive });
  }

  if (filters.search) {
    const normalizedSearch = `%${filters.search.toLowerCase()}%`;
    query.andWhere((builder) => {
      builder
        .whereRaw('LOWER(email) LIKE ?', [normalizedSearch])
        .orWhereRaw('LOWER(first_name) LIKE ?', [normalizedSearch])
        .orWhereRaw('LOWER(last_name) LIKE ?', [normalizedSearch])
        .orWhereRaw("LOWER(first_name || ' ' || last_name) LIKE ?", [normalizedSearch]);
    });
  }

  return query;
}

export async function findUserForAdminById(id: number): Promise<UserListRow | undefined> {
  return db<UserListRow>('users')
    .select(
      'id',
      'email',
      'first_name',
      'last_name',
      'role',
      'is_active',
      'must_change_password',
      'created_at',
      'updated_at',
    )
    .where({ id })
    .first();
}

export async function createUserForAdmin(input: CreateUserInput): Promise<UserListRow> {
  const passwordViolations = validatePasswordPolicy(input.password, input.email);
  if (passwordViolations.length > 0) {
    throw new AppError(
      `Password does not meet requirements: ${passwordViolations.join(', ')}`,
      400,
    );
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const [row] = (await db('users')
      .insert({
        email: input.email,
        password_hash: passwordHash,
        first_name: input.firstName,
        last_name: input.lastName,
        role: input.role,
        is_active: input.isActive ?? true,
        must_change_password: true,
        employee_number: input.employeeNumber ?? null,
        employment_type: input.employmentType ?? null,
        employment_percentage: input.employmentPercentage ?? 100,
        department: input.department ?? null,
        daily_hours_override: input.dailyHoursOverride ?? null,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning([
        'id',
        'email',
        'first_name',
        'last_name',
        'role',
        'is_active',
        'must_change_password',
        'created_at',
        'updated_at',
      ])) as UserListRow[];

    return row;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError('Email already exists', 409);
    }
    throw error;
  }
}

export async function updateUserForAdmin(
  id: number,
  input: UserWriteInput,
): Promise<{ before: UserRow; after: UserListRow }> {
  const existingUser = await findUserById(id);
  if (!existingUser) {
    throw new AppError('User not found', 404);
  }

  try {
    const [updatedRow] = (await db('users')
      .where({ id })
      .update({
        email: input.email,
        first_name: input.firstName,
        last_name: input.lastName,
        role: input.role,
        is_active: input.isActive ?? existingUser.is_active,
        employee_number: input.employeeNumber ?? null,
        employment_type: input.employmentType ?? null,
        employment_percentage: input.employmentPercentage ?? 100,
        department: input.department ?? null,
        daily_hours_override: input.dailyHoursOverride ?? null,
        updated_at: new Date(),
      })
      .returning([
        'id',
        'email',
        'first_name',
        'last_name',
        'role',
        'is_active',
        'must_change_password',
        'created_at',
        'updated_at',
      ])) as UserListRow[];

    if (!updatedRow) {
      throw new AppError('User not found', 404);
    }

    return { before: existingUser, after: updatedRow };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError('Email already exists', 409);
    }
    throw error;
  }
}

export async function deactivateUserForAdmin(
  targetUserId: number,
  actorUserId: number,
): Promise<{ before: UserRow; after: UserListRow }> {
  if (targetUserId === actorUserId) {
    throw new AppError('SELF_DEACTIVATION_FORBIDDEN', 403);
  }

  const existingUser = await findUserById(targetUserId);
  if (!existingUser) {
    throw new AppError('User not found', 404);
  }

  const [updatedRow] = (await db('users')
    .where({ id: targetUserId })
    .update({
      is_active: false,
      updated_at: new Date(),
    })
    .returning([
      'id',
      'email',
      'first_name',
      'last_name',
      'role',
      'is_active',
      'must_change_password',
      'created_at',
      'updated_at',
    ])) as UserListRow[];

  await deleteAllUserTokens(targetUserId);

  return { before: existingUser, after: updatedRow };
}

export async function updateOwnProfile(
  userId: number,
  input: { firstName: string; lastName: string },
): Promise<{ before: UserRow; after: UserSelfProfileRow }> {
  const existingUser = await findUserById(userId);
  if (!existingUser) {
    throw new AppError('User not found', 404);
  }

  const [updatedRow] = (await db('users')
    .where({ id: userId })
    .update({
      first_name: input.firstName,
      last_name: input.lastName,
      updated_at: new Date(),
    })
    .returning([
      'id',
      'email',
      'first_name',
      'last_name',
      'role',
      'is_active',
      'must_change_password',
      'sort_prefs',
      'created_at',
      'updated_at',
    ])) as UserSelfProfileRow[];

  return { before: existingUser, after: updatedRow };
}

export async function updateUserSortPreferences(
  userId: number,
  sortPrefs: Record<string, unknown>,
): Promise<{ before: UserSelfProfileRow; after: UserSelfProfileRow }> {
  const existingUser = await db<UserSelfProfileRow>('users')
    .select(
      'id',
      'email',
      'first_name',
      'last_name',
      'role',
      'is_active',
      'must_change_password',
      'sort_prefs',
      'created_at',
      'updated_at',
    )
    .where({ id: userId })
    .first();
  if (!existingUser) {
    throw new AppError('User not found', 404);
  }

  const [updatedRow] = (await db('users')
    .where({ id: userId })
    .update({
      sort_prefs: JSON.stringify(sortPrefs),
      updated_at: new Date(),
    })
    .returning([
      'id',
      'email',
      'first_name',
      'last_name',
      'role',
      'is_active',
      'must_change_password',
      'sort_prefs',
      'created_at',
      'updated_at',
    ])) as UserSelfProfileRow[];

  return { before: existingUser, after: updatedRow };
}

export function parseIsActiveFilter(rawValue: unknown): boolean | undefined {
  if (rawValue == null || rawValue === '') return undefined;
  if (rawValue === 'true') return true;
  if (rawValue === 'false') return false;
  throw new AppError('is_active must be true or false', 400);
}

export function parseRoleFilter(rawValue: unknown): 'admin' | 'user' | undefined {
  if (rawValue == null || rawValue === '') return undefined;
  if (rawValue === 'admin' || rawValue === 'user') return rawValue;
  throw new AppError('role must be admin or user', 400);
}

export function parseUserId(rawValue: string): number {
  const id = Number.parseInt(rawValue, 10);
  if (Number.isNaN(id) || id <= 0) {
    throw new AppError('Invalid user ID', 400);
  }
  return id;
}

export function parseOptionalText(rawValue: unknown): string | null | undefined {
  if (rawValue == null) return undefined;
  if (typeof rawValue !== 'string') throw new AppError('Invalid text field', 400);
  const trimmed = rawValue.trim();
  return trimmed === '' ? null : trimmed;
}

export function parseRequiredText(rawValue: unknown, fieldName: string): string {
  if (typeof rawValue !== 'string' || rawValue.trim() === '') {
    throw new AppError(`${fieldName} is required`, 400);
  }
  return rawValue.trim();
}

export function parseRoleValue(rawValue: unknown): 'admin' | 'user' {
  const role = parseRoleFilter(rawValue);
  if (!role) throw new AppError('role is required', 400);
  return role;
}

export function parseOptionalBoolean(rawValue: unknown): boolean | undefined {
  if (typeof rawValue === 'boolean') return rawValue;
  if (rawValue == null) return undefined;
  throw new AppError('is_active must be a boolean', 400);
}

export function parseEmploymentType(
  rawValue: unknown,
): 'full_time' | 'part_time' | 'contractor' | null | undefined {
  if (rawValue == null) return undefined;
  if (rawValue === '') return null;
  if (rawValue === 'full_time' || rawValue === 'part_time' || rawValue === 'contractor') {
    return rawValue;
  }
  throw new AppError('employment_type must be full_time, part_time, or contractor', 400);
}

export function parseEmploymentPercentage(rawValue: unknown): number | undefined {
  if (rawValue == null) return undefined;
  if (typeof rawValue !== 'number' || !Number.isInteger(rawValue) || rawValue < 0 || rawValue > 100) {
    throw new AppError('employment_percentage must be an integer between 0 and 100', 400);
  }
  return rawValue;
}

export function parseOptionalSmallInt(rawValue: unknown, fieldName: string): number | null | undefined {
  if (rawValue == null) return undefined;
  if (rawValue === '') return null;
  if (typeof rawValue !== 'number' || !Number.isInteger(rawValue)) {
    throw new AppError(`${fieldName} must be an integer`, 400);
  }
  return rawValue;
}

export function parseSortPreferences(rawValue: unknown): Record<string, unknown> {
  if (typeof rawValue !== 'object' || rawValue === null || Array.isArray(rawValue)) {
    throw new AppError('sort preferences must be an object', 400);
  }
  return rawValue as Record<string, unknown>;
}

export function toAuditUserValue(user: UserRow | UserListRow): Record<string, unknown> {
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    role: user.role,
    isActive: user.is_active,
    mustChangePassword: user.must_change_password,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}
