// @ts-nocheck
import { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { ProjectForm } from './ProjectForm';

function ProjectIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="13.33" stroke="white" strokeWidth="2" />
      <path d="M16 10.67V21.33M10.67 16H21.33" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function ProjectFormDialog({ mode, project, clients, users, onClose, onSubmit, saving }) {
  const isEdit = mode === 'edit';
  const [hasValues, setHasValues] = useState(
    isEdit ? Boolean(project?.name && project?.clientId) : false
  );

  const icon = (
    <div style={{ width: 48, height: 48, borderRadius: 8, background: '#0C69FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} aria-hidden="true">
      <ProjectIcon />
    </div>
  );

  const buttonLabel = saving ? 'שומר...' : hasValues ? 'שמור' : isEdit ? 'שמירה' : 'צור פרויקט';

  return (
    <Modal
      title={isEdit ? 'עריכת פרויקט' : 'יצירת פרויקט'}
      subtitle={isEdit ? undefined : 'כאן תיצור את הפרויקט החדש שיופיע במערכת'}
      icon={icon}
      className="project-form-modal"
      onClose={onClose}
      footer={
        <button
          type="submit"
          form="project-form"
          className={`client-modal__cta project-form-modal__cta${hasValues ? ' project-form-modal__cta--active' : ''}`}
          disabled={!hasValues || saving}
        >
          <span className="client-modal__cta-icon" aria-hidden="true">＋</span>
          <span>{buttonLabel}</span>
        </button>
      }
    >
      <ProjectForm
        key={project?.id ?? 'new'}
        id="project-form"
        initialValues={project}
        clients={clients}
        users={users}
        onSubmit={onSubmit}
        onValuesChange={setHasValues}
      />
    </Modal>
  );
}


