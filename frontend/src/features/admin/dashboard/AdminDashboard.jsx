import { useEffect, useMemo, useState } from 'react';
import { startTransition } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAdminDashboard } from '../../../api/adminDashboard.api.js';
import { AdminShell } from '../../../components/layout/AdminShell.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { SubmissionStatusTable } from './SubmissionStatusTable.jsx';
import styles from './AdminDashboard.module.css';

const STATUS_LEGEND = [
  { key: 'not_started', label: 'לא התחיל', className: styles.statusNotStarted },
  { key: 'missing', label: 'חסר', className: styles.statusMissing },
  { key: 'submitted', label: 'הוגש', className: styles.statusSubmitted },
];

function pad2(value) {
  return String(value).padStart(2, '0');
}

function getCurrentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
}

function getInitialMonthValue(params) {
  const value = params.get('month');
  return value && /^\d{4}-\d{2}$/.test(value) ? value : getCurrentMonthValue();
}

function formatPercent(value, total) {
  if (!total) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

function formatMonthHeading(monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  return new Intl.DateTimeFormat('he-IL', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1));
}

function getMonthCells(row, weeks) {
  const requestedWeeks = weeks.filter((week) => week.in_requested_month);
  const cellMap = new Map(row.cells.map((cell) => [cell.week_start_date, cell]));

  return requestedWeeks.map((week) => {
    return cellMap.get(week.week_start_date) ?? {
      week_start_date: week.week_start_date,
      status: 'not_started',
    };
  });
}

function getMonthlyStatus(cells) {
  if (cells.some((cell) => cell.status === 'missing')) return 'missing';
  if (cells.some((cell) => cell.status !== 'not_started')) return 'submitted';
  return 'not_started';
}

function getTargetWeekStartDate(cells) {
  const priority = ['missing', 'draft', 'rejected', 'submitted', 'approved', 'not_started'];

  for (const status of priority) {
    const match = cells.find((cell) => cell.status === status);
    if (match) return match.week_start_date;
  }

  return cells[0]?.week_start_date ?? null;
}

function getStatus(error) {
  return error?.response?.status ?? error?.status;
}

function mapErrorMessage(error) {
  const status = getStatus(error);
  if (status === 401) return 'פג תוקף ההתחברות. צריך להיכנס שוב.';
  if (status === 403) return 'אין לך הרשאה לצפות בלוח הבקרה.';
  return 'אירעה שגיאה בזמן טעינת לוח הבקרה.';
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [monthValue, setMonthValue] = useState(() => getInitialMonthValue(params));
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (params.get('month') === monthValue) return;
    const nextParams = new URLSearchParams(params.toString());
    nextParams.set('month', monthValue);
    setParams(nextParams, { replace: true });
  }, [monthValue, params, setParams]);

  useEffect(() => {
    let active = true;
    const [year, month] = monthValue.split('-').map(Number);

    setLoading(true);
    setError(null);

    startTransition(() => {
      void getAdminDashboard({ year, month })
        .then((payload) => {
          if (!active) return;
          setDashboard(payload);
        })
        .catch((loadError) => {
          if (!active) return;
          setError(mapErrorMessage(loadError));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    });

    return () => {
      active = false;
    };
  }, [monthValue]);

  function handleCellClick(row, cell) {
    navigate(`/admin/reports?user_id=${row.user_id}&month=${monthValue}&week_start_date=${cell.week_start_date}`);
  }

  const monthlyRows = useMemo(() => {
    if (!dashboard?.rows || !dashboard?.weeks) return [];

    return dashboard.rows.map((row) => {
      const monthCells = getMonthCells(row, dashboard.weeks);
      return {
        ...row,
        month_status: getMonthlyStatus(monthCells),
        target_week_start_date: getTargetWeekStartDate(monthCells),
      };
    });
  }, [dashboard]);

  const summaryCards = useMemo(() => {
    if (!monthlyRows.length) return [];

    const totalUsers = monthlyRows.length;
    const submittedCount = monthlyRows.filter((row) => row.month_status === 'submitted').length;
    const missingCount = monthlyRows.filter((row) => row.month_status === 'missing').length;
    const notStartedCount = monthlyRows.filter((row) => row.month_status === 'not_started').length;

    return [
      {
        key: 'employees',
        label: 'סה"כ עובדים',
        value: String(totalUsers),
        hint: 'עובדים פעילים בלוח הבקרה',
        toneClass: styles.summaryCardEmployees,
      },
      {
        key: 'submitted',
        label: 'הוגש החודש',
        value: formatPercent(submittedCount, totalUsers),
        hint: `${submittedCount} עובדים`,
        toneClass: styles.summaryCardSubmitted,
      },
      {
        key: 'not-started',
        label: 'לא התחיל',
        value: String(notStartedCount),
        hint: 'לא נוצר עדיין דיווח בחודש הנבחר',
        toneClass: styles.summaryCardNotStarted,
      },
      {
        key: 'missing',
        label: 'חסרים למעקב',
        value: String(missingCount),
        hint: 'דורש בדיקה מיידית',
        toneClass: styles.summaryCardMissing,
      },
    ];
  }, [monthlyRows]);

  const actions = (
    <label className={styles.monthControl}>
      <span className={styles.monthLabel}>חודש תצוגה</span>
      <input
        className={styles.monthInput}
        type="month"
        value={monthValue}
        onChange={(event) => setMonthValue(event.target.value)}
      />
    </label>
  );

  return (
    <div className="app-page">
      <AdminShell
        title="לוח בקרה"
        subtitle="תמונת מצב חודשית מרוכזת שמציגה מי הגיש, מי חסר ומי עדיין לא התחיל."
        actions={actions}
      >
        <div className={styles.page}>
          {summaryCards.length > 0 ? (
            <section className={styles.summaryGrid}>
              {summaryCards.map((card) => (
                <article key={card.key} className={`${styles.summaryCard} ${card.toneClass}`}>
                  <p className={styles.summaryLabel}>{card.label}</p>
                  <p className={styles.summaryValue}>{card.value}</p>
                  <p className={styles.summaryHint}>{card.hint}</p>
                </article>
              ))}
            </section>
          ) : null}

          <section className={styles.toolbar}>
            <div className={styles.legend}>
              {STATUS_LEGEND.map((item) => (
                <div key={item.key} className={`${styles.legendItem} ${item.className}`}>
                  <span className={styles.legendDot} />
                  {item.label}
                </div>
              ))}
            </div>
          </section>

          {loading ? (
            <div className={styles.state}>
              <Spinner label="טוען את לוח הבקרה..." />
            </div>
          ) : null}

          {!loading && error ? (
            <div className={styles.state}>
              <ErrorState title="טעינת לוח הבקרה נכשלה" description={error} onAction={() => setMonthValue((current) => current)} />
            </div>
          ) : null}

          {!loading && !error && dashboard && dashboard.rows.length === 0 ? (
            <div className={styles.state}>
              <EmptyState title="אין נתונים להצגה" description="לא נמצאו עובדים או דיווחים עבור החודש שנבחר." />
            </div>
          ) : null}

          {!loading && !error && monthlyRows.length > 0 ? (
            <SubmissionStatusTable
              monthLabel={formatMonthHeading(monthValue)}
              rows={monthlyRows}
              onCellClick={handleCellClick}
            />
          ) : null}
        </div>
      </AdminShell>
    </div>
  );
}
