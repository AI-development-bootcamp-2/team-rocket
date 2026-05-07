import React, { useState } from 'react';
import styles from './LoginCard.module.css';

interface LoginCardProps {
  onSubmit?: (email: string, password: string, rememberMe: boolean) => void;
  isLoading?: boolean;
  error?: string;
}

export const LoginCard: React.FC<LoginCardProps> = ({ onSubmit, isLoading = false, error }) => {
  const [email, setEmail] = useState(() => localStorage.getItem('rememberedEmail') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem('rememberedEmail'));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(email, password, rememberMe);
  };

  return (
    <div className={styles.loginCard} dir="rtl">
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <div className={styles.logoWrapper}>
          <img
            src="/images/abra-logo.png"
            alt="Abra Logo"
            className={styles.logo}
          />
        </div>

        <h1 className={styles.title}>
          <span className={styles.titleLine}>👋 ברוכים הבאים למערכת</span>
          <span className={styles.titleLine}>הניהול של אברא</span>
        </h1>

        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}

        <div className={styles.inputsWrapper}>
          <div className={styles.formGroup}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="הכנס כתובת דוא״ל"
              className={styles.input}
              autoComplete="email"
              required
            />
          </div>

          <div className={styles.passwordWrapper}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="הכנס סיסמה"
              className={`${styles.input} ${styles.passwordInput}`}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className={styles.eyeButton}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
            >
              {showPassword ? (
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
              )}
            </button>
          </div>

          <div className={styles.rememberRow}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              זכור אותי
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={styles.submitButton}
        >
          {isLoading ? <span className={styles.spinner} aria-hidden="true" /> : 'התחבר'}
        </button>
      </form>
    </div>
  );
};
