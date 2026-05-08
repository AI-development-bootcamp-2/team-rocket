import { Modal } from '../../../components/ui/Modal.jsx';
import { Button } from '../../../components/ui/Button.jsx';

export function DeactivateUserDialog({ user, onClose, onConfirm, loading }) {
  const isInactive = !user.isActive;

  return (
    <Modal
      title={isInactive ? 'הפעלת משתמש' : 'השבתת משתמש'}
      icon={isInactive ? 'A' : '!'}
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
            ? `להפעיל מחדש את ${user.firstName} ${user.lastName}?`
            : `להשבית את ${user.firstName} ${user.lastName}?`}
        </p>
        <p className="dialog-copy__subtext">
          {isInactive
            ? 'המשתמש יוכל להתחבר שוב באופן מיידי.'
            : 'כל הסשנים הפעילים יבוטלו מיד.'}
        </p>
      </div>
    </Modal>
  );
}
