import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient, { tokenStore } from '../api/axiosClient';
import { useAuth } from '../contexts/AuthContext';
import styles from './ChangePasswordCard.module.css';

const POLICY_RULES = [
  { id: 'length', label: 'לפחות 8 תווים', test: (p: string) => p.length >= 8 },
  { id: 'upper', label: 'לפחות אות גדולה אחת באנגלית', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'לפחות אות קטנה אחת באנגלית', test: (p: string) => /[a-z]/.test(p) },
  { id: 'digit', label: 'לפחות ספרה אחת', test: (p: string) => /\d/.test(p) },
  { id: 'special', label: 'לפחות תו מיוחד אחד', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
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
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const policyPassed = POLICY_RULES.every((rule) => rule.test(newPassword));
  const passwordsMatch = newPassword === confirmPassword;
  const sameAsCurrent = currentPassword.length > 0 && newPassword === currentPassword;
  const canSubmit = policyPassed && passwordsMatch && confirmPassword.length > 0 && !sameAsCurrent;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setIsLoading(true);
    setError('');

    try {
      const { data } = await axiosClient.post<{ accessToken: string }>('/auth/change-password', {
        ...(currentPassword ? { currentPassword } : {}),
        newPassword,
      });

      tokenStore.set(data.accessToken);
      clearMustChangePassword();
      navigate('/', { replace: true });
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 401) setError('הסיסמה הנוכחית שגויה.');
      else if (status === 400) {
        const msg = err.response?.data?.error ?? '';
        setError(msg.includes('different') ? 'הסיסמה החדשה חייבת להיות שונה מהסיסמה הנוכחית.' : 'הסיסמה החדשה לא עומדת בדרישות האבטחה.');
      }
      else setError('משהו השתבש. נסו שוב.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.card} dir="rtl">
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <div className={styles.logoWrapper}>
          <img src="/images/abra-logo.png" alt="לוגו Abra" className={styles.logo} />
        </div>

        <h1 className={styles.title}>החלפת סיסמה</h1>
        <p className={styles.subtitle}>
          {user?.fullName ? `שלום ${user.fullName}, ` : ''}
          צריך להחליף סיסמה לפני שממשיכים.
        </p>

        {error && (
          <div className={styles.error} role="alert">{error}</div>
        )}

        <div className={styles.fieldGroup}>
          <label className={styles.label}>סיסמה נוכחית</label>
          <div className={styles.passwordWrapper}>
            <input
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="יש להזין סיסמה נוכחית"
              className={`${styles.input} ${styles.passwordInput}`}
              autoComplete="current-password"
            />
            <button
              type="button"
              className={styles.eyeButton}
              onClick={() => setShowCurrent(!showCurrent)}
              aria-label={showCurrent ? 'הסתרת סיסמה' : 'הצגת סיסמה'}
            >
              <EyeIcon visible={showCurrent} />
            </button>
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>סיסמה חדשה</label>
          <div className={styles.passwordWrapper}>
            <input
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="יש להזין סיסמה חדשה"
              className={`${styles.input} ${styles.passwordInput}`}
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              className={styles.eyeButton}
              onClick={() => setShowNew(!showNew)}
              aria-label={showNew ? 'הסתרת סיסמה' : 'הצגת סיסמה'}
            >
              <EyeIcon visible={showNew} />
            </button>
          </div>
          {newPassword && (
            <ul className={styles.policyList} aria-label="כללי סיסמה">
              {POLICY_RULES.map((rule) => (
                <li key={rule.id} className={rule.test(newPassword) ? styles.rulePass : styles.ruleFail}>
                  <span aria-hidden="true">{rule.test(newPassword) ? 'תקין' : 'חסר'}</span>
                  {rule.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>אימות סיסמה</label>
          <div className={styles.passwordWrapper}>
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="יש לאמת את הסיסמה החדשה"
              className={`${styles.input} ${styles.passwordInput} ${
                confirmPassword && !passwordsMatch ? styles.inputError : ''
              }`}
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              className={styles.eyeButton}
              onClick={() => setShowConfirm(!showConfirm)}
              aria-label={showConfirm ? 'הסתרת סיסמה' : 'הצגת סיסמה'}
            >
              <EyeIcon visible={showConfirm} />
            </button>
          </div>
          {confirmPassword && !passwordsMatch && (
            <p className={styles.mismatch}>הסיסמאות אינן תואמות.</p>
          )}
          {sameAsCurrent && (
            <p className={styles.mismatch}>הסיסמה החדשה חייבת להיות שונה מהסיסמה הנוכחית.</p>
          )}
        </div>

        <button type="submit" disabled={isLoading || !canSubmit} className={styles.submitButton}>
          {isLoading ? <span className={styles.spinner} aria-hidden="true" /> : 'שמירת סיסמה'}
        </button>
      </form>
    </div>
  );
};

export default ChangePasswordCard;
