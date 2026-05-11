import { useCallback, useEffect, useState } from 'react';
import { startTransition } from 'react';
import { archiveClient, createClient, listClients, updateClient } from '../../../api/clients.api.js';
import { AdminShell } from '../../../components/layout/AdminShell.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { Toast } from '../../../components/ui/Toast.jsx';
import { ArchiveClientDialog } from './ArchiveClientDialog.jsx';
import { ClientFilters } from './ClientFilters.jsx';
import { ClientFormDialog } from './ClientFormDialog.jsx';
import { ClientsTable } from './ClientsTable.jsx';

const LOAD_ERROR_MESSAGE = 'אירעה שגיאה בזמן טעינת הלקוחות.';

function getStatus(error) {
  return error?.response?.status ?? error?.status;
}

function mapErrorMessage(error) {
  const status = getStatus(error);
  if (status === 401) return 'פג תוקף ההתחברות. צריך להיכנס שוב.';
  if (status === 403) return 'אין לך הרשאה לנהל לקוחות.';
  return LOAD_ERROR_MESSAGE;
}

function createToast(message, tone = 'info') {
  return { id: `${Date.now()}-${Math.random()}`, message, tone };
}

export function ClientListPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [status, setStatus] = useState('all');
  const [dialog, setDialog] = useState(null);
  const [dialogLoading, setDialogLoading] = useState(false);

  const isActiveParam = status === 'active' ? true : status === 'inactive' ? false : null;

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listClients({ isActive: isActiveParam });
      setClients(response.data ?? []);
    } catch (loadError) {
      setError(mapErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [isActiveParam]);

  useEffect(() => {
    startTransition(() => {
      void loadClients();
    });
  }, [loadClients]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(id);
  }, [toast]);

  async function handleSaveClient(form) {
    setDialogLoading(true);
    try {
      if (dialog.mode === 'create') {
        const result = await createClient(form);
        if (result?.warning) setToast(createToast(`הלקוח נוצר. ${result.warning}`, 'info'));
        else setToast(createToast('הלקוח נוצר בהצלחה.', 'success'));
      } else {
        await updateClient(dialog.client.id, form);
        setToast(createToast('פרטי הלקוח עודכנו בהצלחה.', 'success'));
      }
      setDialog(null);
      loadClients();
    } catch (saveError) {
      setToast(createToast(mapErrorMessage(saveError), 'error'));
    } finally {
      setDialogLoading(false);
    }
  }

  async function handleArchiveConfirmed() {
    setDialogLoading(true);
    try {
      const result = await archiveClient(dialog.client.id);
      setToast(createToast(
        result?.warning ? `הלקוח הועבר לארכיון. ${result.warning}` : 'הלקוח הועבר לארכיון בהצלחה.',
        result?.warning ? 'info' : 'success'
      ));
      setDialog(null);
      await loadClients();
    } catch (archiveError) {
      setToast(createToast(mapErrorMessage(archiveError), 'error'));
    } finally {
      setDialogLoading(false);
    }
  }

  return (
    <div className="app-page">
      <AdminShell
        title="ניהול לקוחות"
        subtitle="ניהול לקוחות פעילים ופרטי קשר."
        actions={
          <Button onClick={() => setDialog({ mode: 'create', client: null })}>יצירת לקוח</Button>
        }
      >
        <section className="users-page">
          <ClientFilters status={status} onStatusChange={setStatus} />

          {toast ? (
            <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />
          ) : null}

          {loading && clients.length === 0 ? (
            <div className="users-page__loading">
              <Spinner label="טוען לקוחות..." />
            </div>
          ) : null}

          {!loading && error ? (
            <ErrorState title="טעינת הלקוחות נכשלה" description={error} onAction={loadClients} />
          ) : null}

          {!loading && !error && clients.length === 0 ? (
            <EmptyState
              title="אין לקוחות עדיין"
              description="ניתן ליצור לקוח חדש."
              actionLabel="יצירת לקוח"
              onAction={() => setDialog({ mode: 'create', client: null })}
            />
          ) : !loading && !error && clients.length > 0 ? (
            <div className="users-page__desktop">
              <ClientsTable
                clients={clients}
                onEdit={(client) => setDialog({ mode: 'edit', client })}
                onArchive={(client) => setDialog({ mode: 'archive', client })}
                loading={loading}
              />
            </div>
          ) : null}
        </section>
      </AdminShell>

      {dialog?.mode === 'create' || dialog?.mode === 'edit' ? (
        <ClientFormDialog
          mode={dialog.mode}
          client={dialog.client}
          saving={dialogLoading}
          onClose={() => (dialogLoading ? null : setDialog(null))}
          onSubmit={handleSaveClient}
        />
      ) : null}

      {dialog?.mode === 'archive' ? (
        <ArchiveClientDialog
          client={dialog.client}
          loading={dialogLoading}
          onClose={() => !dialogLoading && setDialog(null)}
          onConfirm={handleArchiveConfirmed}
        />
      ) : null}
    </div>
  );
}
