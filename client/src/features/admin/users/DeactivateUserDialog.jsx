import { Modal } from '../../../components/ui/Modal.jsx'
import { Button } from '../../../components/ui/Button.jsx'

export function DeactivateUserDialog({ user, onClose, onConfirm, loading }) {
  const isInactive = !user.isActive

  return (
    <Modal
      title={isInactive ? 'הפעלת משתמש' : 'השבתת משתמש'}
      icon={isInactive ? '↻' : '⚠'}
      size="narrow"
      onClose={onClose}
      footer={
        <div className="dialog-actions">
          <Button variant="secondary" onClick={onClose}>
            ביטול
          </Button>
          <Button variant={isInactive ? 'primary' : 'danger'} onClick={onConfirm} disabled={loading}>
            {loading ? (isInactive ? 'מפעיל...' : 'משבית...') : isInactive ? 'הפעלה' : 'השבתה'}
          </Button>
        </div>
      }
    >
      <div className="dialog-copy">
        <p>
          {isInactive
            ? `להפעיל מחדש את החשבון של ${user.firstName} ${user.lastName}?`
            : `לכבות את החשבון של ${user.firstName} ${user.lastName}?`}
        </p>
        <p className="dialog-copy__subtext">
          {isInactive
            ? 'המשתמש יחזור להיות פעיל ויוכל להתחבר מחדש.'
            : 'This will log the user out immediately.'}
        </p>
      </div>
    </Modal>
  )
}
