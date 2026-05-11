import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getDailySummary, getDropdownData, listTimeEntries } from '../../api/timeEntries.api';
import { AppHeader } from '../../components/AppHeader';
import { ExistingEntriesList } from './ExistingEntriesList';
import { ReportForm } from './ReportForm';
import styles from './DailyReportPage.module.css';

// Format date as YYYY-MM-DD in local time (no UTC shift)
function toLocalDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Hebrew day names (week starts Sunday)
const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// Hebrew month names
const HE_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

function formatHebrewDate(date) {
  return `${HE_DAYS[date.getDay()]}, ${date.getDate()} ב${HE_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function minutesToHours(minutes) {
  if (!minutes && minutes !== 0) return 0;
  return Math.round((minutes / 60) * 100) / 100;
}

function ProgressBar({ reported, standard }) {
  const pct = standard > 0 ? Math.min((reported / standard) * 100, 100) : 0;
  const isOver = reported > standard;
  const isFull = reported >= standard;

  let fillColor = 'var(--color-brand-orange, #F59E0B)';
  if (isFull) fillColor = 'var(--color-success, #16A34A)';
  if (isOver) fillColor = 'var(--color-danger, #EF4444)';

  return (
    <div className={styles.progressBar}>
      <div
        className={styles.progressFill}
        style={{ width: `${pct}%`, background: fillColor }}
        role="presentation"
      />
      {pct > 0 && pct < 100 && (
        <span
          className={styles.progressDot}
          style={{ left: `${pct}%`, background: fillColor }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export function DailyReportPage() {
  const { user, logout } = useAuth();

  const [selectedDate, setSelectedDate] = useState(() => toLocalDateString(new Date()));
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  const [entries, setEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  const [dropdownData, setDropdownData] = useState(null);
  const [forbidden, setForbidden] = useState(false);

  // Online/offline indicator
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // form state: null = closed, 'new' = create mode, entry object = edit mode
  const [formEntry, setFormEntry] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formDirty, setFormDirty] = useState(false);

  // Block browser tab/window close when form has unsaved changes
  useEffect(() => {
    const handler = (e) => {
      if (formOpen && formDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [formOpen, formDirty]);

  const fetchSummary = useCallback(async (date) => {
    setLoadingSummary(true);
    setSummaryError(null);
    try {
      const data = await getDailySummary({ date });
      setSummary(data);
    } catch (err) {
      if (err?.response?.status === 403) {
        setForbidden(true);
      } else {
        setSummaryError('לא ניתן לטעון את סיכום היום. נסה שוב.');
      }
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  const fetchEntries = useCallback(async (date) => {
    setLoadingEntries(true);
    try {
      const data = await listTimeEntries({ date });
      setEntries(Array.isArray(data) ? data : data?.data ?? []);
    } catch (err) {
      if (err?.response?.status === 403) setForbidden(true);
      // other errors: list stays empty
    } finally {
      setLoadingEntries(false);
    }
  }, []);

  const fetchDropdownData = useCallback(async () => {
    try {
      const data = await getDropdownData();
      setDropdownData(data);
    } catch {
      // non-fatal: dropdowns will be empty
    }
  }, []);

  useEffect(() => {
    fetchSummary(selectedDate);
    fetchEntries(selectedDate);
  }, [selectedDate, fetchSummary, fetchEntries]);

  // Fetch dropdown data once on mount
  useEffect(() => {
    fetchDropdownData();
  }, [fetchDropdownData]);

  const reported = minutesToHours(summary?.total_hours != null ? summary.total_hours * 60 : null) || (summary?.total_hours ?? 0);
  // daily-summary returns hours directly (not minutes), so use as-is
  const reportedHours = summary?.total_hours ?? 0;
  const standardHours = summary?.standard_hours ?? 9;
  const remainingHours = summary?.remaining_hours ?? (standardHours - reportedHours);

  const isWeekend = summary?.status === 'day_off';
  const isOverStandard = reportedHours > standardHours;
  const isUnderStandard = !isWeekend && reportedHours < standardHours && reportedHours > 0;
  const isFull = reportedHours >= standardHours;
  // Quota warning: backend sets quota_warning=true in daily summary when monthly reported ≥90% of quota
  const showQuotaWarning = Boolean(summary?.quota_warning);

  const progressPct = standardHours > 0 ? Math.min((reportedHours / standardHours) * 100, 100) : 0;

  const selectedDateObj = new Date(selectedDate + 'T00:00:00');
  const hebrewDateLabel = formatHebrewDate(selectedDateObj);

  const today = toLocalDateString(new Date());

  const currentMonth = selectedDate.substring(0, 7); // YYYY-MM format

  const handleMonthChange = useCallback((newDate) => {
    // Set to first day of new month
    const year = newDate.getFullYear();
    const month = String(newDate.getMonth() + 1).padStart(2, '0');
    const newMonthStr = `${year}-${month}-01`;
    setSelectedDate(newMonthStr);
  }, []);

  // 403 — no permission state (replaces the whole main area)
  if (forbidden) {
    return (
      <div className={styles.page} dir="rtl" lang="he">
        <AppHeader
          currentMonth={currentMonth}
          onMonthChange={handleMonthChange}
          onManualReport={() => { setFormEntry(null); setFormOpen(true); }}
          onTimerToggle={() => { /* TODO: implement timer */ }}
        />
        <main className={styles.main}>
          <div className={styles.forbiddenState} role="alert">
            <span className={styles.forbiddenIcon} aria-hidden="true">🚫</span>
            <h2 className={styles.forbiddenTitle}>אין הרשאה</h2>
            <p className={styles.forbiddenBody}>אין לך הרשאה לצפות בנתונים אלו. פנה למנהל המערכת.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page} dir="rtl" lang="he">
      {/* ── Header bar ── */}
      <AppHeader
        onManualReport={() => { setFormEntry(null); setFormOpen(true); }}
        onTimerToggle={() => { /* TODO: implement timer */ }}
      />

      {/* ── Main content ── */}
      <main className={styles.main}>
        {/* Month navigator + section title header */}
        <div className={styles.topSectionHeader}>
          <div className={styles.monthNavSection}>
            <button
              className={styles.monthNavArrow}
              onClick={() => {
                const parts = currentMonth.split('-');
                const newMonth = new Date(parseInt(parts[0]), parseInt(parts[1]) - 2, 1);
                handleMonthChange(newMonth);
              }}
              aria-label="חודש קודם"
              type="button"
            >
              ‹
            </button>
            <span className={styles.currentMonthLabel}>
              {HE_MONTHS[parseInt(currentMonth.split('-')[1]) - 1]}
            </span>
            <button
              className={styles.monthNavArrow}
              onClick={() => {
                const parts = currentMonth.split('-');
                const newMonth = new Date(parseInt(parts[0]), parseInt(parts[1]), 1);
                handleMonthChange(newMonth);
              }}
              aria-label="חודש הבא"
              type="button"
            >
              ›
            </button>
          </div>
          <div className={styles.titleSection}>
            <h1 className={styles.pageTitle}>דיווח שעות</h1>
            <p className={styles.pageSubtitle}>
              רשימת הדיווחים לחודש - {hebrewDateLabel}
            </p>
          </div>
        </div>

        {/* Entries section */}
        <section className={styles.entriesSection} aria-label="דיווחים ליום זה">
          <ExistingEntriesList
            entries={entries}
            dropdownData={dropdownData}
            loading={loadingEntries}
            onEdit={(entry) => { setFormEntry(entry); setFormOpen(true); }}
            onRefresh={() => { fetchEntries(selectedDate); fetchSummary(selectedDate); }}
          />
        </section>
      </main>

      {/* ── Report form drawer ── */}
      {formOpen && (
        <ReportForm
          dropdownData={dropdownData}
          entry={formEntry}
          date={selectedDate}
          standardHours={standardHours}
          isOnline={isOnline}
          onSave={() => {
            // Called only on EDIT success — close drawer and refetch
            setFormOpen(false);
            setFormDirty(false);
            fetchEntries(selectedDate);
            fetchSummary(selectedDate);
          }}
          onEntryCreated={() => {
            // Called on CREATE success — drawer stays open; just refetch list
            fetchEntries(selectedDate);
            fetchSummary(selectedDate);
          }}
          onDirtyChange={(dirty) => setFormDirty(dirty)}
          onCancel={() => { setFormOpen(false); setFormDirty(false); }}
        />
      )}

      {/* ── (Route-change guard handled by beforeunload + drawer's own unsaved dialog) ── */}
    </div>
  );
}
