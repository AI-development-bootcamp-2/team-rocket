import { Modal } from '../../../components/ui/Modal.jsx';
import { Button } from '../../../components/ui/Button.jsx';

export function ArchiveProjectDialog({ project, onClose, onConfirm, loading }) {
  return (
    <Modal title="העברה לארכיון" icon="!" size="narrow" onClose={onClose} footer={
      <div className="dialog-actions">
        <Button variant="secondary" onClick={onClose}>
          ביטול
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={loading}>
          {loading ? 'מעביר...' : 'העבר לארכיון'}
        </Button>
      </div>
    }>
      <div className="dialog-copy">
        <p>{`להעביר את "${project?.name}" לארכיון?`}</p>
        <p className="dialog-copy__subtext">
          כל המשימות של הפרויקט יוסרו מתפריטי הדיווח של המשתמשים.
        </p>
      </div>
    </Modal>
  );
}
