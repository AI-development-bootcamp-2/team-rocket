import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../contexts/AuthContext';
import styles from './ChangePasswordCard.module.css';

const POLICY_RULES = [
  { id: 'length',  label: 'לפחות 8 תווים',          test: (p: string) => p.length >= 8 },
  { id: 'upper',   label: 'אות גדולה אחת לפחות',     test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower',   label: 'אות קטנה אחת לפחות',     test: (p: string) => /[a-z]/.test(p) },
  { id: 'digit',   label: 'ספרה אחת לפחות',          test: (p: string) => /\d/.test(p) },
  { id: 'special', label: 'תו מיוחד אחד לפחות',     test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const EyeIcon: React.FC<{ visible: boolean }> = ({ visible }) =>
  visible ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.11 1 12c.92-2.19 2.5-4.08 4.5-5.5" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.89 11 8a11.64 11.64 0 0 1-2.16 3.19" />
      <path d="M1 1l22 22" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );

const ChangePasswordCard: React.FC = () => {
  const { user, clearMustChangePassword } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent]         = useState(false);
  const [showNew, setShowNew]                 = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [isLoading, setIsLoading]             = useState(false);
  const [error, setError]                     = useState('');

  const policyPassed = POLICY_RULES.every((r) => r.test(newPassword));
  const passwordsMatch = newPassword === confirmPassword;
  const canSubmit = policyPassed && passwordsMatch && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsLoading(true);
    setError('');
    try {
      await axiosClient.post('/auth/change-password', {
        ...(currentPassword ? { currentPassword } : {}),
        newPassword,
      });
      clearMustChangePassword();
      navigate('/', { replace: true });
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 401) setError('הסיסמה הנוכחית שגויה');
      else if (status === 400) setError(err.response?.data?.message || 'הסיסמה אינה עומדת בדרישות');
      else setError('אירעה שגיאה. אנא נסה שוב');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.card} dir="rtl">
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <div className={styles.logoWrapper}>
          <img src="/images/abra-logo.png" alt="Abra Logo" className={styles.logo} />
        </div>

        <h1 className={styles.title}>שינוי סיסמה</h1>
        <p className={styles.subtitle}>
          {user?.fullName ? `שלום ${user.fullName}, ` : ''}
          נדרש לשנות את הסיסמה בכניסה הראשונה
        </p>

        {error && (
          <div className={styles.error} role="alert">{error}</div>
        )}

        {/* Current password */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>סיסמה נוכחית</label>
          <div className={styles.passwordWrapper}>
            <input
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="הכנס סיסמה נוכחית"
              className={`${styles.input} ${styles.passwordInput}`}
              autoComplete="current-password"
            />
            <button type="button" className={styles.eyeButton}
              onClick={() => setShowCurrent(!showCurrent)}
              aria-label={showCurrent ? 'הסתר' : 'הצג'}>
              <EyeIcon visible={showCurrent} />
            </button>
          </div>
        </div>

        {/* New password + policy */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>סיסמה חדשה</label>
          <div className={styles.passwordWrapper}>
            <input
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="הכנס סיסמה חדשה"
              className={`${styles.input} ${styles.passwordInput}`}
              autoComplete="new-password"
              required
            />
            <button type="button" className={styles.eyeButton}
              onClick={() => setShowNew(!showNew)}
              aria-label={showNew ? 'הסתר' : 'הצג'}>
              <EyeIcon visible={showNew} />
            </button>
          </div>
          {newPassword && (
            <ul className={styles.policyList} aria-label="דרישות סיסמה">
              {POLICY_RULES.map((rule) => (
                <li key={rule.id} className={rule.test(newPassword) ? styles.rulePass : styles.ruleFail}>
                  <span aria-hidden="true">{rule.test(newPassword) ? '✓' : '✗'}</span>
                  {rule.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Confirm password */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>אימות סיסמה</label>
          <div className={styles.passwordWrapper}>
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="הכנס סיסמה שוב"
              className={`${styles.input} ${styles.passwordInput} ${
                confirmPassword && !passwordsMatch ? styles.inputError : ''
              }`}
              autoComplete="new-password"
              required
            />
            <button type="button" className={styles.eyeButton}
              onClick={() => setShowConfirm(!showConfirm)}
              aria-label={showConfirm ? 'הסתר' : 'הצג'}>
              <EyeIcon visible={showConfirm} />
            </button>
          </div>
          {confirmPassword && !passwordsMatch && (
            <p className={styles.mismatch}>הסיסמאות אינן תואמות</p>
          )}
        </div>

        <button type="submit" disabled={isLoading || !canSubmit} className={styles.submitButton}>
          {isLoading ? <span className={styles.spinner} aria-hidden="true" /> : 'שמור סיסמה'}
        </button>
      </form>
    </div>
  );
};

export default ChangePasswordCard;
