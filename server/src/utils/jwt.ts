import jwt, { SignOptions } from 'jsonwebtoken';
import config from '../config';
import { AppError } from '../middleware/error.middleware';

export interface AccessTokenPayload {
  sub: string;       // user ID
  role: 'admin' | 'user';
}

export interface RefreshTokenPayload {
  sub: string;       // user ID
  jti: string;       // ID of the refresh_tokens DB row — used for rotation
}

// @types/jsonwebtoken@9+ types expiresIn as StringValue (ms template literal),
// not plain string. Values come from process.env so TypeScript can't verify the
// literal shape at compile time — cast to SignOptions['expiresIn'] which is the
// correct library type without widening to any.
type Expiry = SignOptions['expiresIn'];

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiry as Expiry,
  });
}

export function signRefreshToken(payload: RefreshTokenPayload, rememberMe = false): string {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: (rememberMe ? config.jwt.refreshExpiryLong : config.jwt.refreshExpiry) as Expiry,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, config.jwt.accessSecret) as AccessTokenPayload;
  } catch (err) {
    console.error('[jwt] verifyAccessToken failed:', (err as Error).name);
    throw new AppError('Invalid or expired access token', 401);
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    return jwt.verify(token, config.jwt.refreshSecret) as RefreshTokenPayload;
  } catch (err) {
    console.error('[jwt] verifyRefreshToken failed:', (err as Error).name);
    throw new AppError('Invalid or expired refresh token', 401);
  }
}
