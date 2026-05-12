import { startTransition, useCallback, useEffect, useState } from 'react';
import { getMonthStatus, listMonths, lockMonth, unlockMonth } from '../../../api/monthLocks.api.js';
import { AdminShell } from '../../../components/layout/AdminShell.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { Select } from '../../../components/ui/Select.jsx';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { Toast } from '../../../components/ui/Toast.jsx';
import { LockConfirmDialog } from './LockConfirmDialog.jsx';
import { MonthStatusBadge } from './MonthStatusBadge.jsx';
import { UnlockReasonDialog } from './UnlockReasonDialog.jsx';

const HEBREW_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function UnlockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 7V5a3 3 0 0 1 6 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function buildMonthGrid(lockRecords) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const lockMap = new Map(
    lockRecords.map((r) => [`${r.year}-${r.month ?? r.month_number}`, r])
  );
  const rows = [];
  for (let year = currentYear; year >= currentYear - 1; year--) {
    const maxMonth = year === currentYear ? currentMonth : 12;
    for (let month = maxMonth; month >= 1; month--) {
      const key = `${year}-${month}`;
      const record = lockMap.get(key);
      rows.push({
        year,
        month,
        is_locked: record?.is_locked ?? false,
        locked_by_name: record?.locked_by_name ?? null,
        locked_at: record?.locked_at ?? null,
      });
    }
  }
  return rows;
}

function formatDate(dateString) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function mapErrorMessage(error) {
  const status = error?.response?.status ?? error?.status;
  if (status === 401) return 'פג תוקף ההתחברות. צריך להיכנס שוב.';
  if (status === 403) return 'אין לך הרשאה לנהל נעילות חודש.';
  return 'אירעה שגיאה. נסה שוב.';
}

function createToast(message, tone = 'info') {
  return { id: `${Date.now()}-${Math.random()}`, message, tone };
}

export function MonthLockPage() {
  const [months, setMonths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [lockingMonth, setLockingMonth] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const loadMonths = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listMonths();
      const records = response.data ?? response ?? [];
      setMonths(buildMonthGrid(records));
    } catch (err) {
      setError(mapErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    startTransition(() => { void loadMonths(); });
  }, [loadMonths]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(id);
  }, [toast]);

  async function handleLockClick(year, month) {
    setLockingMonth({ year, month });
    try {
      const statusResponse = await getMonthStatus(year, month);
      const status = statusResponse.data ?? statusResponse;
      setDialog({ mode: 'lock', year, month, unapprovedWeekCount: status.unapproved_week_count ?? 0 });
    } catch (err) {
      setToast(createToast(mapErrorMessage(err), 'error'));
    } finally {
      setLockingMonth(null);
    }
  }

  async function handleLockConfirmed() {
    setDialogLoading(true);
    try {
      await lockMonth(dialog.year, dialog.month);
      setToast(createToast('החודש נעול', 'success'));
      setDialog(null);
      await loadMonths();
    } catch (err) {
      setToast(createToast(mapErrorMessage(err), 'error'));
    } finally {
      setDialogLoading(false);
    }
  }

  async function handleUnlockConfirmed(reason) {
    setDialogLoading(true);
    try {
      await unlockMonth(dialog.year, dialog.month, reason);
      setToast(createToast('החודש נפתח', 'success'));
      setDialog(null);
      await loadMonths();
    } catch (err) {
      setToast(createToast(mapErrorMessage(err), 'error'));
    } finally {
      setDialogLoading(false);
    }
  }

  return (
    <div className="app-page">
      <AdminShell
        title="נעילת חודש"
        subtitle="נעל חודשי דיווח לאחר אישורם כדי למנוע עריכה נוספת."
      >
        <section className="users-page">
          {toast ? (
            <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />
          ) : null}

          {loading ? (
            <div className="users-page__loading">
              <Spinner label="טוען חודשים..." />
            </div>
          ) : null}

          {!loading && error ? (
            <ErrorState title="טעינת החודשים נכשלה" description={error} onAction={loadMonths} />
          ) : null}

          {!loading && !error ? (
            <div className="users-page__desktop">
              <div className="user-filters" style={{ marginBottom: '16px' }}>
                <Select
                  label="שנה"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                >
                  {[...new Set(months.map((m) => m.year))].sort((a, b) => b - a).map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </Select>
              </div>
              <div className="users-table-card">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>חודש</th>
                      <th>סטטוס</th>
                      <th>בוצע על ידי</th>
                      <th>תאריך עדכון</th>
                      <th>פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.filter((m) => m.year === selectedYear).map((m) => {
                      const month = m.month ?? m.month_number;
                      const { year } = m;
                      const monthName = HEBREW_MONTHS[month - 1] ?? month;
                      const isRowLocking = lockingMonth?.year === year && lockingMonth?.month === month;

                      return (
                        <tr key={`${year}-${month}`}>
                          <td><strong>{monthName} {year}</strong></td>
                          <td>
                            <MonthStatusBadge isLocked={m.is_locked} />
                          </td>
                          <td>{m.locked_by_name ?? '—'}</td>
                          <td>{formatDate(m.locked_at)}</td>
                          <td>
                            <div className="user-row-actions">
                              {m.is_locked ? (
                                <button
                                  type="button"
                                  className="user-row-actions__button user-row-actions__button--success"
                                  onClick={() => setDialog({ mode: 'unlock', year, month })}
                                  disabled={dialogLoading}
                                  data-tooltip="פתח חודש"
                                  aria-label={`פתח את חודש ${monthName} ${year}`}
                                >
                                  <UnlockIcon />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="user-row-actions__button user-row-actions__button--danger"
                                  onClick={() => handleLockClick(year, month)}
                                  disabled={isRowLocking || dialogLoading}
                                  data-tooltip="נעל חודש"
                                  aria-label={`נעל את חודש ${monthName} ${year}`}
                                >
                                  {isRowLocking ? '...' : <LockIcon />}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>
      </AdminShell>

      {dialog?.mode === 'lock' ? (
        <LockConfirmDialog
          month={dialog.month}
          year={dialog.year}
          unapprovedWeekCount={dialog.unapprovedWeekCount}
          loading={dialogLoading}
          onClose={() => !dialogLoading && setDialog(null)}
          onConfirm={handleLockConfirmed}
        />
      ) : null}

      {dialog?.mode === 'unlock' ? (
        <UnlockReasonDialog
          month={dialog.month}
          year={dialog.year}
          loading={dialogLoading}
          onClose={() => !dialogLoading && setDialog(null)}
          onConfirm={handleUnlockConfirmed}
        />
      ) : null}
    </div>
  );
}
