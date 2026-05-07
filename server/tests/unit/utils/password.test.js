process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test_access_secret_at_least_32_chars!!';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_at_least_32chars!';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.FRONTEND_URL = 'http://localhost:5173';

jest.mock('bcryptjs');
const bcrypt = require('bcryptjs');
const { hashPassword, comparePassword, validatePasswordPolicy } = require('../../../src/utils/password');

describe('hashPassword', () => {
  it('delegates to bcrypt.hash with cost factor 12', async () => {
    bcrypt.hash.mockResolvedValue('$2b$12$hashed');
    const result = await hashPassword('MyPassword1!');
    expect(bcrypt.hash).toHaveBeenCalledWith('MyPassword1!', 12);
    expect(result).toBe('$2b$12$hashed');
  });
});

describe('comparePassword', () => {
  it('returns true when the password matches the hash', async () => {
    bcrypt.compare.mockResolvedValue(true);
    await expect(comparePassword('correct', '$hash$')).resolves.toBe(true);
  });

  it('returns false when the password does not match', async () => {
    bcrypt.compare.mockResolvedValue(false);
    await expect(comparePassword('wrong', '$hash$')).resolves.toBe(false);
  });
});

describe('validatePasswordPolicy', () => {
  const VALID_PASSWORD = 'ValidPass1!';
  const EMAIL = 'user@example.com';

  it('returns an empty array for a fully valid password', () => {
    expect(validatePasswordPolicy(VALID_PASSWORD, EMAIL)).toEqual([]);
  });

  it('reports a violation when shorter than 8 characters', () => {
    expect(validatePasswordPolicy('Sh0rt!', EMAIL)).toContain('at least 8 characters');
  });

  it('reports a violation when there is no uppercase letter', () => {
    expect(validatePasswordPolicy('nouppercase1!', EMAIL)).toContain(
      'at least 1 uppercase letter'
    );
  });

  it('reports a violation when there is no lowercase letter', () => {
    expect(validatePasswordPolicy('NOLOWER001!', EMAIL)).toContain(
      'at least 1 lowercase letter'
    );
  });

  it('reports a violation when there is no digit', () => {
    expect(validatePasswordPolicy('NoDigitHere!', EMAIL)).toContain('at least 1 digit');
  });

  it('reports a violation when there is no special character', () => {
    expect(validatePasswordPolicy('NoSpecial123', EMAIL)).toContain(
      'at least 1 special character'
    );
  });

  it('reports a violation when the password equals the email (case-insensitive)', () => {
    expect(validatePasswordPolicy('user@example.com', 'User@Example.com')).toContain(
      'password must not be the same as your email address'
    );
  });

  it('can return multiple violations simultaneously', () => {
    // 'short' — fails length, uppercase, digit, special
    const violations = validatePasswordPolicy('short', EMAIL);
    expect(violations.length).toBeGreaterThan(1);
  });

  it('returns no false positives for a password that contains but does not equal the email', () => {
    const password = 'user@example.com_Extra1!';
    expect(validatePasswordPolicy(password, EMAIL)).toEqual([]);
  });
});
