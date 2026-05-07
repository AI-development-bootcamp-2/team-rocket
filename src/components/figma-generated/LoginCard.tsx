import React from 'react';
import styles from './LoginCard.module.css';

interface LoginCardProps {
  onSubmit?: (email: string, password: string) => void;
  isLoading?: boolean;
  error?: string;
  /** Optional illustration URL or element. Falls back to placeholder slot. */
  illustration?: string | React.ReactNode;
}

export const LoginCard: React.FC<LoginCardProps> = ({
  onSubmit,
  isLoading = false,
  error,
  illustration,
}) => {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(email, password);
  };

  return (
    <div className={styles.loginCard} dir="rtl" lang="he">
      <div className={styles.illustration} aria-hidden="true">
        {typeof illustration === 'string' ? (
          <img src={illustration} alt="כניסה למערכת" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
        ) : illustration ?? null}
      </div>

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <h2 className={styles.title}>כניסה למערכת</h2>

        {error && <div className={styles.error} role="alert">{error}</div>}

        <div className={styles.formGroup}>
          <label htmlFor="email" className={styles.label}>דוא"ל</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className={styles.input}
            autoComplete="email"
            inputMode="email"
            dir="ltr"
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="password" className={styles.label}>סיסמה</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={styles.input}
            autoComplete="current-password"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={styles.submitButton}
          aria-busy={isLoading}
        >
          {isLoading ? 'מתחבר...' : 'כניסה'}
        </button>
      </form>
    </div>
  );
};
