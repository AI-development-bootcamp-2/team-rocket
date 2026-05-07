const bcrypt = require('bcryptjs');

const BCRYPT_COST = 12;

// Special characters allowed by the password policy
const SPECIAL_CHAR_RE = /[!@#$%^&*()\-_=+\[\]{};:'",.<>/?\\|`~]/;

async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, BCRYPT_COST);
}

async function comparePassword(plaintext, hash) {
  return bcrypt.compare(plaintext, hash);
}

/**
 * Returns an array of human-readable violation strings.
 * An empty array means the password passes all rules.
 */
function validatePasswordPolicy(password, email) {
  const violations = [];

  if (typeof password !== 'string' || password.length < 8) {
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
  if (typeof email === 'string' && password.toLowerCase() === email.toLowerCase()) {
    violations.push('password must not be the same as your email address');
  }

  return violations;
}

module.exports = { hashPassword, comparePassword, validatePasswordPolicy };
