import { useCallback, useEffect, useState } from 'react';
import { getDailySummary, getDropdownData, listTimeEntries } from '../../api/timeEntries.api';
import { getMonthStatus } from '../../api/monthLocks.api.js';
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

const MONTHLY_SUMMARY_PLACEHOLDER = {
  reportedHours: 141,
  targetHours: 181,
  completionRate: 78,
  missingHours: 36,
  absenceHours: 32,
  missingDays: 4,
  projectBreakdown: [
    { name: 'El Al Cargo', hours: '55 ש\'' },
    { name: 'פרויקט ב\'', hours: '35.2 ש\'' },
    { name: 'פרויקט ג\'', hours: '26.8 ש\'' },
    { name: 'פרויקט ד\'', hours: '15.5 ש\'' },
    { name: 'פרויקט ה\'', hours: '8.5 ש\'' },
  ],
};

function HoursIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5l3 1.75" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M7.5 3.5v3" />
      <path d="M16.5 3.5v3" />
      <path d="M3.5 9.5h17" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 9 9h-9z" />
      <path d="M14 3.6A8.4 8.4 0 0 1 20.4 10H14z" />
    </svg>
  );
}

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
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [isMonthLocked, setIsMonthLocked] = useState(false);

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

  useEffect(() => {
    if (!summaryOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setSummaryOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [summaryOpen]);

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

  useEffect(() => {
    const [year, month] = currentMonth.split('-').map(Number);
    getMonthStatus(year, month)
      .then((data) => setIsMonthLocked((data.data ?? data).is_locked ?? false))
      .catch(() => setIsMonthLocked(false));
  }, [currentMonth]);

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
          onManualReport={() => {
            setFormEntry(null);
            setFormOpen(true);
          }}
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
          if (isMonthLocked) return;
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
            <p className={styles.pageSubtitle}>רשימת הדיווחים היומיים - לחודש {currentMonthLabel} {currentYearLabel}</p>
          </div>
        </div>

        <button
          type="button"
          className={styles.monthlySummaryStrip}
          onClick={() => setSummaryOpen(true)}
          aria-label="פתח סיכום חודשי"
        >
          <span className={styles.monthlySummaryLink}>סיכום חודשי</span>

          <div className={styles.monthlySummaryMetric}>
            <strong className={styles.monthlySummaryValue}>{MONTHLY_SUMMARY_PLACEHOLDER.reportedHours} ש'</strong>
            <span className={styles.monthlySummaryLabel}>דיווחת עד כה</span>
          </div>

          <div className={styles.monthlySummaryMetric}>
            <strong className={styles.monthlySummaryValue}>{MONTHLY_SUMMARY_PLACEHOLDER.targetHours} ש'</strong>
            <span className={styles.monthlySummaryLabel}>היעד החודשי</span>
          </div>

          <div className={styles.monthlySummaryMetric}>
            <strong className={styles.monthlySummaryValue}>{MONTHLY_SUMMARY_PLACEHOLDER.completionRate}%</strong>
            <span className={styles.monthlySummaryLabel}>הושלמו</span>
          </div>
        </button>

        {isMonthLocked && (
          <div className={styles.lockedBanner} role="alert" aria-live="polite">
            <span aria-hidden="true">🔒</span>
            החודש נעול — קריאה בלבד
          </div>
        )}

        <section className={styles.entriesSection} aria-label="רשימת דיווחים חודשית">
          <ExistingEntriesList
            entries={entries}
            dropdownData={dropdownData}
            loading={loadingEntries}
            currentMonth={currentMonth}
            selectedDate={selectedDate}
            standardHours={standardHours}
            isLocked={isMonthLocked}
            onAddEntry={(date) => {
              if (isMonthLocked) return;
              setSelectedDate(date);
              setFormEntry(null);
              setFormOpen(true);
            }}
            onEdit={(entry) => {
              if (isMonthLocked) return;
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

      <div
        className={`${styles.summaryOverlay} ${summaryOpen ? styles.summaryOverlayOpen : ''}`}
        onClick={() => setSummaryOpen(false)}
        aria-hidden={!summaryOpen}
      />

      <aside
        className={`${styles.summaryDrawer} ${summaryOpen ? styles.summaryDrawerOpen : ''}`}
        aria-hidden={!summaryOpen}
      >
        <div className={styles.summaryDrawerHeader}>
          <button
            type="button"
            className={styles.summaryDrawerClose}
            onClick={() => setSummaryOpen(false)}
            aria-label="סגור סיכום חודשי"
          >
            ×
          </button>
          <h2 className={styles.summaryDrawerTitle}>סיכום חודשי</h2>
        </div>

        <div className={styles.summaryDrawerMonth}>{currentMonthLabel} {currentYearLabel}</div>

        <section className={styles.summaryDrawerCard}>
          <div className={styles.summaryDrawerCardHeader}>
            <span className={styles.summaryDrawerMeta}>{MONTHLY_SUMMARY_PLACEHOLDER.completionRate}% הושלמו</span>
            <h3 className={styles.summaryDrawerCardTitle}>שעות חודשיות</h3>
            <span className={`${styles.summaryDrawerIcon} ${styles.summaryDrawerIconBlue}`}>
              <HoursIcon />
            </span>
          </div>

          <div className={styles.summaryProgressTrack}>
            <div
              className={styles.summaryProgressFill}
              style={{ width: `${MONTHLY_SUMMARY_PLACEHOLDER.completionRate}%` }}
            />
          </div>

          <div className={styles.summaryProgressFoot}>
            <span className={styles.summaryProgressMuted}>מתוך {MONTHLY_SUMMARY_PLACEHOLDER.targetHours} ש' תקן</span>
            <span className={styles.summaryProgressMain}>
              <strong>{MONTHLY_SUMMARY_PLACEHOLDER.reportedHours}</strong>
              ש' דווחו
            </span>
          </div>

          <div className={styles.summaryAlert}>
            <span className={styles.summaryAlertIcon}>!</span>
            <span>
              חסרות לך <b>{MONTHLY_SUMMARY_PLACEHOLDER.missingHours} שעות</b> לפי התקן עד היום
            </span>
          </div>
        </section>

        <div className={styles.summaryMiniGrid}>
          <section className={`${styles.summaryMiniCard} ${styles.summaryMiniWarn}`}>
            <span className={styles.summaryMiniIcon}>
              <CalendarIcon />
            </span>
            <strong className={styles.summaryMiniValue}>{MONTHLY_SUMMARY_PLACEHOLDER.absenceHours}</strong>
            <span className={styles.summaryMiniLabel}>שעות היעדרות</span>
          </section>

          <section className={`${styles.summaryMiniCard} ${styles.summaryMiniDanger}`}>
            <span className={styles.summaryMiniIcon}>
              <CalendarIcon />
            </span>
            <strong className={styles.summaryMiniValue}>{MONTHLY_SUMMARY_PLACEHOLDER.missingDays}</strong>
            <span className={styles.summaryMiniLabel}>ימים ללא דיווח</span>
          </section>
        </div>

        <section className={styles.summaryDrawerCard}>
          <div className={styles.summaryDrawerCardHeader}>
            <h3 className={styles.summaryDrawerCardTitle}>פילוח לפי פרויקטים</h3>
            <span className={`${styles.summaryDrawerIcon} ${styles.summaryDrawerIconPurple}`}>
              <ChartIcon />
            </span>
          </div>

          <div className={styles.summaryBreakdown}>
            {MONTHLY_SUMMARY_PLACEHOLDER.projectBreakdown.map((project) => (
              <div key={project.name} className={styles.summaryBreakdownRow}>
                <span className={styles.summaryBreakdownName}>{project.name}</span>
                <span className={styles.summaryBreakdownHours}>{project.hours}</span>
              </div>
            ))}
          </div>
        </section>
      </aside>

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
