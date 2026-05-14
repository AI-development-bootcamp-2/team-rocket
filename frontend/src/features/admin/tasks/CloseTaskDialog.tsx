export function CloseTaskDialog({ onClose, onConfirm, loading }: {
  task: any;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <div
      className="ui-modal-backdrop"
      role="presentation"
      onClick={!loading ? onClose : undefined}
    >
      <div
        className="close-task-card"
        role="dialog"
        aria-modal="true"
        aria-label="מחיקת משימה"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="close-task-card__header">
          <div className="close-task-card__icon" aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="48" height="48" rx="8" fill="#FFDFE0"/>
              <path d="M36 15.9733C31.56 15.5333 27.0933 15.3066 22.64 15.3066C20 15.3066 17.36 15.44 14.72 15.7066L12 15.9733" stroke="#FF2F32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M19.3335 14.627L19.6268 12.8803C19.8402 11.6137 20.0002 10.667 22.2535 10.667H25.7468C28.0002 10.667 28.1735 11.667 28.3735 12.8937L28.6668 14.627" stroke="#FF2F32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M33.1339 20.1865L32.2672 33.6132C32.1205 35.7065 32.0005 37.3332 28.2805 37.3332H19.7205C16.0005 37.3332 15.8805 35.7065 15.7339 33.6132L14.8672 20.1865" stroke="#FF2F32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21.7734 30H26.2134" stroke="#FF2F32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20.6665 24.667H27.3332" stroke="#FF2F32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="close-task-card__text">
            <h2 className="close-task-card__title">מחיקת משימה</h2>
            <div className="close-task-card__subtitle-row">
              <span className="close-task-card__subtitle">האם אתה בטוח שברצונך למחוק משימה זו?</span>
            </div>
          </div>
        </div>
        <div className="close-task-card__actions">
          <button
            type="button"
            className="close-task-card__btn close-task-card__btn--confirm"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'מוחק...' : 'מחיקה'}
          </button>
          <button
            type="button"
            className="close-task-card__btn close-task-card__btn--cancel"
            onClick={onClose}
            disabled={loading}
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
