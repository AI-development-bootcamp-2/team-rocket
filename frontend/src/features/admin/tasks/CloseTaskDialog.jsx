import { Modal } from '../../../components/ui/Modal.jsx';
import { Button } from '../../../components/ui/Button.jsx';

function ArchiveIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="20" height="5" rx="1.5" stroke="white" strokeWidth="1.8"/>
      <path d="M4 8v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M9.5 13h5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

export function CloseTaskDialog({ task, onClose, onConfirm, loading }) {
  return (
    <Modal
      title="סגירת משימה"
      icon={<ArchiveIcon />}
      size="narrow"
      className="close-task-dialog"
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
        <p>האם לסגור את המשימה <strong>{task?.name}</strong>?</p>
        <p className="dialog-copy__subtext">
          המשימה תוסר מכל תפריטי הדיווח. רשומות היסטוריות יישמרו.
        </p>
      </div>
    </Modal>
  );
}
