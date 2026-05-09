import { useState } from 'react';
import { Modal } from '../../../components/ui/Modal.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Select } from '../../../components/ui/Select.jsx';

/**
 * NewAssignmentModal
 *
 * Allows admin or user+flag to create a new assignment.
 * Cascade flow: project → task → user.
 *
 * props:
 *   projects         – selectable projects (already scoped for non-admin)
 *   tasks            – all open tasks (filtered in-component by selected project)
 *   users            – all active users (admin) or just current user (non-admin without full list)
 *   saving           – loading state
 *   isScopedUser     – caller has canAssignProjectTasks flag (show scope hint)
 *   onClose()
 *   onSubmit({ user_id, task_id })
 */
export function NewAssignmentModal({
  projects,
  tasks,
  users,
  saving,
  isScopedUser,
  onClose,
  onSubmit,
}) {
  const [projectId, setProjectId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [userId, setUserId] = useState('');

  const filteredTasks = tasks.filter(
    (t) => projectId !== '' && String(t.projectId) === projectId && t.status === 'open',
  );

  const selectedTask = tasks.find((t) => String(t.id) === taskId);
  const breadcrumb = selectedTask
    ? `${selectedTask.clientName} ← ${selectedTask.projectName} ← ${selectedTask.name}`
    : null;

  function handleSubmit(e) {
    e.preventDefault();
    if (!taskId || !userId) return;
    onSubmit({ task_id: Number(taskId), user_id: Number(userId) });
  }

  const canSubmit = taskId !== '' && userId !== '' && !saving;

  return (
    <Modal
      title="שיוך עובד חדש למשימה"
      icon="+"
      onClose={onClose}
      footer={
        <Button type="submit" form="new-assignment-form" disabled={!canSubmit}>
          {saving ? 'שומר...' : 'שייך עובד למשימה ⊕'}
        </Button>
      }
    >
      {isScopedUser ? (
        <p className="assignment-scope-hint">
          ⚠️ ניתן לשייך רק בתוך הפרויקטים המורשים לך
        </p>
      ) : null}

      {breadcrumb ? (
        <div className="assignment-breadcrumb" aria-label="הקשר">
          {breadcrumb}
        </div>
      ) : null}

      <form id="new-assignment-form" onSubmit={handleSubmit} className="task-form">
        <Select
          label="פרויקט"
          value={projectId}
          required
          onChange={(e) => {
            setProjectId(e.target.value);
            setTaskId('');
          }}
        >
          <option value="" disabled>
            בחר פרויקט
          </option>
          {projects.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.name}
            </option>
          ))}
        </Select>

        <Select
          label="משימה"
          value={taskId}
          required
          disabled={filteredTasks.length === 0}
          onChange={(e) => setTaskId(e.target.value)}
        >
          <option value="" disabled>
            {projectId === '' ? 'בחר פרויקט תחילה' : 'בחר משימה'}
          </option>
          {filteredTasks.map((t) => (
            <option key={t.id} value={String(t.id)}>
              {t.name}
            </option>
          ))}
        </Select>

        <Select
          label="עובד"
          value={userId}
          required
          onChange={(e) => setUserId(e.target.value)}
        >
          <option value="" disabled>
            בחר עובד
          </option>
          {users.map((u) => (
            <option key={u.id} value={String(u.id)}>
              {u.firstName} {u.lastName}
            </option>
          ))}
        </Select>
      </form>
    </Modal>
  );
}
