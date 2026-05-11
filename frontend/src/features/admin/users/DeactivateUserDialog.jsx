export function DeactivateUserDialog({ user, onClose, onConfirm, loading }) {
  const isInactive = !user.isActive;
  const title = isInactive ? 'הפעלת משתמש' : 'השבתת משתמש';
  const subtitle = isInactive
    ? 'המשתמש יוכל להתחבר שוב באופן מיידי'
    : 'כל הסשנים הפעילים יבוטלו מיד';

  return (
    <div className="ui-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="user-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="client-modal__close" onClick={onClose} aria-label="סגירה">
          <svg width="11.67" height="11.67" viewBox="0 0 11.67 11.67" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 0L11.67 11.67M11.67 0L0 11.67" stroke="#212525" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <header className="client-modal__header">
          <div className="client-modal__header-group">
            <div className="client-modal__icon" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="10.67" r="5.33" stroke="white" strokeWidth="2" />
                <path d="M5.33 26.67C5.33 21.51 10.07 17.33 16 17.33C21.93 17.33 26.67 21.51 26.67 26.67" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="client-modal__header-text">
              <h2 className="client-modal__title">{title}</h2>
              <p className="client-modal__subtitle">{subtitle}</p>
            </div>
          </div>
        </header>

        <p className="user-modal__body">
          {isInactive
            ? `להפעיל מחדש את ${user.firstName} ${user.lastName}?`
            : `להשבית את ${user.firstName} ${user.lastName}?`}
        </p>

        <footer className="user-modal__footer">
          <button
            type="button"
            className="client-modal__cta"
            style={{ backgroundColor: '#0C69FF' }}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading
              ? (isInactive ? 'מפעיל...' : 'משבית...')
              : (isInactive ? 'הפעלה' : 'השבתה')}
          </button>
        </footer>
      </section>
    </div>
  );
}
