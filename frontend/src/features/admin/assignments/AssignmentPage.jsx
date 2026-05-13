import { useCallback, useEffect, useState } from 'react';
import {
  createAssignment,
  getMyPermissions,
  listAssignments,
  toggleAssignment,
} from '../../../api/assignments.api.js';
import { listProjects } from '../../../api/projects.api.js';
import { listTasks } from '../../../api/tasks.api.js';
import { listUsers } from '../../../api/users.api.js';
import { useAuth } from '../../../contexts/AuthContext';
import { AdminShell } from '../../../components/layout/AdminShell.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { Toast } from '../../../components/ui/Toast.jsx';
import { AssignmentFilters } from './AssignmentFilters.jsx';
import { AssignmentTable } from './AssignmentTable.jsx';
import { NewAssignmentModal } from './NewAssignmentModal.jsx';

function createToast(message, tone = 'info') {
  return { id: `${Date.now()}-${Math.random()}`, message, tone };
}

function getStatus(error) {
  return error?.response?.status ?? error?.status;
}

export function AssignmentPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [scopedProjectIds, setScopedProjectIds] = useState(null);
  const [canMutate, setCanMutate] = useState(isAdmin);
  const [scopeLoaded, setScopeLoaded] = useState(isAdmin);

  const [assignments, setAssignments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');

  const [toast, setToast] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editTaskId, setEditTaskId] = useState(null);
  const [saving, setSaving] = useState(false);

  const showToast = (message, tone = 'success') => setToast(createToast(message, tone));

  useEffect(() => {
    if (isAdmin) return;
    getMyPermissions()
      .then((res) => {
        const flag = (res.data ?? []).find((f) => f.flagName === 'canAssignProjectTasks');
        if (flag) {
          setScopedProjectIds(flag.scopedProjectIds);
          setCanMutate(true);
        }
        setScopeLoaded(true);
      })
      .catch(() => setScopeLoaded(true));
  }, [isAdmin]);

  useEffect(() => {
    const promises = [
      listProjects({ isActive: true }),
      listTasks({ status: 'open' }),
    ];
    if (isAdmin || canMutate) promises.push(listUsers({ isActive: 'active' }));

    Promise.all(promises)
      .then(([projectsRes, tasksRes, usersRes]) => {
        setProjects(projectsRes.data ?? []);
        setTasks(tasksRes.data ?? []);
        if (usersRes) setUsers(usersRes.data ?? []);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, scopeLoaded, canMutate]);

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

  async function handleToggle(id, isActive) {
    try {
      await toggleAssignment(id, isActive);
      showToast(isActive ? 'השיוך הופעל' : 'השיוך בוטל');
      await loadAssignments();
    } catch {
      showToast('שגיאה בעדכון השיוך', 'error');
    }
  }

  function handleEdit(taskId) {
    setEditTaskId(taskId);
    setShowModal(true);
  }

  function handleOpenCreate() {
    setEditTaskId(null);
    setShowModal(true);
  }

  async function handleCreate({ task_id, user_ids }) {
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
        canMutate ? (
          <Button onClick={handleOpenCreate}>
            יצירה
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ marginInlineStart: 6 }}
              aria-hidden="true"
            >
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Button>
        ) : null
      }
    >
      <AssignmentFilters
        search={search}
        onSearchChange={setSearch}
        isScopedUser={!isAdmin && canMutate}
      />

      {!loading && assignments.length === 0 ? (
        <EmptyState
          title="אין שיוכים"
          description="לא נמצאו שיוכים במערכת."
          actionLabel={canMutate ? 'יצירת שיוך חדש' : undefined}
          onAction={canMutate ? handleOpenCreate : undefined}
        />
      ) : (
        <AssignmentTable
          assignments={assignments}
          tasks={tasks}
          loading={loading}
          canMutate={canMutate}
          search={search}
          onToggle={handleToggle}
          onEdit={handleEdit}
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
