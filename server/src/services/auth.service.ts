import { createHash } from 'crypto';
import type { Knex } from 'knex';
import config from '../config';
import { AppError } from '../middleware/error.middleware';
import { hashPassword } from '../utils/password';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require('../database/connection') as Knex;

// ── Row types (mirror the actual DB schema) ───────────────────────────────────

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'user';
  is_active: boolean;
  must_change_password: boolean;
  failed_login_attempts: number;
  lockout_until: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface RefreshTokenRow {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

// ── Audit log enums (must match migration 011 exactly) ────────────────────────

export type AuditAction =
  | 'LOGIN'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'SUBMIT'
  | 'APPROVE'
  | 'REJECT'
  | 'LOCK'
  | 'UNLOCK'
  | 'ADMIN_EDIT'
  | 'TIMER_AUTO_STOPPED'
  | 'WEEK_RESUBMITTED'
  | 'EXPORT'
  | 'PASSWORD_RESET'
  | 'DEACTIVATE'
  | 'ENTRY_CORRECTED';

export type AuditEntityType =
  | 'USER'
  | 'CLIENT'
  | 'PROJECT'
  | 'TASK'
  | 'ASSIGNMENT'
  | 'TIME_ENTRY'
  | 'ABSENCE'
  | 'WEEKLY_SUBMISSION'
  | 'MONTH_LOCK'
  | 'SETTING'
  | 'HOLIDAY'
  | 'TIMER';

export interface WriteAuditLogParams {
  actorUserId: number | null;
  entityType: AuditEntityType;
  entityId: number | null;
  action: AuditAction;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  reason?: string;
  ipAddress?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1_000;

// ── Internal helpers ──────────────────────────────────────────────────────────

// Converts config expiry strings like '7d', '30d', '15m' to milliseconds.
function parseExpiryMs(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid expiry format: ${expiry}`);
  const value = parseInt(match[1], 10);
  const multipliers: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return value * multipliers[match[2]];
}

// ── Token hashing ─────────────────────────────────────────────────────────────

// SHA-256 hex of the raw JWT string. CHAR(64) in the DB is exactly this length.
// Exported so integration tests can verify what was persisted without
// re-implementing the hash function.
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

// ── User queries ──────────────────────────────────────────────────────────────

// LOWER() guard: the DB unique index is case-sensitive but users type mixed-case
// email addresses. This prevents false "user not found" on case mismatches.
export async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  return db<UserRow>('users')
    .whereRaw('LOWER(email) = ?', [email.toLowerCase()])
    .first();
}

export async function findUserById(id: number): Promise<UserRow | undefined> {
  return db<UserRow>('users').where({ id }).first();
}

// ── Account lockout ───────────────────────────────────────────────────────────

// Synchronous guard — caller must have already fetched the user row.
// Uses 423 Locked (not 429) because this is a per-user account lock,
// not a rate-limit response. The IP-level rate limiter returns 429.
export function assertNotLocked(user: UserRow): void {
  if (user.lockout_until && new Date() < new Date(user.lockout_until)) {
    const remainingMs = new Date(user.lockout_until).getTime() - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60_000);
    throw new AppError(
      `Account is temporarily locked. Try again in ${remainingMin} minute(s).`,
      423,
    );
  }
}

export async function recordFailedLogin(userId: number): Promise<void> {
  const row = await db<{ failed_login_attempts: number }>('users')
    .where({ id: userId })
    .select('failed_login_attempts')
    .first();

  if (!row) return;

  const newCount = row.failed_login_attempts + 1;
  const update: Record<string, unknown> = {
    failed_login_attempts: newCount,
    updated_at: new Date(),
  };

  if (newCount >= LOCKOUT_THRESHOLD) {
    update.lockout_until = new Date(Date.now() + LOCKOUT_DURATION_MS);
  }

  await db('users').where({ id: userId }).update(update);
}

// Resets lockout state on successful login.
export async function recordSuccessfulLogin(userId: number): Promise<void> {
  await db('users').where({ id: userId }).update({
    failed_login_attempts: 0,
    lockout_until: null,
    updated_at: new Date(),
  });
}

// ── Refresh token management ──────────────────────────────────────────────────

export async function storeRefreshToken(
  userId: number,
  rawToken: string,
  rememberMe: boolean,
  meta: { ipAddress?: string; userAgent?: string } = {},
): Promise<void> {
  const expiryStr = rememberMe ? config.jwt.refreshExpiryLong : config.jwt.refreshExpiry;
  const expiresAt = new Date(Date.now() + parseExpiryMs(expiryStr));

  await db('refresh_tokens').insert({
    user_id: userId,
    token_hash: hashToken(rawToken),
    expires_at: expiresAt,
    ip_address: meta.ipAddress ?? null,
    user_agent: meta.userAgent ?? null,
  });
}

// Looks up a refresh token that is not revoked and not past its DB-tracked
// expiry. Both conditions are checked: the JWT expiry (in verifyRefreshToken)
// is the first gate; this is the second gate after rotation or logout.
export async function findValidRefreshToken(
  rawToken: string,
): Promise<RefreshTokenRow | undefined> {
  return db<RefreshTokenRow>('refresh_tokens')
    .where({ token_hash: hashToken(rawToken) })
    .whereNull('revoked_at')
    .where('expires_at', '>', new Date())
    .first();
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  await db('refresh_tokens')
    .where({ token_hash: hashToken(rawToken) })
    .update({ revoked_at: new Date() });
}

// Used when admin deactivates a user — all active sessions must terminate.
export async function revokeAllUserTokens(userId: number): Promise<void> {
  await db('refresh_tokens')
    .where({ user_id: userId })
    .whereNull('revoked_at')
    .update({ revoked_at: new Date() });
}

// ── Password management ───────────────────────────────────────────────────────

export async function updatePassword(userId: number, newPlaintext: string): Promise<void> {
  const hash = await hashPassword(newPlaintext);
  await db('users').where({ id: userId }).update({
    password_hash: hash,
    must_change_password: false,
    updated_at: new Date(),
  });
}

// ── Audit logging ─────────────────────────────────────────────────────────────

// The audit_action ENUM has no LOGIN_FAIL variant. Callers differentiate
// login success vs. failure via newValue: { success: true/false, reason: '...' }.
export async function writeAuditLog(params: WriteAuditLogParams): Promise<void> {
  await db('audit_logs').insert({
    actor_user_id: params.actorUserId,
    target_entity_type: params.entityType,
    target_entity_id: params.entityId,
    action: params.action,
    old_value: params.oldValue != null ? JSON.stringify(params.oldValue) : null,
    new_value: params.newValue != null ? JSON.stringify(params.newValue) : null,
    reason: params.reason ?? null,
    ip_address: params.ipAddress ?? null,
  });
}
