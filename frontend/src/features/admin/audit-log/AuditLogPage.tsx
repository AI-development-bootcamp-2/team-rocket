import { useCallback, useEffect, useState } from 'react';
import { listAuditLogs, type AuditLogEntry, type AuditLogsFilters } from '../../../api/audit-logs.api';
import { listUsers } from '../../../api/users.api.js';
import { AdminShell } from '../../../components/layout/AdminShell.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { Toast } from '../../../components/ui/Toast.jsx';
import { AuditLogFilters } from './AuditLogFilters';
import { AuditLogTable } from './AuditLogTable';

const PAGE_SIZE = 25;

interface ToastState {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'error';
}

interface User {
  id: number;
  firstName: string;
  lastName: string;
}

const EMPTY_FILTERS: AuditLogsFilters = {
  entity_type: '',
  user_id: '',
  action: '',
  date_from: '',
  date_to: '',
};

function createToast(message: string, tone: ToastState['tone'] = 'info'): ToastState {
  return { id: `${Date.now()}-${Math.random()}`, message, tone };
}

function getErrorMessage(error: unknown): string {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 401) return 'פג תוקף ההתחברות. צריך להיכנס שוב.';
  if (status === 403) return 'אין לך הרשאה לצפות ביומן הביקורת.';
  return 'אירעה שגיאה בטעינת יומן הביקורת.';
}

export function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [pendingFilters, setPendingFilters] = useState<AuditLogsFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<AuditLogsFilters>(EMPTY_FILTERS);

  useEffect(() => {
    listUsers({}).then((res: { data?: User[] }) => {
      setUsers(res.data ?? []);
    }).catch(() => {
      // non-critical — filter dropdown stays empty
    });
  }, []);

  const loadEntries = useCallback(async (filters: AuditLogsFilters, currentPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAuditLogs({ ...filters, page: currentPage, limit: PAGE_SIZE });
      setEntries(result.data);
      setTotal(result.total);
    } catch (err) {
      setError(getErrorMessage(err));
      setToast(createToast(getErrorMessage(err), 'error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEntries(appliedFilters, page);
  }, [appliedFilters, page, loadEntries]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(id);
  }, [toast]);

  function handleSearch() {
    setPage(1);
    setAppliedFilters(pendingFilters);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="app-page">
      <AdminShell
        title="יומן ביקורת"
        subtitle="מעקב אחר כל הפעולות שבוצעו במערכת."
      >
        <section className="audit-page">
          <AuditLogFilters
            filters={pendingFilters}
            users={users}
            onFiltersChange={setPendingFilters}
            onSearch={handleSearch}
          />

          {toast ? (
            <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />
          ) : null}

          {loading && entries.length === 0 ? (
            <div className="audit-page__loading">
              <Spinner label="טוען יומן ביקורת..." />
            </div>
          ) : null}

          {!loading && error && entries.length === 0 ? (
            <ErrorState
              title="טעינה נכשלה"
              description={error}
              onAction={() => void loadEntries(appliedFilters, page)}
            />
          ) : null}

          {!loading && !error && entries.length === 0 ? (
            <EmptyState
              title="לא נמצאו אירועים"
              description="לא נמצאו רשומות ביקורת התואמות את המסננים שנבחרו."
            />
          ) : null}

          {entries.length > 0 || loading ? (
            <AuditLogTable entries={entries} users={users} loading={loading} />
          ) : null}

          {!loading && totalPages > 1 ? (
            <div className="audit-pagination">
              <button
                type="button"
                className="audit-pagination__btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                הקודם
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`audit-pagination__btn${p === page ? ' audit-pagination__btn--active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}

              <button
                type="button"
                className="audit-pagination__btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                הבא
              </button>
            </div>
          ) : null}
        </section>
      </AdminShell>
    </div>
  );
}
