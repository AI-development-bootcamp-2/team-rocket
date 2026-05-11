import { useCallback, useEffect, useState } from 'react';
import { getDailySummary, getDropdownData, listTimeEntries } from '../../api/timeEntries.api';
import { AppHeader } from '../../components/AppHeader';
import { ExistingEntriesList } from './ExistingEntriesList';
import { ReportForm } from './ReportForm';
import styles from './DailyReportPage.module.css';

function toLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const HE_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

export function DailyReportPage() {
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateString(new Date()));
  const [summary, setSummary] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [dropdownData, setDropdownData] = useState(null);
  const [forbidden, setForbidden] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [formEntry, setFormEntry] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formDirty, setFormDirty] = useState(false);

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

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!formOpen || !formDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [formOpen, formDirty]);

  const currentMonth = selectedDate.slice(0, 7);
  const selectedDateObject = new Date(`${selectedDate}T00:00:00`);
  const currentMonthLabel = HE_MONTHS[selectedDateObject.getMonth()];
  const currentYearLabel = selectedDateObject.getFullYear();

  const fetchSummary = useCallback(async (date) => {
    try {
      const data = await getDailySummary({ date });
      setSummary(data);
    } catch (err) {
      if (err?.response?.status === 403) {
        setForbidden(true);
      }
    }
  }, []);

  const fetchEntries = useCallback(async (month) => {
    setLoadingEntries(true);
    try {
      const data = await listTimeEntries({ month });
      setEntries(Array.isArray(data) ? data : data?.data ?? []);
    } catch (err) {
      if (err?.response?.status === 403) {
        setForbidden(true);
      }
    } finally {
      setLoadingEntries(false);
    }
  }, []);

  const fetchDropdownData = useCallback(async () => {
    try {
      const data = await getDropdownData();
      setDropdownData(data);
    } catch {
      // non-fatal: picker lists will be empty
    }
  }, []);

  useEffect(() => {
    fetchSummary(selectedDate);
  }, [selectedDate, fetchSummary]);

  useEffect(() => {
    fetchEntries(currentMonth);
  }, [currentMonth, fetchEntries]);

  useEffect(() => {
    fetchDropdownData();
  }, [fetchDropdownData]);

  const standardHours = summary?.standard_hours ?? 9;

  const handleMonthChange = useCallback((nextDate) => {
    const year = nextDate.getFullYear();
    const month = String(nextDate.getMonth() + 1).padStart(2, '0');
    setSelectedDate(`${year}-${month}-01`);
  }, []);

  if (forbidden) {
    return (
      <div className={styles.page} dir="rtl" lang="he">
        <AppHeader
          onManualReport={() => { setFormEntry(null); setFormOpen(true); }}
          onTimerToggle={() => {}}
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
      <AppHeader
        onManualReport={() => {
          setFormEntry(null);
          setFormOpen(true);
        }}
        onTimerToggle={() => {}}
      />

      <main className={styles.main}>
        <div className={styles.topSectionHeader}>
          <div className={styles.monthNavSection}>
            <button
              className={styles.monthNavArrow}
              type="button"
              aria-label="חודש קודם"
              onClick={() => {
                const [year, month] = currentMonth.split('-').map(Number);
                handleMonthChange(new Date(year, month - 2, 1));
              }}
            >
              ‹
            </button>
            <span className={styles.currentMonthLabel}>{currentMonthLabel}</span>
            <button
              className={styles.monthNavArrow}
              type="button"
              aria-label="חודש הבא"
              onClick={() => {
                const [year, month] = currentMonth.split('-').map(Number);
                handleMonthChange(new Date(year, month, 1));
              }}
            >
              ›
            </button>
          </div>

          <div className={styles.titleSection}>
            <h1 className={styles.pageTitle}>דיווח שעות</h1>
            <p className={styles.pageSubtitle}>רשימת דיווחים יומיים - לחודש {currentMonthLabel} {currentYearLabel}</p>
          </div>
        </div>

        <section className={styles.entriesSection} aria-label="רשימת דיווחים חודשית">
          <ExistingEntriesList
            entries={entries}
            dropdownData={dropdownData}
            loading={loadingEntries}
            currentMonth={currentMonth}
            selectedDate={selectedDate}
            standardHours={standardHours}
            onAddEntry={(date) => {
              setSelectedDate(date);
              setFormEntry(null);
              setFormOpen(true);
            }}
            onEdit={(entry) => {
              setSelectedDate(entry.date);
              setFormEntry(entry);
              setFormOpen(true);
            }}
            onRefresh={() => {
              fetchEntries(currentMonth);
              fetchSummary(selectedDate);
            }}
          />
        </section>
      </main>

      {formOpen && (
        <ReportForm
          dropdownData={dropdownData}
          entry={formEntry}
          date={selectedDate}
          standardHours={standardHours}
          isOnline={isOnline}
          onSave={() => {
            setFormOpen(false);
            setFormDirty(false);
            fetchEntries(currentMonth);
            fetchSummary(selectedDate);
          }}
          onEntryCreated={() => {
            fetchEntries(currentMonth);
            fetchSummary(selectedDate);
          }}
          onDirtyChange={setFormDirty}
          onCancel={() => {
            setFormOpen(false);
            setFormDirty(false);
          }}
        />
      )}
    </div>
  );
}
