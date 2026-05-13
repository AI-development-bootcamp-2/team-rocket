import { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';

const HEBREW_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

export function UnlockReasonDialog({ month, year, loading, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const monthName = HEBREW_MONTHS[month - 1] ?? month;
  const hasError = touched && !reason.trim();

  function handleSubmit() {
    setTouched(true);
    if (!reason.trim()) return;
    onConfirm(reason.trim());
  }

  return (
    <Modal
      title={`לפתוח את חודש ${monthName} ${year}?`}
      icon="🔓"
      size="narrow"
      onClose={onClose}
      footer={
        <div className="dialog-actions">
          <Button variant="secondary" onClick={onClose} disabled={loading}>ביטול</Button>
          <Button className="month-lock-unlock-btn" onClick={handleSubmit} disabled={loading}>
            {loading ? 'פותח...' : 'פתח חודש'}
          </Button>
        </div>
      }
    >
      <div className="dialog-copy">
        <div className="ui-field">
          <label className="ui-field__label" htmlFor="unlock-reason">סיבת הפתיחה</label>
          <textarea
            id="unlock-reason"
            className={`ui-input${hasError ? ' ui-input--error' : ''}`}
            style={{ minHeight: '80px', resize: 'vertical' }}
            placeholder="סיבת הפתיחה"
            value={reason}
            onChange={(e) => { setReason(e.target.value); setTouched(true); }}
            disabled={loading}
          />
          {hasError ? (
            <span className="ui-field__error">יש להזין סיבה לפתיחת החודש.</span>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
