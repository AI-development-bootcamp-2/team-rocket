// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import {
  archiveTask,
  createTask,
  listTasks,
  updateTask,
} from '../../../api/tasks.api';
import { listProjects } from '../../../api/projects.api';
import { useAuth } from '../../../contexts/AuthContext';
import { AdminShell } from '../../../components/layout/AdminShell';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Toast } from '../../../components/ui/Toast';
import { CloseTaskDialog } from './CloseTaskDialog';
import { TaskFilters } from './TaskFilters';
import { TaskFormDialog } from './TaskFormDialog';
import { TasksTable } from './TasksTable';

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

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {};
      if (projectFilter !== 'all') params.projectId = Number(projectFilter);
      if (statusFilter !== 'all') params.status = statusFilter;
      const [response, projectsRes] = await Promise.all([
        listTasks(params),
        listProjects({ isActive: true }),
      ]);
      setTasks(response.data ?? []);
      setProjects(projectsRes.data ?? []);
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
      const result = await updateTask(dialog.task.id, payload);
      const updated = result?.data;
      if (updated) {
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      }
      showToast('המשימה עודכנה בהצלחה');
      setDialog(null);
    } catch (error) {
      if (shouldShowLocalErrorToast(error)) {
        showToast('שגיאה בעדכון המשימה', 'error');
      }
      setDialogLoading(false);
      return;
    }
    setDialogLoading(false);
    void loadTasks();
  }

  async function handleArchive() {
    setDialogLoading(true);
    const taskId = dialog.task.id;
    try {
      await archiveTask(taskId);
      showToast('המשימה נסגרה בהצלחה');
      setTasks(prev => prev.filter(t => t.id !== taskId));
      setDialog(null);
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
      <section className="users-page">
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
      </section>

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


