// Set env before any require that triggers config loading
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test_access_secret_at_least_32_chars!!';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_at_least_32chars!';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.FRONTEND_URL = 'http://localhost:5173';

const jwt = require('jsonwebtoken');
const {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} = require('../../../src/utils/jwt');
const { AppError } = require('../../../src/middleware/error.middleware');

// Helper: build an already-expired token signed with the given secret
function makeExpiredToken(secret) {
  return jwt.sign(
    { sub: 'user-id', exp: Math.floor(Date.now() / 1000) - 60 },
    secret
  );
}

// Helper: decode without verifying (inspect claims only)
function decode(token) {
  return jwt.decode(token);
}

describe('signAccessToken', () => {
  it('returns a JWT that verifyAccessToken can decode', () => {
    const token = signAccessToken({ sub: 'abc', role: 'user' });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('abc');
    expect(payload.role).toBe('user');
  });

  it('sets a 15-minute expiry', () => {
    const token = signAccessToken({ sub: 'abc' });
    const { iat, exp } = decode(token);
    expect(exp - iat).toBe(15 * 60);
  });
});

describe('verifyAccessToken', () => {
  it('returns the decoded payload for a valid token', () => {
    const token = signAccessToken({ sub: 'xyz', role: 'admin' });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('xyz');
    expect(payload.role).toBe('admin');
  });

  it('throws AppError 401 for a tampered token', () => {
    const token = signAccessToken({ sub: 'abc' }) + 'tampered';
    expect(() => verifyAccessToken(token)).toThrow(AppError);
    expect(() => verifyAccessToken(token)).toThrow(
      expect.objectContaining({ statusCode: 401 })
    );
  });

  it('throws AppError 401 for an expired token', () => {
    const expired = makeExpiredToken(process.env.JWT_ACCESS_SECRET);
    expect(() => verifyAccessToken(expired)).toThrow(
      expect.objectContaining({ statusCode: 401 })
    );
  });

  it('rejects a token signed with the refresh secret', () => {
    const wrongToken = signRefreshToken({ sub: 'abc', jti: '1' });
    expect(() => verifyAccessToken(wrongToken)).toThrow(
      expect.objectContaining({ statusCode: 401 })
    );
  });
});

describe('signRefreshToken', () => {
  it('defaults to a 7-day expiry when rememberMe is false', () => {
    const token = signRefreshToken({ sub: 'abc', jti: '1' }, false);
    const { iat, exp } = decode(token);
    expect(exp - iat).toBe(7 * 24 * 60 * 60);
  });

  it('uses a 30-day expiry when rememberMe is true', () => {
    const token = signRefreshToken({ sub: 'abc', jti: '1' }, true);
    const { iat, exp } = decode(token);
    expect(exp - iat).toBe(30 * 24 * 60 * 60);
  });

  it('defaults rememberMe to false when not provided', () => {
    const token = signRefreshToken({ sub: 'abc', jti: '1' });
    const { iat, exp } = decode(token);
    expect(exp - iat).toBe(7 * 24 * 60 * 60);
  });
});

describe('verifyRefreshToken', () => {
  it('returns the decoded payload for a valid token', () => {
    const token = signRefreshToken({ sub: 'abc', jti: 'db-row-id' });
    const payload = verifyRefreshToken(token);
    expect(payload.sub).toBe('abc');
    expect(payload.jti).toBe('db-row-id');
  });

  it('throws AppError 401 for a tampered token', () => {
    const token = signRefreshToken({ sub: 'abc', jti: '1' }) + 'tampered';
    expect(() => verifyRefreshToken(token)).toThrow(
      expect.objectContaining({ statusCode: 401 })
    );
  });

  it('throws AppError 401 for an expired token', () => {
    const expired = makeExpiredToken(process.env.JWT_REFRESH_SECRET);
    expect(() => verifyRefreshToken(expired)).toThrow(
      expect.objectContaining({ statusCode: 401 })
    );
  });

  it('rejects a token signed with the access secret', () => {
    const wrongToken = signAccessToken({ sub: 'abc', role: 'user' });
    expect(() => verifyRefreshToken(wrongToken)).toThrow(
      expect.objectContaining({ statusCode: 401 })
    );
  });
});
