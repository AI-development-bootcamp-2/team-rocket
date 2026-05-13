// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import {
  archiveProject,
  createProject,
  listProjects,
  updateProject,
} from '../../../api/projects.api';
import { listClients } from '../../../api/clients.api';
import { listUsers } from '../../../api/users.api';
import { useAuth } from '../../../contexts/AuthContext';
import { AdminShell } from '../../../components/layout/AdminShell';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Toast } from '../../../components/ui/Toast';
import { ArchiveProjectDialog } from './ArchiveProjectDialog';
import { ProjectFilters } from './ProjectFilters';
import { ProjectFormDialog } from './ProjectFormDialog';
import { ProjectsTable } from './ProjectsTable';

function createToast(message, tone = 'info') {
  return { id: `${Date.now()}-${Math.random()}`, message, tone };
}

function getStatus(error) {
  return error?.response?.status ?? error?.status;
}

export function ProjectListPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const [clientFilter, setClientFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [dialog, setDialog] = useState(null);
  const [dialogLoading, setDialogLoading] = useState(false);

  const showToast = (message, tone = 'success') =>
    setToast(createToast(message, tone));

  // Load meta (clients + users) once for dropdowns — fetched independently
  // so a failure of one does not prevent the other from populating.
  useEffect(() => {
    listClients({})
      .then((res) => setClients(res.data ?? []))
      .catch(() => {});
    listUsers({})
      .then((res) => setUsers(res.data ?? []))
      .catch(() => {});
  }, []);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (clientFilter !== 'all') params.clientId = Number(clientFilter);
      if (statusFilter !== 'all') params.isActive = statusFilter === 'active';
      const res = await listProjects(params);
      // Enrich with client name for display
      const clientMap = {};
      clients.forEach((c) => { clientMap[c.id] = c.name; });
      const userMap = {};
      users.forEach((u) => { userMap[u.id] = `${u.firstName} ${u.lastName}`; });
      setProjects(
        (res.data ?? []).map((p) => ({
          ...p,
          clientName: clientMap[p.clientId] ?? null,
          managerName: p.managerUserId ? userMap[p.managerUserId] ?? null : null,
        })),
      );
    } catch (err) {
      const status = getStatus(err);
      if (status === 401) setError('פג תוקף ההתחברות. צריך להיכנס שוב.');
      else if (status === 403) setError('אין לך הרשאה לצפות בפרויקטים.');
      else setError('אירעה שגיאה בזמן טעינת הפרויקטים.');
    } finally {
      setLoading(false);
    }
  }, [clientFilter, statusFilter, clients, users]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  // ── Create ──────────────────────────────────────────────────────────────────
  async function handleCreate(payload) {
    setDialogLoading(true);
    try {
      const res = await createProject(payload);
      if (res.warning) showToast(`הפרויקט נוצר. ${res.warning}`, 'info');
      else showToast('הפרויקט נוצר בהצלחה');
      setDialog(null);
      loadProjects();
    } catch {
      showToast('שגיאה ביצירת הפרויקט', 'error');
    } finally {
      setDialogLoading(false);
    }
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  async function handleUpdate(payload) {
    setDialogLoading(true);
    try {
      const res = await updateProject(dialog.project.id, payload);
      if (res.warning) showToast(`הפרויקט עודכן. ${res.warning}`, 'info');
      else showToast('הפרויקט עודכן בהצלחה');
      setDialog(null);
      loadProjects();
    } catch {
      showToast('שגיאה בעדכון הפרויקט', 'error');
    } finally {
      setDialogLoading(false);
    }
  }

  // ── Archive ─────────────────────────────────────────────────────────────────
  async function handleArchive() {
    setDialogLoading(true);
    try {
      const res = await archiveProject(dialog.project.id);
      if (res.warning) showToast(res.warning, 'info');
      else showToast('הפרויקט הועבר לארכיון');
      setDialog(null);
      loadProjects();
    } catch {
      showToast( 'שגיאה בהעברת הפרויקט לארכיון', 'error');
    } finally {
      setDialogLoading(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <AdminShell
      title="ניהול פרויקטים"
      subtitle="צפייה, יצירה ועריכה של פרויקטים"
      actions={
        isAdmin && (
          <Button onClick={() => setDialog({ type: 'form', mode: 'create', project: null })}>
            פרויקט חדש
          </Button>
        )
      }
    >
      <section className="users-page">
      <ProjectFilters
        clientId={clientFilter}
        status={statusFilter}
        clients={clients}
        onClientChange={setClientFilter}
        onStatusChange={setStatusFilter}
      />

      {error ? (
        <ErrorState
          title="שגיאה בטעינה"
          description={error}
          actionLabel="נסה שוב"
          onAction={loadProjects}
        />
      ) : loading ? (
        <ProjectsTable projects={[]} isAdmin={isAdmin} onEdit={() => {}} onArchive={() => {}} loading />
      ) : projects.length === 0 ? (
        <EmptyState
          title="אין פרויקטים עדיין"
          description={isAdmin ? 'צור את הפרויקט הראשון.' : 'אין פרויקטים זמינים.'}
          actionLabel={isAdmin ? ' פרויקט חדש' : undefined}
          onAction={isAdmin ? () => setDialog({ type: 'form', mode: 'create', project: null }) : undefined}
        />
      ) : (
        <ProjectsTable
          projects={projects}
          isAdmin={isAdmin}
          onEdit={(p) => setDialog({ type: 'form', mode: 'edit', project: p })}
          onArchive={(p) => setDialog({ type: 'archive', project: p })}
          loading={false}
        />
      )}

      {dialog?.type === 'form' && (
        <ProjectFormDialog
          mode={dialog.mode}
          project={dialog.project}
          clients={clients}
          users={users}
          saving={dialogLoading}
          onClose={() => setDialog(null)}
          onSubmit={dialog.mode === 'create' ? handleCreate : handleUpdate}
        />
      )}

      {dialog?.type === 'archive' && (
        <ArchiveProjectDialog
          project={dialog.project}
          loading={dialogLoading}
          onClose={() => setDialog(null)}
          onConfirm={handleArchive}
        />
      )}

      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast(null)}
        />
      )}
      </section>
    </AdminShell>
  );
}


