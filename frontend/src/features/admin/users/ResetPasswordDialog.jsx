import { useMemo, useState } from 'react';
import { Modal } from '../../../components/ui/Modal.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { validatePasswordStrength } from '../../../utils/validation.js';

export function ResetPasswordDialog({ user, onClose, onConfirm, loading }) {
  const [temporaryPassword, setTemporaryPassword] = useState('');

  const error = useMemo(() => {
    if (!temporaryPassword.trim()) return 'חובה להזין סיסמה זמנית';
    if (!validatePasswordStrength(temporaryPassword, user.email)) {
      return 'הסיסמה חייבת לכלול אות גדולה, אות קטנה, ספרה, תו מיוחד ולפחות 8 תווים';
    }
    return '';
  }, [temporaryPassword, user.email]);

  function handleSubmit(event) {
    event.preventDefault();
    if (error) return;
    onConfirm(temporaryPassword.trim());
  }

  return (
    <Modal
      title="איפוס סיסמה"
      icon="R"
      size="narrow"
      onClose={onClose}
      footer={
        <div className="dialog-actions">
          <Button variant="secondary" onClick={onClose}>
            ביטול
          </Button>
          <Button type="submit" form="reset-password-form" disabled={loading || Boolean(error)}>
            {loading ? 'מאפס...' : 'איפוס סיסמה'}
          </Button>
        </div>
      }
    >
      <form id="reset-password-form" className="reset-password-form" onSubmit={handleSubmit}>
        <div className="dialog-copy">
          <p>{`יש להזין סיסמה זמנית עבור ${user.firstName} ${user.lastName}.`}</p>
          <p className="dialog-copy__subtext">
            המשתמש יתבקש להחליף אותה בכניסה המוצלחת הבאה.
          </p>
        </div>

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
    </Modal>
  );
}
