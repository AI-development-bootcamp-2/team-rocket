import { useCallback, useEffect, useState } from 'react';
import {
  archiveTask,
  createTask,
  listTasks,
  updateTask,
} from '../../../api/tasks.api.js';
import { listProjects } from '../../../api/projects.api.js';
import { useAuth } from '../../../contexts/AuthContext';
import { AdminShell } from '../../../components/layout/AdminShell.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { Toast } from '../../../components/ui/Toast.jsx';
import { CloseTaskDialog } from './CloseTaskDialog.jsx';
import { TaskFilters } from './TaskFilters.jsx';
import { TaskFormDialog } from './TaskFormDialog.jsx';
import { TasksTable } from './TasksTable.jsx';

function createToast(message, tone = 'info') {
  return { id: `${Date.now()}-${Math.random()}`, message, tone };
}

function getStatus(error) {
  return error?.response?.status ?? error?.status;
}

function shouldShowLocalErrorToast(error) {
  const status = getStatus(error);
  return status == null || status < 500;
}

export function TaskListPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [projectFilter, setProjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialog, setDialog] = useState(null);
  const [dialogLoading, setDialogLoading] = useState(false);

  const showToast = (message, tone = 'success') => {
    setToast(createToast(message, tone));
  };

  useEffect(() => {
    listProjects({ isActive: true })
      .then((response) => {
        setProjects(response.data ?? []);
      })
      .catch(() => {});
  }, []);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {};
      if (projectFilter !== 'all') params.projectId = Number(projectFilter);
      if (statusFilter !== 'all') params.status = statusFilter;
      const response = await listTasks(params);
      setTasks(response.data ?? []);
    } catch (err) {
      const status = getStatus(err);
      if (status === 401) setError('פג תוקף ההתחברות. צריך להיכנס שוב.');
      else if (status === 403) setError('אין לך הרשאה לצפות במשימות.');
      else setError('אירעה שגיאה בזמן טעינת המשימות.');
    } finally {
      setLoading(false);
    }
  }, [projectFilter, statusFilter]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  async function handleCreate(payload) {
    setDialogLoading(true);
    try {
      await createTask(payload);
      showToast('המשימה נוצרה בהצלחה');
      setDialog(null);
      await loadTasks();
    } catch (error) {
      if (shouldShowLocalErrorToast(error)) {
        showToast('שגיאה ביצירת המשימה', 'error');
      }
    } finally {
      setDialogLoading(false);
    }
  }

  async function handleUpdate(payload) {
    setDialogLoading(true);
    try {
      const updatePayload = { ...payload };
      delete updatePayload.project_id;
      await updateTask(dialog.task.id, updatePayload);
      showToast('המשימה עודכנה בהצלחה');
      setDialog(null);
      await loadTasks();
    } catch (error) {
      if (shouldShowLocalErrorToast(error)) {
        showToast('שגיאה בעדכון המשימה', 'error');
      }
    } finally {
      setDialogLoading(false);
    }
  }

  async function handleArchive() {
    setDialogLoading(true);
    try {
      await archiveTask(dialog.task.id);
      showToast('המשימה נסגרה בהצלחה');
      setDialog(null);
      await loadTasks();
    } catch (error) {
      if (shouldShowLocalErrorToast(error)) {
        showToast('שגיאה בסגירת המשימה', 'error');
      }
    } finally {
      setDialogLoading(false);
    }
  }

  return (
    <AdminShell
      title="ניהול משימות"
      subtitle="צפייה, יצירה, עריכה וסגירה של משימות לפי פרויקט."
      actions={
        isAdmin ? (
          <Button onClick={() => setDialog({ type: 'form', mode: 'create', task: null })}>
             משימה חדשה
          </Button>
        ) : null
      }
    >
      <TaskFilters
        projectId={projectFilter}
        status={statusFilter}
        projects={projects}
        onProjectChange={setProjectFilter}
        onStatusChange={setStatusFilter}
      />

      {error ? (
        <ErrorState
          title="שגיאה בטעינה"
          description={error}
          actionLabel="נסה שוב"
          onAction={loadTasks}
        />
      ) : loading ? (
        <TasksTable tasks={[]} isAdmin={isAdmin} onEdit={() => {}} onArchive={() => {}} loading />
      ) : tasks.length === 0 ? (
        <EmptyState
          title="אין משימות עדיין"
          description={isAdmin ? 'צור את המשימה הראשונה לפרויקט קיים.' : 'אין משימות זמינות כרגע.'}
          actionLabel={isAdmin ? '+ משימה חדשה' : undefined}
          onAction={isAdmin ? () => setDialog({ type: 'form', mode: 'create', task: null }) : undefined}
        />
      ) : (
        <TasksTable
          tasks={tasks}
          isAdmin={isAdmin}
          onEdit={(task) => setDialog({ type: 'form', mode: 'edit', task })}
          onArchive={(task) => setDialog({ type: 'archive', task })}
          loading={false}
        />
      )}

      {dialog?.type === 'form' ? (
        <TaskFormDialog
          mode={dialog.mode}
          task={dialog.task}
          projects={projects}
          saving={dialogLoading}
          onClose={() => setDialog(null)}
          onSubmit={dialog.mode === 'create' ? handleCreate : handleUpdate}
        />
      ) : null}

      {dialog?.type === 'archive' ? (
        <CloseTaskDialog
          task={dialog.task}
          loading={dialogLoading}
          onClose={() => setDialog(null)}
          onConfirm={handleArchive}
        />
      ) : null}

      {toast ? (
        <Toast
          key={toast.id}
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast(null)}
        />
      ) : null}
    </AdminShell>
  );
}
