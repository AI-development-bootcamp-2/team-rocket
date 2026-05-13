// @ts-nocheck
import { useMemo, useState } from 'react';
import { Input } from '../../../components/ui/Input';
import { validatePasswordStrength } from '../../../utils/validation';

export function ResetPasswordDialog({ user, onClose, onConfirm, loading }) {
  const [temporaryPassword, setTemporaryPassword] = useState('');

  const error = useMemo(() => {
    if (!temporaryPassword.trim()) return 'חובה להזין סיסמה זמנית';
    if (!validatePasswordStrength(temporaryPassword, user.email)) {
      return 'הסיסמה חייבת לכלול אות גדולה, אות קטנה, ספרה, תו מיוחד ולפחות 8 תווים';
    }
    return '';
  }, [temporaryPassword, user.email]);

  const isReady = temporaryPassword.trim().length > 0 && !error;

  function handleSubmit(event) {
    event.preventDefault();
    if (error) return;
    onConfirm(temporaryPassword.trim());
  }

  return (
    <div className="ui-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="user-modal"
        role="dialog"
        aria-modal="true"
        aria-label="איפוס סיסמה"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="client-modal__close" onClick={onClose} aria-label="סגירה">
          <svg width="11.67" height="11.67" viewBox="0 0 11.67 11.67" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 0L11.67 11.67M11.67 0L0 11.67" stroke="#212525" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <header className="client-modal__header">
          <div className="client-modal__header-group">
            <div className="client-modal__icon" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="8" y="14.67" width="16" height="12" rx="2" stroke="white" strokeWidth="2" />
                <path d="M11.33 14.67V10.67C11.33 8.09 13.42 6 16 6C18.58 6 20.67 8.09 20.67 10.67V14.67" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="client-modal__header-text">
              <h2 className="client-modal__title">איפוס סיסמה</h2>
              <p className="client-modal__subtitle">{`סיסמה זמנית עבור ${user.firstName} ${user.lastName}`}</p>
            </div>
          </div>
        </header>

        <form id="reset-password-form" className="user-modal__form" onSubmit={handleSubmit}>
          <Input
            label="סיסמה זמנית"
            type="password"
            value={temporaryPassword}
            error={error}
            onChange={(event) => setTemporaryPassword(event.target.value)}
          />
          <p className="user-form__hint">
            הסיסמה חייבת לכלול לפחות 8 תווים, אות גדולה, אות קטנה, מספר ותו מיוחד.
          </p>
        </form>

        <footer className="user-modal__footer">
          <button
            type="submit"
            form="reset-password-form"
            className="client-modal__cta"
            disabled={!isReady || loading}
            style={isReady && !loading ? { backgroundColor: '#0C69FF' } : undefined}
          >
            {loading ? 'מאפס...' : 'איפוס סיסמה'}
          </button>
        </footer>
      </section>
    </div>
  );
}


