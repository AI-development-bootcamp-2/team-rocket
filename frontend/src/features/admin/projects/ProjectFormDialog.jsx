import { Modal } from '../../../components/ui/Modal.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { ProjectForm } from './ProjectForm.jsx';

export function ProjectFormDialog({ mode, project, clients, users, onClose, onSubmit, saving }) {
  const isEdit = mode === 'edit';

  return (
    <Modal
      title={isEdit ? 'עריכת פרויקט' : 'יצירת פרויקט'}
      icon="P"
      onClose={onClose}
      footer={
        <Button type="submit" form="project-form" disabled={saving}>
          {saving ? 'שומר...' : isEdit ? 'שמירה' : 'צור פרויקט'}
        </Button>
      }
    >
      <ProjectForm
        key={project?.id ?? 'new'}
        id="project-form"
        initialValues={project}
        clients={clients}
        users={users}
        onSubmit={onSubmit}
      />
    </Modal>
  );
}
