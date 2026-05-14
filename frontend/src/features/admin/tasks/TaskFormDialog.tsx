// @ts-nocheck
import { useState } from 'react';
import { TaskForm } from './TaskForm';

export function TaskFormDialog({ mode, task, projects, onClose, onSubmit, saving }) {
  const isEdit = mode === 'edit';
  const title = isEdit ? 'עריכת משימה' : 'יצירת משימה';
  const subtitle = isEdit
    ? 'עדכון פרטי המשימה במערכת'
    : 'כאן תיצור את המשימה החדשה שתופיע במערכת';

  const [nameValue, setNameValue] = useState(task?.name ?? '');
  const isReady = nameValue.trim().length > 0;

  return (
    <div className="ui-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="client-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ height: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
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

        <header className="client-modal__header">
          <div className="client-modal__header-group">
            <div className="client-modal__icon" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="13.33" stroke="white" strokeWidth="2" />
                <path d="M16 10.67V21.33M10.67 16H21.33" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="client-modal__header-text">
              <h2 className="client-modal__title">{title}</h2>
              <p className="client-modal__subtitle">{subtitle}</p>
            </div>
          </div>
          {isEdit && <span className="client-modal__edit-badge">עריכה</span>}
        </header>

        <TaskForm
          key={task?.id ?? 'new'}
          id="task-form"
          initialValues={task}
          projects={projects}
          mode={mode}
          onSubmit={onSubmit}
          onNameChange={setNameValue}
        />

        <footer className="client-modal__footer">
          <button
            type="submit"
            form="task-form"
            className="client-modal__cta"
            disabled={!isReady || saving}
            style={isReady ? { backgroundColor: '#0C69FF', pointerEvents: saving ? 'none' : undefined } : { pointerEvents: 'none' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="1.5"/>
              <path d="M12 8V16M8 12H16" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span>{saving ? 'שומר...' : 'שמירה'}</span>
          </button>
        </footer>
      </section>
    </div>
  );
}


