import { useCallback, useEffect, useState } from 'react';
import { getDailySummary, getDropdownData, getMonthlySummary, listTimeEntries } from '../../api/timeEntries.api';
import type { DailySummary, DropdownData, MonthlySummary, TimeEntry } from '../../api/contracts';
import { getMonthStatus } from '../../api/monthLocks.api';
import { AppHeader } from '../../components/AppHeader';
import { ExistingEntriesList } from './ExistingEntriesList';
import { ReportForm } from './ReportForm';
import styles from './DailyReportPage.module.css';

function toLocalDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const HE_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];


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

function ArrowForwardIosIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" fill="#141E3E" />
    </svg>
  );
}

function DangerCircleIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="#FEE2E2" />
      <path d="M15.9993 24.3337C20.5827 24.3337 24.3327 20.5837 24.3327 16.0003C24.3327 11.417 20.5827 7.66699 15.9993 7.66699C11.416 7.66699 7.66602 11.417 7.66602 16.0003C7.66602 20.5837 11.416 24.3337 15.9993 24.3337Z" stroke="#FF1D21" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 12.667V16.8337" stroke="#FF1D21" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.9961 19.333H16.0036" stroke="#FF1D21" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
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
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [dropdownData, setDropdownData] = useState<DropdownData | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [formEntry, setFormEntry] = useState<TimeEntry | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);
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
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!formOpen || !formDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [formOpen, formDirty]);

  useEffect(() => {
    if (!summaryOpen) return undefined;

    const handleEscape = (event: KeyboardEvent) => {
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

  const fetchSummary = useCallback(async (date: string) => {
    try {
      const data = await getDailySummary({ date });
      setSummary(data);
    } catch (err: unknown) {
      if ((err as { response?: { status?: number } })?.response?.status === 403) {
        setForbidden(true);
      }
    }
  }, []);

  const fetchEntries = useCallback(async (month: string) => {
    setLoadingEntries(true);
    try {
      const data = await listTimeEntries({ month });
      setEntries(data);
    } catch (err: unknown) {
      if ((err as { response?: { status?: number } })?.response?.status === 403) {
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

  const fetchMonthlySummary = useCallback(async (month: string) => {
    const [year, monthNum] = month.split('-').map(Number);
    const data = await getMonthlySummary({ year, month: monthNum });
    setMonthlySummary(data);
  }, []);

  useEffect(() => {
    fetchSummary(selectedDate);
  }, [selectedDate, fetchSummary]);

  useEffect(() => {
    fetchEntries(currentMonth);
    fetchMonthlySummary(currentMonth);
  }, [currentMonth, fetchEntries, fetchMonthlySummary]);

  useEffect(() => {
    fetchDropdownData();
  }, [fetchDropdownData]);

  useEffect(() => {
    const [year, month] = currentMonth.split('-').map(Number);
    getMonthStatus(year, month)
      .then((data) => setIsMonthLocked(data.is_locked ?? false))
      .catch(() => setIsMonthLocked(false));
  }, [currentMonth]);

  const standardHours = summary?.standard_hours ?? 9;

  const handleMonthChange = useCallback((nextDate: Date) => {
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
          onTimerToggle={(timerData: Partial<TimeEntry>) => {
            setFormEntry((timerData as TimeEntry) ?? null);
            setFormOpen(true);
          }}
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
        onTimerToggle={(timerData: Partial<TimeEntry>) => {
          setFormEntry((timerData as TimeEntry) ?? null);
          setFormOpen(true);
        }}
      />

      <main className={styles.main}>
        <div className={styles.topSectionHeader}>
          <div className={styles.titleSection}>
            <h1 className={styles.pageTitle}>דיווח שעות</h1>
            <p className={styles.pageSubtitle}>רשימת הדיווחים היומיים - לחודש {currentMonthLabel} {currentYearLabel}</p>
          </div>

          <div className={styles.monthNavSection}>
            <button
              type="button"
              className={styles.monthNavArrow}
              aria-label="חודש קודם"
              onClick={() => {
                const [year, month] = currentMonth.split('-').map(Number);
                handleMonthChange(new Date(year, month - 2, 1));
              }}
            >
              <ArrowForwardIosIcon />
            </button>
            <span className={styles.currentMonthLabel}>{currentMonthLabel}</span>
            <button
              type="button"
              className={styles.monthNavArrow}
              aria-label="חודש הבא"
              onClick={() => {
                const [year, month] = currentMonth.split('-').map(Number);
                handleMonthChange(new Date(year, month, 1));
              }}
            >
              <ArrowForwardIosIcon className={styles.arrowIconLeft} />
            </button>
          </div>
        </div>

        <div className={styles.monthlySummaryStrip}>
          <div className={styles.monthlySummaryMetric}>
            <strong className={styles.monthlySummaryValue}>{monthlySummary?.reportedHours ?? '—'} ש'</strong>
            <span className={styles.monthlySummaryLabel}>דיווחת עד כה</span>
          </div>

          <div className={styles.monthlySummaryMetric}>
            <strong className={styles.monthlySummaryValue}>{monthlySummary?.quotaHours ?? '—'} ש'</strong>
            <span className={styles.monthlySummaryLabel}>היעד החודשי</span>
          </div>

          <div className={styles.monthlySummaryMetric}>
            <strong className={styles.monthlySummaryValue}>{monthlySummary?.completionPercentage ?? '—'}%</strong>
            <span className={styles.monthlySummaryLabel}>הושלמו</span>
          </div>

          <button
            type="button"
            className={styles.monthlySummaryLink}
            onClick={() => setSummaryOpen(true)}
            aria-label="פתח סיכום חודשי"
          >
            סיכום חודשי ›
          </button>
        </div>

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
            onAddEntry={(date: string) => {
              if (isMonthLocked) return;
              setSelectedDate(date);
              setFormEntry(null);
              setFormOpen(true);
            }}
            onEdit={(entry: TimeEntry) => {
              if (isMonthLocked) return;
              setSelectedDate(entry.date);
              setFormEntry(entry);
              setFormOpen(true);
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
          <h2 className={styles.summaryDrawerTitle}>סיכום חודשי</h2>
          <button
            type="button"
            className={styles.summaryDrawerClose}
            onClick={() => setSummaryOpen(false)}
            aria-label="סגור סיכום חודשי"
          >
            ×
          </button>
        </div>

        <div className={styles.summaryDrawerMonthNav}>
          <button
            type="button"
            className={styles.summaryDrawerMonthArrow}
            aria-label="חודש קודם"
            onClick={() => {
              const [year, month] = currentMonth.split('-').map(Number);
              handleMonthChange(new Date(year, month - 2, 1));
            }}
          >
            <ArrowForwardIosIcon className={styles.arrowIconRight} />
          </button>
          <span className={styles.summaryDrawerMonthLabel}>{currentMonthLabel} {currentYearLabel}</span>
          <button
            type="button"
            className={styles.summaryDrawerMonthArrow}
            aria-label="חודש הבא"
            onClick={() => {
              const [year, month] = currentMonth.split('-').map(Number);
              handleMonthChange(new Date(year, month, 1));
            }}
          >
            <ArrowForwardIosIcon className={styles.arrowIconLeft} />
          </button>
        </div>

        <section className={styles.summaryDrawerCard}>
          <div className={styles.summaryDrawerCardHeader}>
            <div className={styles.summaryDrawerCardTitleGroup}>
              <h3 className={styles.summaryDrawerCardTitle}>שעות חודשיות</h3>
              <span className={styles.summaryDrawerMeta}>{monthlySummary?.completionPercentage ?? '—'}% הושלמו</span>
            </div>
            <span className={`${styles.summaryDrawerIcon} ${styles.summaryDrawerIconBlue}`}>
              <HoursIcon />
            </span>
          </div>

          <div className={styles.summaryProgressTrack}>
            <div
              className={styles.summaryProgressFill}
              style={{ width: `${monthlySummary?.completionPercentage ?? 0}%` }}
            />
          </div>

          <div className={styles.summaryProgressFoot}>
            <span className={styles.summaryProgressMain}>
              <strong>{monthlySummary?.reportedHours ?? '—'}</strong>
              ש' דווחו
            </span>
            <span className={styles.summaryProgressMuted}>מתוך {monthlySummary?.quotaHours ?? '—'} ש' תקן</span>
          </div>

          <div className={styles.summaryAlert}>
            <span className={styles.summaryAlertIcon}>!</span>
            <span>
              חסרות לך <b>{monthlySummary?.missingHoursToDate ?? '—'} שעות</b> להשלמת החודש
            </span>
          </div>
        </section>

        <div className={styles.summaryMiniGrid}>
          <section className={`${styles.summaryMiniCard} ${styles.summaryMiniDanger}`}>
            <div className={styles.summaryMiniContent}>
              <strong className={styles.summaryMiniValue}>{monthlySummary?.daysWithoutReport ?? '—'}</strong>
              <span className={styles.summaryMiniLabel}>ימים ללא דיווח</span>
            </div>
            <DangerCircleIcon />
          </section>

          <section className={`${styles.summaryMiniCard} ${styles.summaryMiniWarn}`}>
            <div className={styles.summaryMiniContent}>
              <strong className={styles.summaryMiniValue}>{monthlySummary?.absenceHours ?? '—'}</strong>
              <span className={styles.summaryMiniLabel}>שעות היעדרות</span>
            </div>
            <span className={styles.summaryMiniIcon}>
              <CalendarIcon />
            </span>
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
            {(monthlySummary?.projectBreakdown ?? []).map((project) => (
              <div key={project.projectId} className={styles.summaryBreakdownRow}>
                <span className={styles.summaryBreakdownName}>{project.projectName}</span>
                <span className={styles.summaryBreakdownHours}>{project.hours} ש'</span>
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
