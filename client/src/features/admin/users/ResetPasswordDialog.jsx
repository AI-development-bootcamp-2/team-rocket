import { useMemo, useState } from 'react'
import { Modal } from '../../../components/ui/Modal.jsx'
import { Button } from '../../../components/ui/Button.jsx'
import { Input } from '../../../components/ui/Input.jsx'

function validatePasswordStrength(password, email) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
    /[!@#$%^&*()\-_=+[{\]};:'",.<>/?\\|`~]/.test(password),
    password.toLowerCase() !== email.toLowerCase(),
  ]

  return checks.every(Boolean)
}

export function ResetPasswordDialog({ user, onClose, onConfirm, loading }) {
  const [temporaryPassword, setTemporaryPassword] = useState('')

  const error = useMemo(() => {
    if (!temporaryPassword.trim()) return 'שדה חובה'
    if (!validatePasswordStrength(temporaryPassword, user.email)) {
      return 'הסיסמה חייבת לכלול 8 תווים, אות גדולה, אות קטנה, מספר ותו מיוחד'
    }
    return ''
  }, [temporaryPassword, user.email])

  function handleSubmit(event) {
    event.preventDefault()
    if (error) return
    onConfirm(temporaryPassword.trim())
  }

  return (
    <Modal
      title="איפוס סיסמה"
      icon="↺"
      size="narrow"
      onClose={onClose}
      footer={
        <div className="dialog-actions">
          <Button variant="secondary" onClick={onClose}>
            ביטול
          </Button>
          <Button type="submit" form="reset-password-form" disabled={loading || Boolean(error)}>
            {loading ? 'מאפס...' : 'איפוס'}
          </Button>
        </div>
      }
    >
      <form id="reset-password-form" className="reset-password-form" onSubmit={handleSubmit}>
        <div className="dialog-copy">
          <p>{`הזן סיסמה זמנית חדשה עבור ${user.firstName} ${user.lastName}.`}</p>
          <p className="dialog-copy__subtext">המשתמש יידרש להחליף סיסמה בכניסה הבאה.</p>
        </div>

        <Input
          label="סיסמה זמנית"
          type="password"
          value={temporaryPassword}
          error={error}
          onChange={(event) => setTemporaryPassword(event.target.value)}
        />

        <p className="user-form__hint">
          הסיסמה חייבת לכלול 8 תווים לפחות, אות גדולה, אות קטנה, מספר ותו מיוחד.
        </p>
      </form>
    </Modal>
  )
}
