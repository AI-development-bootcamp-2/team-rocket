import { Modal } from '../../../components/ui/Modal.jsx';
import { Button } from '../../../components/ui/Button.jsx';

export function ArchiveClientDialog({ client, onClose, onConfirm, loading }) {
  const activeCount = client?.activeProjectsCount ?? 0;

  return (
    <Modal title="ארכיון לקוח" icon="!" size="narrow" onClose={onClose} footer={
      <div className="dialog-actions">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          ביטול
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={loading}>
          {loading ? 'מעביר לארכיון...' : 'ארכיון'}
        </Button>
      </div>
    }>
      <div className="dialog-copy">
        <p>האם להעביר את הלקוח <strong>{client?.name}</strong> לארכיון?</p>
        {activeCount > 0 && (
          <p className="dialog-copy__warning">
            {`ללקוח זה ${activeCount} פרויקטים פעילים.`}
          </p>
        )}
        <p className="dialog-copy__subtext">
          כל הפרויקטים והמשימות שלו יוסתרו מהתפריטים של המשתמשים.
        </p>
      </div>
    </Modal>
  );
}
