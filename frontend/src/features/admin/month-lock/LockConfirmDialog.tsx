// @ts-nocheck
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';

const HEBREW_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

export function LockConfirmDialog({ month, year, unapprovedWeekCount, loading, onClose, onConfirm }) {
  const monthName = HEBREW_MONTHS[month - 1] ?? month;

  return (
    <Modal
      title={`לנעול את חודש ${monthName} ${year}?`}
      icon={null}
      size="narrow"
      onClose={onClose}
      footer={
        <div className="dialog-actions">
          <Button variant="secondary" onClick={onClose} disabled={loading}>ביטול</Button>
          <Button variant="danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'נועל...' : 'נעל חודש'}
          </Button>
        </div>
      }
    >
      <div className="dialog-copy">
        <p>כל עריכה תיחסם לכל המשתמשים לאחר הנעילה.</p>
        {unapprovedWeekCount > 0 ? (
          <p className="dialog-copy__warning">
            {`ישנם ${unapprovedWeekCount} שבועות שלא אושרו עדיין. ניתן להמשיך בכל זאת.`}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}


