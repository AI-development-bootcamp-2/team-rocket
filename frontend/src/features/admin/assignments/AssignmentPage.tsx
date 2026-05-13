// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import {
  createAssignment,
  getMyPermissions,
  listAssignments,
  toggleAssignment,
} from '../../../api/assignments.api';
import { listProjects } from '../../../api/projects.api';
import { listTasks } from '../../../api/tasks.api';
import { listUsers } from '../../../api/users.api';
import { useAuth } from '../../../contexts/AuthContext';
import { AdminShell } from '../../../components/layout/AdminShell';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Toast } from '../../../components/ui/Toast';
import { AssignmentFilters } from './AssignmentFilters';
import { AssignmentTable } from './AssignmentTable';
import { NewAssignmentModal } from './NewAssignmentModal';

function createToast(message, tone = 'info') {
  return { id: `${Date.now()}-${Math.random()}`, message, tone };
}

function getStatus(error) {
  return error?.response?.status ?? error?.status;
}

export function AssignmentPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Scope state — null = no restriction, array = allowed project IDs for user+flag
  const [scopedProjectIds, setScopedProjectIds] = useState(null);
  const [canMutate, setCanMutate] = useState(isAdmin);
  const [scopeLoaded, setScopeLoaded] = useState(isAdmin); // admins need no flag check

  // Data
  const [assignments, setAssignments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [projectFilter, setProjectFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');

  // UI
  const [toast, setToast] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const showToast = (message, tone = 'success') => setToast(createToast(message, tone));

  // ── Scope resolution (non-admin only) ──────────────────────────────────────
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

  // ── Static data (projects, tasks, users) ───────────────────────────────────
  useEffect(() => {
    const promises = [
      listProjects({ isActive: true }),
      listTasks({ status: 'open' }),
    ];
    // Load full user list for admin or any user with canAssignProjectTasks flag
    if (isAdmin || canMutate) promises.push(listUsers({ isActive: 'active' }));

    Promise.all(promises)
      .then(([projectsRes, tasksRes, usersRes]) => {
        // Do NOT filter projects — the matrix shows all projects with out-of-scope
        // ones greyed. The modal dropdown restricts via the scopedProjectIds prop.
        setProjects(projectsRes.data ?? []);
        setTasks(tasksRes.data ?? []);
        if (usersRes) setUsers(usersRes.data ?? []);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, scopeLoaded, canMutate]);

  // ── Assignments list ────────────────────────────────────────────────────────
  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (projectFilter !== 'all') params.projectId = Number(projectFilter);
      if (userFilter !== 'all') params.userId = Number(userFilter);
      const res = await listAssignments(params);
      setAssignments(res.data ?? []);
    } catch (err) {
      const status = getStatus(err);
      if (status === 403) setError('אין לך הרשאה לצפות בשיוכים.');
      else setError('אירעה שגיאה בטעינת השיוכים.');
    } finally {
      setLoading(false);
    }
  }, [projectFilter, userFilter]);

  useEffect(() => {
    if (scopeLoaded) void loadAssignments();
  }, [loadAssignments, scopeLoaded]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  async function handleToggle(id, isActive) {
    try {
      await toggleAssignment(id, isActive);
      showToast(isActive ? 'השיוך הופעל' : 'השיוך בוטל');
      await loadAssignments();
    } catch {
      showToast('שגיאה בעדכון השיוך', 'error');
    }
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

  // ── Render ──────────────────────────────────────────────────────────────────
  if (error && !loading) {
    return (
      <AdminShell title="שיוך עובדים למשימות" subtitle="ניהול שיוכי עובדים לפי פרויקט ומשימה.">
        <ErrorState
          title="שגיאה בטעינה"
          description={error}
          actionLabel="נסה שוב"
          onAction={loadAssignments}
        />
      </AdminShell>
    );
  }

  // Non-admin without canAssignProjectTasks flag has no access to this page
  if (scopeLoaded && !isAdmin && !canMutate && !loading) {
    return (
      <AdminShell title="שיוך עובדים למשימות" subtitle="">
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
      title="שיוך עובדים למשימות"
      subtitle="ניהול שיוכי עובדים לפי פרויקט ומשימה."
      actions={
        canMutate ? (
          <Button onClick={() => setShowModal(true)}>+ שיוך עובד חדש</Button>
        ) : null
      }
    >
      <AssignmentFilters
        projects={projects}
        projectId={projectFilter}
        users={users}
        userId={userFilter}
        isAdmin={isAdmin}
        isScopedUser={!isAdmin && canMutate}
        onProjectChange={setProjectFilter}
        onUserChange={setUserFilter}
      />

      {!loading && assignments.length === 0 ? (
        <EmptyState
          title="אין שיוכים"
          description="לא נמצאו שיוכים תואמים לסינון הנוכחי."
          actionLabel={canMutate ? '+ שיוך עובד חדש' : undefined}
          onAction={canMutate ? () => setShowModal(true) : undefined}
        />
      ) : (
        <AssignmentTable
          assignments={assignments}
          users={users}
          tasks={tasks}
          loading={loading}
          canMutate={canMutate}
          scopedProjectIds={scopedProjectIds}
          onToggle={handleToggle}
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
          onClose={() => setShowModal(false)}
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


