import { ClientForm } from './ClientForm.jsx';

export function ClientFormDialog({ mode = 'create', client, onClose, onSubmit, saving }) {
  const isEdit = mode === 'edit';
  const title = isEdit ? 'עריכת לקוח' : 'יצירת לקוח';
  const subtitle = isEdit
    ? 'עדכון פרטי הלקוח במערכת'
    : 'הזן את הפרטים הראשוניים כדי להוסיף לקוח חדש למערכת';
  const cta = isEdit ? 'שמירה' : 'צור לקוח חדש';

  return (
    <div
      className="ui-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <section
        className="ui-modal client-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="ui-modal__close"
          onClick={onClose}
          aria-label="סגירה"
        >
          ×
        </button>

        <header className="client-modal__header">
          <div className="client-modal__icon" aria-hidden="true">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M9 4h6a2 2 0 0 1 2 2v1h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3V6a2 2 0 0 1 2-2Zm0 3h6V6H9v1Zm-5 2v3h16V9H4Zm0 5v3h16v-3H4Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <h2 className="client-modal__title">{title}</h2>
          <p className="client-modal__subtitle">{subtitle}</p>
        </header>

        <div className="client-modal__content">
          <ClientForm
            id="client-form"
            initialValues={client}
            onSubmit={onSubmit}
          />
        </div>

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
