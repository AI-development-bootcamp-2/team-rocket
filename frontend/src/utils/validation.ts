export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Must stay in sync with SPECIAL_CHAR_RE in server/src/utils/password.ts
const SPECIAL_CHAR_RE = /[!@#$%^&*()\-_=+[\]{};:'",.<>/?\\|`~]/;

export function validatePasswordStrength(password: string, email: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    SPECIAL_CHAR_RE.test(password) &&
    password.toLowerCase() !== email.toLowerCase()
  );
}
