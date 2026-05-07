import bcrypt from 'bcryptjs';

const BCRYPT_COST = 12;
const SPECIAL_CHAR_RE = /[!@#$%^&*()\-_=+[\]{};:'",.<>/?\\|`~]/;

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_COST);
}

export async function comparePassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

/**
 * Returns an array of human-readable violation strings.
 * An empty array means the password passes all rules.
 */
export function validatePasswordPolicy(password: string, email: string): string[] {
  const violations: string[] = [];

  if (password.length < 8) {
    violations.push('at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    violations.push('at least 1 uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    violations.push('at least 1 lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    violations.push('at least 1 digit');
  }
  if (!SPECIAL_CHAR_RE.test(password)) {
    violations.push('at least 1 special character');
  }
  if (password.toLowerCase() === email.toLowerCase()) {
    violations.push('password must not be the same as your email address');
  }

  return violations;
}
