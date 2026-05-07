import { randomUUID } from 'crypto';
import { Request, Response, RequestHandler } from 'express';
import config from '../config';
import { AppError } from '../middleware/error.middleware';
import type { AuthenticatedUser } from '../middleware/auth.middleware';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { comparePassword, validatePasswordPolicy } from '../utils/password';
import {
  findUserByEmail,
  findUserById,
  assertNotLocked,
  recordFailedLogin,
  recordSuccessfulLogin,
  storeRefreshToken,
  findValidRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  updatePassword,
  writeAuditLog,
  type UserRow,
} from '../services/auth.service';

// ── Async handler wrapper ─────────────────────────────────────────────────────
// Express 4 does not propagate rejected promises to the error middleware.
// Every async controller must be wrapped so thrown AppErrors reach errorMiddleware.

type AsyncHandler = (req: Request, res: Response) => Promise<void>;

export function wrap(fn: AsyncHandler): RequestHandler {
  return (req, res, next) => fn(req, res).catch(next);
}

// ── Private helpers ───────────────────────────────────────────────────────────

// Returns the refreshToken cookie value without requiring the cookie-parser package.
// Handles URL-encoded values and ignores whitespace around the name/value.
function getRefreshCookie(req: Request): string | undefined {
  const header = req.headers.cookie ?? '';
  const segment = header.split(';').find((c) => c.trim().startsWith('refreshToken='));
  if (!segment) return undefined;
  return decodeURIComponent(segment.slice(segment.indexOf('=') + 1).trim());
}

function extractIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() ?? '';
  return req.ip ?? '';
}

function setCookie(res: Response, token: string, rememberMe: boolean): void {
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1_000 : 7 * 24 * 60 * 60 * 1_000;
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'strict',
    maxAge,
    path: '/auth',
  });
}

function clearCookie(res: Response): void {
  // clearCookie must use the same options as the original set call.
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'strict',
    path: '/auth',
  });
}

// Strips sensitive fields before returning user data to the client.
function toUserDto(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    role: user.role,
    mustChangePassword: user.must_change_password,
  };
}

// Narrows req.user (always set by authenticate middleware, but TypeScript can't
// prove it statically). Throws 401 if somehow called without authenticate in chain.
function getAuthUser(req: Request): AuthenticatedUser {
  if (!req.user) throw new AppError('Authentication required', 401);
  return req.user;
}

// ── POST /auth/login ──────────────────────────────────────────────────────────

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password, rememberMe = false } = req.body as {
    email?: string;
    password?: string;
    rememberMe?: boolean;
  };

  if (!email || !password) {
    throw new AppError('Email and password are required', 400);
  }

  const ipAddress = extractIp(req);
  const userAgent = req.headers['user-agent'];
  const user = await findUserByEmail(email);

  // Return the same message for unknown email and wrong password — avoids
  // leaking whether the account exists.
  if (!user || !user.is_active) {
    throw new AppError('Invalid email or password', 401);
  }

  // Fast fail for locked accounts — avoids running bcrypt unnecessarily.
  assertNotLocked(user);

  const passwordValid = await comparePassword(password, user.password_hash);
  if (!passwordValid) {
    await recordFailedLogin(user.id);
    // Fire-and-forget: a broken audit_logs table must not block login.
    writeAuditLog({
      actorUserId: user.id,
      entityType: 'USER',
      entityId: user.id,
      action: 'LOGIN',
      newValue: { success: false, reason: 'invalid_password' },
      ipAddress,
    }).catch((err: unknown) => console.error('[audit] login failure:', err));
    throw new AppError('Invalid email or password', 401);
  }

  await recordSuccessfulLogin(user.id);

  const accessToken = signAccessToken({ sub: String(user.id), role: user.role });
  const refreshToken = signRefreshToken({ sub: String(user.id), jti: randomUUID() }, rememberMe);
  await storeRefreshToken(user.id, refreshToken, rememberMe, { ipAddress, userAgent });

  writeAuditLog({
    actorUserId: user.id,
    entityType: 'USER',
    entityId: user.id,
    action: 'LOGIN',
    newValue: { success: true },
    ipAddress,
  }).catch((err: unknown) => console.error('[audit] login success:', err));

  setCookie(res, refreshToken, rememberMe);
  res.json({ accessToken, user: toUserDto(user) });
}

// ── POST /auth/logout ─────────────────────────────────────────────────────────

export async function logout(req: Request, res: Response): Promise<void> {
  const rawToken = getRefreshCookie(req);

  // Tolerate missing cookie: double-logout (e.g. two tabs) should succeed silently.
  if (rawToken) {
    await revokeRefreshToken(rawToken);
  }

  clearCookie(res);
  res.status(204).send();
}

// ── POST /auth/refresh ────────────────────────────────────────────────────────

export async function refreshTokens(req: Request, res: Response): Promise<void> {
  const rawToken = getRefreshCookie(req);
  if (!rawToken) throw new AppError('Refresh token required', 401);

  // Fast path: verify JWT signature and expiry without hitting the DB.
  const payload = verifyRefreshToken(rawToken);

  // Slow path: confirm the token exists in DB, is not revoked, and is not past
  // its DB-tracked expiry (belt-and-suspenders after the JWT check above).
  const stored = await findValidRefreshToken(rawToken);
  if (!stored) throw new AppError('Refresh token is invalid or has been revoked', 401);

  // Re-fetch the user to confirm the account is still active and to get role
  // for the new access token (role is not stored in the refresh token payload).
  const userId = parseInt(payload.sub, 10);
  const user = await findUserById(userId);
  if (!user || !user.is_active) throw new AppError('User account is inactive', 401);

  // Infer rememberMe: if the original token lifetime was > 7 days it was a
  // "remember me" token. This preserves the preference across rotations without
  // needing an extra DB column.
  const lifetimeMs =
    new Date(stored.expires_at).getTime() - new Date(stored.created_at).getTime();
  const rememberMe = lifetimeMs > 7 * 24 * 60 * 60 * 1_000;

  // Rotation: revoke old, issue new pair atomically from the client's perspective.
  await revokeRefreshToken(rawToken);

  const accessToken = signAccessToken({ sub: String(user.id), role: user.role });
  const newRefreshToken = signRefreshToken(
    { sub: String(user.id), jti: randomUUID() },
    rememberMe,
  );
  await storeRefreshToken(user.id, newRefreshToken, rememberMe, {
    ipAddress: extractIp(req),
    userAgent: req.headers['user-agent'],
  });

  setCookie(res, newRefreshToken, rememberMe);
  res.json({ accessToken });
}

// ── POST /auth/change-password ────────────────────────────────────────────────

export async function changePassword(req: Request, res: Response): Promise<void> {
  const authUser = getAuthUser(req);
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    throw new AppError('currentPassword and newPassword are required', 400);
  }

  const user = await findUserById(authUser.id);
  if (!user) throw new AppError('User not found', 404);

  const violations = validatePasswordPolicy(newPassword, user.email);
  if (violations.length > 0) {
    throw new AppError(`Password does not meet requirements: ${violations.join(', ')}`, 400);
  }

  const currentValid = await comparePassword(currentPassword, user.password_hash);
  if (!currentValid) throw new AppError('Current password is incorrect', 401);

  await updatePassword(user.id, newPassword);

  // Revoke all other sessions, then issue a fresh pair so the current session
  // continues without forcing the user to log in again.
  await revokeAllUserTokens(user.id);

  const accessToken = signAccessToken({ sub: String(user.id), role: user.role });
  const newRefreshToken = signRefreshToken({ sub: String(user.id), jti: randomUUID() }, false);
  await storeRefreshToken(user.id, newRefreshToken, false, {
    ipAddress: extractIp(req),
    userAgent: req.headers['user-agent'],
  });

  writeAuditLog({
    actorUserId: user.id,
    entityType: 'USER',
    entityId: user.id,
    action: 'PASSWORD_RESET',
    ipAddress: extractIp(req),
  }).catch((err: unknown) => console.error('[audit] password change:', err));

  setCookie(res, newRefreshToken, false);
  res.json({ accessToken });
}

// ── GET /users/me ─────────────────────────────────────────────────────────────

export async function getMe(req: Request, res: Response): Promise<void> {
  const authUser = getAuthUser(req);
  const user = await findUserById(authUser.id);
  if (!user) throw new AppError('User not found', 404);
  res.json(toUserDto(user));
}
