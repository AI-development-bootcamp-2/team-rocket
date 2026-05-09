import { Modal } from '../../../components/ui/Modal.jsx';
import { Button } from '../../../components/ui/Button.jsx';

export function CloseTaskDialog({ task, onClose, onConfirm, loading }) {
  return (
    <Modal
      title="סגירת משימה"
      icon="!"
      size="narrow"
      onClose={onClose}
      footer={(
        <div className="dialog-actions">
          <Button variant="secondary" onClick={onClose}>
            ביטול
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'סוגר...' : 'סגור משימה'}
          </Button>
        </div>
      )}
    >
      <div className="dialog-copy">
        <p>{`לסגור את המשימה "${task?.name}"?`}</p>
        <p className="dialog-copy__subtext">
          המשימה תוסר מכל תפריטי הדיווח. רשומות היסטוריות יישמרו.
        </p>
      </div>
    </Modal>
  );
}
