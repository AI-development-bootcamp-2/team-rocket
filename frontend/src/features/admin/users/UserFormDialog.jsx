import { useState } from 'react';
import { UserForm } from './UserForm.jsx';
import { getInitialUserFormState } from './userFormState.js';

export function UserFormDialog({ mode = 'create', user, permissionFlag, onClose, onSubmit, saving }) {
  const isEdit = mode === 'edit';
  const title = isEdit ? 'עריכת משתמש' : 'יצירת משתמש';
  const subtitle = isEdit
    ? 'עדכון פרטי המשתמש במערכת'
    : 'כאן תיצור את המשתמש החדש שיופיע במערכת';

  const [isFormValid, setIsFormValid] = useState(false);
  const isReady = isFormValid;

  const formKey = JSON.stringify(getInitialUserFormState(user, permissionFlag));

  return (
    <div className="ui-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="user-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
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
          {isEdit && <span className="client-modal__edit-badge">עריכה</span>}
        </header>

        <UserForm
          key={formKey}
          mode={mode}
          user={user}
          permissionFlag={permissionFlag}
          onSubmit={onSubmit}
          onValidChange={setIsFormValid}
        />

        <footer className="client-modal__footer">
          <button
            type="submit"
            form="user-form"
            className="client-modal__cta"
            disabled={!isReady || saving}
            style={isReady && !saving ? { backgroundColor: '#0C69FF' } : undefined}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="1.5" />
              <path d="M12 8V16M8 12H16" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span>{saving ? 'שומר...' : 'שמירה'}</span>
          </button>
        </footer>
      </section>
    </div>
  );
}
