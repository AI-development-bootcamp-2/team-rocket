import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createAssignment,
  getMyPermissions,
  listAssignments,
} from '../../../api/assignments.api';
import { listClients, updateClient, archiveClient } from '../../../api/clients.api';
import { listProjects, updateProject, archiveProject } from '../../../api/projects.api';
import { listTasks, updateTask, archiveTask } from '../../../api/tasks.api';
import { listUsers } from '../../../api/users.api';
import { useAuth } from '../../../contexts/AuthContext';
import { AdminShell } from '../../../components/layout/AdminShell';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Toast } from '../../../components/ui/Toast';
import { ArchiveClientDialog } from '../clients/ArchiveClientDialog';
import { ClientFormDialog } from '../clients/ClientFormDialog';
import { ArchiveProjectDialog } from '../projects/ArchiveProjectDialog';
import { ProjectFormDialog } from '../projects/ProjectFormDialog';
import { CloseTaskDialog } from '../tasks/CloseTaskDialog';
import { TaskFormDialog } from '../tasks/TaskFormDialog';
import { AssignmentFilters } from './AssignmentFilters';
import { AssignmentTable } from './AssignmentTable';
import { NewAssignmentModal } from './NewAssignmentModal';

function createToast(message: string, tone = 'info') {
  return { id: `${Date.now()}-${Math.random()}`, message, tone };
}

function getStatus(error: unknown) {
  return (error as any)?.response?.status ?? (error as any)?.status;
}

export function AssignmentPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [scopedProjectIds, setScopedProjectIds] = useState<number[] | null>(null);
  const [canMutate, setCanMutate] = useState(isAdmin);
  const [scopeLoaded, setScopeLoaded] = useState(isAdmin);

  const [assignments, setAssignments] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');

  const [toast, setToast] = useState<{ id: string; message: string; tone: string } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editTaskId, setEditTaskId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<{ type: string; entity: any } | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);

  const showToast = (message: string, tone = 'success') => setToast(createToast(message, tone));

  useEffect(() => {
    if (isAdmin) return;
    getMyPermissions()
      .then((res: any) => {
        const flag = (res.data ?? []).find((f: any) => f.flagName === 'canAssignProjectTasks');
        if (flag) {
          setScopedProjectIds(flag.scopedProjectIds);
          setCanMutate(true);
        }
        setScopeLoaded(true);
      })
      .catch(() => setScopeLoaded(true));
  }, [isAdmin]);

  const loadMeta = useCallback(async () => {
    const promises: Promise<any>[] = [
      listProjects({ isActive: true }),
      listTasks({ status: 'open' }),
      listClients({}),
    ];
    if (isAdmin || canMutate) promises.push(listUsers({ isActive: 'active' }));
    const [projectsRes, tasksRes, clientsRes, usersRes] = await Promise.all(promises);
    const activeProjects = projectsRes.data ?? [];
    const activeProjectIds = new Set(activeProjects.map((p: any) => p.id));
    setProjects(activeProjects);
    setTasks((tasksRes.data ?? []).filter((t: any) => activeProjectIds.has(t.projectId)));
    setClients(clientsRes.data ?? []);
    if (usersRes) setUsers(usersRes.data ?? []);
  }, [isAdmin, canMutate]);

  useEffect(() => {
    if (scopeLoaded) void loadMeta().catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeLoaded]);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listAssignments({});
      setAssignments(res.data ?? []);
    } catch (err) {
      const status = getStatus(err);
      if (status === 403) setError('אין לך הרשאה לצפות בשיוכים.');
      else setError('אירעה שגיאה בטעינת השיוכים.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (scopeLoaded) void loadAssignments();
  }, [loadAssignments, scopeLoaded]);

  function handleEdit(taskId: number) {
    setEditTaskId(taskId);
    setShowModal(true);
  }

  function handleOpenCreate() {
    setEditTaskId(null);
    setShowModal(true);
  }

  function getAncestors(taskId: number) {
    const task = tasks.find((t) => t.id === taskId);
    const project = task ? projects.find((p) => p.id === task.projectId) : null;
    const client = project ? clients.find((c) => c.id === project.clientId) : null;
    return { task, project, client };
  }

  function handleEditClient(taskId: number) {
    const { client } = getAncestors(taskId);
    if (client) setDialog({ type: 'edit-client', entity: client });
    else showToast('לא ניתן למצוא את הלקוח', 'error');
  }

  function handleEditProject(taskId: number) {
    const { project } = getAncestors(taskId);
    if (project) setDialog({ type: 'edit-project', entity: project });
    else showToast('לא ניתן למצוא את הפרויקט', 'error');
  }

  function handleEditTask(taskId: number) {
    const task = tasks.find((t) => t.id === taskId);
    if (task) setDialog({ type: 'edit-task', entity: task });
    else showToast('לא ניתן למצוא את המשימה', 'error');
  }

  function handleArchiveClient(taskId: number) {
    const { client } = getAncestors(taskId);
    if (client) setDialog({ type: 'archive-client', entity: client });
    else showToast('לא ניתן למצוא את הלקוח', 'error');
  }

  function handleArchiveProject(taskId: number) {
    const { project } = getAncestors(taskId);
    if (project) setDialog({ type: 'archive-project', entity: project });
    else showToast('לא ניתן למצוא את הפרויקט', 'error');
  }

  function handleArchiveTask(taskId: number) {
    const task = tasks.find((t) => t.id === taskId);
    if (task) setDialog({ type: 'close-task', entity: task });
    else showToast('לא ניתן למצוא את המשימה', 'error');
  }

  async function handleSaveClient(form: any) {
    setDialogLoading(true);
    try {
      await updateClient(dialog!.entity.id, form);
    } catch {
      showToast('שגיאה בעדכון הלקוח', 'error');
      setDialogLoading(false);
      return;
    }
    showToast('פרטי הלקוח עודכנו בהצלחה');
    setDialog(null);
    setDialogLoading(false);
    await loadMeta().catch(() => {});
  }

  async function handleSaveProject(form: any) {
    setDialogLoading(true);
    try {
      await updateProject(dialog!.entity.id, form);
    } catch {
      showToast('שגיאה בעדכון הפרויקט', 'error');
      setDialogLoading(false);
      return;
    }
    showToast('פרטי הפרויקט עודכנו בהצלחה');
    setDialog(null);
    setDialogLoading(false);
    await loadMeta().catch(() => {});
  }

  async function handleSaveTask(form: any) {
    setDialogLoading(true);
    try {
      await updateTask(dialog!.entity.id, form);
    } catch {
      showToast('שגיאה בעדכון המשימה', 'error');
      setDialogLoading(false);
      return;
    }
    showToast('פרטי המשימה עודכנו בהצלחה');
    setDialog(null);
    setDialogLoading(false);
    await loadMeta().catch(() => {});
    await loadAssignments();
  }

  async function handleConfirmArchiveClient() {
    setDialogLoading(true);
    const id = dialog!.entity.id;
    try {
      await archiveClient(id);
    } catch {
      showToast('שגיאה בהעברת הלקוח לארכיון', 'error');
      setDialogLoading(false);
      return;
    }
    setClients((prev) => prev.filter((c) => c.id !== id));
    setProjects((prev) => prev.filter((p) => p.clientId !== id));
    setTasks((prev) => prev.filter((t) => t.clientId !== id));
    showToast('הלקוח הועבר לארכיון בהצלחה');
    setDialog(null);
    setDialogLoading(false);
    await loadMeta().catch(() => {});
    await loadAssignments();
  }

  async function handleConfirmArchiveProject() {
    setDialogLoading(true);
    const id = dialog!.entity.id;
    try {
      await archiveProject(id);
    } catch {
      showToast('שגיאה בהעברת הפרויקט לארכיון', 'error');
      setDialogLoading(false);
      return;
    }
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setTasks((prev) => prev.filter((t) => t.projectId !== id));
    showToast('הפרויקט הועבר לארכיון בהצלחה');
    setDialog(null);
    setDialogLoading(false);
    await loadMeta().catch(() => {});
    await loadAssignments();
  }

  async function handleConfirmCloseTask() {
    setDialogLoading(true);
    const id = dialog!.entity.id;
    try {
      await archiveTask(id);
    } catch {
      showToast('שגיאה בסגירת המשימה', 'error');
      setDialogLoading(false);
      return;
    }
    setTasks((prev) => prev.filter((t) => t.id !== id));
    showToast('המשימה נסגרה בהצלחה');
    setDialog(null);
    setDialogLoading(false);
    await loadMeta().catch(() => {});
    await loadAssignments();
  }

  async function handleCreate({ task_id, user_ids }: { task_id: number; user_ids: number[] }) {
    setSaving(true);
    try {
      await Promise.all(user_ids.map((uid) => createAssignment({ task_id, user_id: uid })));
      showToast(user_ids.length > 1 ? `${user_ids.length} שיוכים נוצרו בהצלחה` : 'השיוך נוצר בהצלחה');
      setShowModal(false);
      await loadAssignments();
    } catch (err) {
      const status = getStatus(err);
      if (status === 409) showToast('שיוך כבר קיים עבור עובד ומשימה אלו', 'error');
      else if (status === 403) showToast('אין הרשאה ליצור שיוך זה', 'error');
      else showToast('שגיאה ביצירת השיוך', 'error');
    } finally {
      setSaving(false);
    }
  }

  const visibleAssignments = useMemo(
    () => assignments.filter((a) => a.task?.status === 'open'),
    [assignments],
  );

  if (error && !loading) {
    return (
      <AdminShell title="שיוך עובד למשימה" subtitle="כאן תוכל לשייך עובדים למשימות מתוך פרויקטים שונים של לקוחות.">
        <ErrorState
          title="שגיאה בטעינה"
          description={error}
          actionLabel="נסה שוב"
          onAction={loadAssignments}
        />
      </AdminShell>
    );
  }

  if (scopeLoaded && !isAdmin && !canMutate && !loading) {
    return (
      <AdminShell title="שיוך עובד למשימה" subtitle="">
        <ErrorState
          title="אין הרשאה"
          description="עמוד זה זמין למנהלים ולמשתמשים עם הרשאת שיוך בלבד."
          actionLabel="חזרה לדף הבית"
          onAction={() => window.location.assign('/')}
        />
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="שיוך עובד למשימה"
      subtitle="כאן תוכל לשייך עובדים למשימות מתוך פרויקטים שונים של לקוחות."
      actions={
        <div className="assignment-header-actions">
          <AssignmentFilters
            search={search}
            onSearchChange={setSearch}
            isScopedUser={!isAdmin && canMutate}
          />
          {canMutate && (
            <Button onClick={handleOpenCreate} style={{ width: 144 }}>יצירה</Button>
          )}
        </div>
      }
    >
      {!loading && visibleAssignments.length === 0 ? (
        <EmptyState
          title="אין שיוכים"
          description="לא נמצאו שיוכים במערכת."
          actionLabel={canMutate ? 'יצירת שיוך חדש' : undefined}
          onAction={canMutate ? handleOpenCreate : undefined}
        />
      ) : (
        <AssignmentTable
          assignments={visibleAssignments}
          tasks={tasks}
          loading={loading}
          canMutate={canMutate}
          search={search}
          onEditClient={handleEditClient}
          onEditProject={handleEditProject}
          onEditTask={handleEditTask}
          onEditAssignment={handleEdit}
          onArchiveClient={handleArchiveClient}
          onArchiveProject={handleArchiveProject}
          onArchiveTask={handleArchiveTask}
        />
      )}

      {showModal ? (
        <NewAssignmentModal
          projects={projects}
          tasks={tasks}
          users={users}
          saving={saving}
          isScopedUser={!isAdmin && canMutate}
          scopedProjectIds={scopedProjectIds}
          defaultTaskId={editTaskId}
          onClose={() => { setShowModal(false); setEditTaskId(null); }}
          onSubmit={handleCreate}
        />
      ) : null}

      {dialog?.type === 'edit-client' && (
        <ClientFormDialog
          mode="edit"
          client={dialog.entity}
          saving={dialogLoading}
          onClose={() => !dialogLoading && setDialog(null)}
          onSubmit={handleSaveClient}
        />
      )}

      {dialog?.type === 'edit-project' && (
        <ProjectFormDialog
          mode="edit"
          project={dialog.entity}
          clients={clients}
          users={users}
          saving={dialogLoading}
          onClose={() => !dialogLoading && setDialog(null)}
          onSubmit={handleSaveProject}
        />
      )}

      {dialog?.type === 'edit-task' && (
        <TaskFormDialog
          mode="edit"
          task={dialog.entity}
          projects={projects}
          saving={dialogLoading}
          onClose={() => !dialogLoading && setDialog(null)}
          onSubmit={handleSaveTask}
        />
      )}

      {dialog?.type === 'archive-client' && (
        <ArchiveClientDialog
          client={dialog.entity}
          loading={dialogLoading}
          onClose={() => !dialogLoading && setDialog(null)}
          onConfirm={handleConfirmArchiveClient}
        />
      )}

      {dialog?.type === 'archive-project' && (
        <ArchiveProjectDialog
          project={dialog.entity}
          loading={dialogLoading}
          onClose={() => !dialogLoading && setDialog(null)}
          onConfirm={handleConfirmArchiveProject}
        />
      )}

      {dialog?.type === 'close-task' && (
        <CloseTaskDialog
          task={dialog.entity}
          loading={dialogLoading}
          onClose={() => !dialogLoading && setDialog(null)}
          onConfirm={handleConfirmCloseTask}
        />
      )}

      {toast ? (
        <Toast
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast(null)}
        />
      ) : null}
    </AdminShell>
  );
}
