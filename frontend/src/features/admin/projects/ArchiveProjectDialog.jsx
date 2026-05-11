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

const iconBox = (
  <div style={{ width: 48, height: 48, borderRadius: 8, background: '#E53E3E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} aria-hidden="true">
    <ArchiveIcon />
  </div>
);

export function ArchiveProjectDialog({ project, onClose, onConfirm, loading }) {
  return (
    <Modal title="העברה לארכיון" subtitle="פעולה זו תסיר את הפרויקט מתפריטי המשתמשים" icon={iconBox} size="narrow" className="archive-project-dialog" onClose={onClose} footer={
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
