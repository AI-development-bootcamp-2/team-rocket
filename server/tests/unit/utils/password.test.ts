import bcrypt from 'bcryptjs';
import { hashPassword, comparePassword, validatePasswordPolicy } from '../../../src/utils/password';

jest.mock('bcryptjs');
const mockedBcrypt = jest.mocked(bcrypt);

describe('hashPassword', () => {
  it('delegates to bcrypt.hash with cost factor 12', async () => {
    mockedBcrypt.hash.mockResolvedValue('$2b$12$hashed' as never);
    const result = await hashPassword('MyPassword1!');
    expect(mockedBcrypt.hash).toHaveBeenCalledWith('MyPassword1!', 12);
    expect(result).toBe('$2b$12$hashed');
  });
});

describe('comparePassword', () => {
  it('returns true when the password matches the hash', async () => {
    mockedBcrypt.compare.mockResolvedValue(true as never);
    await expect(comparePassword('correct', '$hash$')).resolves.toBe(true);
  });

  it('returns false when the password does not match', async () => {
    mockedBcrypt.compare.mockResolvedValue(false as never);
    await expect(comparePassword('wrong', '$hash$')).resolves.toBe(false);
  });
});

describe('validatePasswordPolicy', () => {
  const VALID = 'ValidPass1!';
  const EMAIL = 'user@example.com';

  it('returns an empty array for a fully valid password', () => {
    expect(validatePasswordPolicy(VALID, EMAIL)).toEqual([]);
  });

  it('reports a violation when shorter than 8 characters', () => {
    expect(validatePasswordPolicy('Sh0rt!', EMAIL)).toContain('at least 8 characters');
  });

  it('reports a violation when there is no uppercase letter', () => {
    expect(validatePasswordPolicy('nouppercase1!', EMAIL)).toContain('at least 1 uppercase letter');
  });

  it('reports a violation when there is no lowercase letter', () => {
    expect(validatePasswordPolicy('NOLOWER001!', EMAIL)).toContain('at least 1 lowercase letter');
  });

  it('reports a violation when there is no digit', () => {
    expect(validatePasswordPolicy('NoDigitHere!', EMAIL)).toContain('at least 1 digit');
  });

  it('reports a violation when there is no special character', () => {
    expect(validatePasswordPolicy('NoSpecial123', EMAIL)).toContain('at least 1 special character');
  });

  it('reports a violation when the password equals the email (case-insensitive)', () => {
    expect(validatePasswordPolicy('user@example.com', 'User@Example.com')).toContain(
      'password must not be the same as your email address',
    );
  });

  it('can return multiple violations simultaneously', () => {
    const violations = validatePasswordPolicy('short', EMAIL);
    expect(violations.length).toBeGreaterThan(1);
  });

  it('returns no false positives for a password that contains but does not equal the email', () => {
    expect(validatePasswordPolicy('user@example.com_Extra1!', EMAIL)).toEqual([]);
  });
});
