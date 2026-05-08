import { Modal } from '../../../components/ui/Modal.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { TaskForm } from './TaskForm.jsx';

export function TaskFormDialog({ mode, task, projects, onClose, onSubmit, saving }) {
  const isEdit = mode === 'edit';

  return (
    <Modal
      title={isEdit ? 'עריכת משימה' : 'יצירת משימה'}
      icon="T"
      onClose={onClose}
      footer={(
        <Button type="submit" form="task-form" disabled={saving}>
          {saving ? 'שומר...' : isEdit ? 'שמירה' : 'צור משימה'}
        </Button>
      )}
    >
      <TaskForm
        key={task?.id ?? 'new'}
        id="task-form"
        initialValues={task}
        projects={projects}
        mode={mode}
        onSubmit={onSubmit}
      />
    </Modal>
  );
}
