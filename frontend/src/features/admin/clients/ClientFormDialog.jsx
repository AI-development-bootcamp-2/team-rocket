import { ClientForm } from './ClientForm.jsx';

export function ClientFormDialog({ mode = 'create', client, onClose, onSubmit, saving }) {
  const isEdit = mode === 'edit';
  const title = isEdit ? 'עריכת לקוח' : 'יצירת לקוח';
  const subtitle = isEdit
    ? 'עדכון פרטי הלקוח במערכת'
    : 'כאן תיצור את הלקוח החדש שיופיע במערכת';
  const cta = isEdit ? 'שמירה' : 'צור לקוח חדש';

  return (
    <div
      className="ui-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <section
        className="client-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="client-modal__header">
          <div className="client-modal__header-group">
            <div className="client-modal__icon" aria-hidden="true">
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="16" cy="16" r="13.33" stroke="white" strokeWidth="2" />
                <path
                  d="M16 10.67V21.33M10.67 16H21.33"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="client-modal__header-text">
              <h2 className="client-modal__title">{title}</h2>
              <p className="client-modal__subtitle">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            className="client-modal__close"
            onClick={onClose}
            aria-label="סגירה"
          >
            <svg width="11.67" height="11.67" viewBox="0 0 11.67 11.67" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0 0L11.67 11.67M11.67 0L0 11.67" stroke="#212525" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </header>

        <ClientForm
          id="client-form"
          initialValues={client}
          onSubmit={onSubmit}
        />

        <footer className="client-modal__footer">
          <button
            type="submit"
            form="client-form"
            className="client-modal__cta"
            disabled={saving}
          >
            <span className="client-modal__cta-icon" aria-hidden="true">＋</span>
            <span>{saving ? 'שומר...' : cta}</span>
          </button>
        </footer>
      </section>
    </div>
  );
}
