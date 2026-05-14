// @ts-nocheck
export function Toast({ message, tone = 'info', onClose }) {
  return (
    <div className={`ui-toast ui-toast--${tone}`} role="status" aria-live="polite">
      <div className="ui-toast__content">
        <span className="ui-toast__icon" aria-hidden="true">
          {tone === 'error' ? '!' : 'OK'}
        </span>
        <span className="ui-toast__message">{message}</span>
      </div>
      <button type="button" className="ui-toast__close" onClick={onClose} aria-label="סגירה">
        x
      </button>
    </div>
  );
}

