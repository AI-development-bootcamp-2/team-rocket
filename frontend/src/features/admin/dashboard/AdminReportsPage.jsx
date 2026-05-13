import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listAbsences } from '../../../api/absences.api.js';
import { listTimeEntries } from '../../../api/timeEntries.api';
import { listUsers } from '../../../api/users.api.js';
import { AdminShell } from '../../../components/layout/AdminShell';
import { Button } from '../../../components/ui/Button.jsx';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import styles from './AdminReportsPage.module.css';

const DAY_NAMES = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const STATUS_META = {
  reported: { label: 'יש דיווח', className: styles.statusReported },
  missing: { label: 'חסר דיווח', className: styles.statusMissing },
  absence: { label: 'העדרות', className: styles.statusAbsence },
};

function pad2(value) {
  return String(value).padStart(2, '0');
}

function getMonthValueFromDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function getDefaultMonthValue(params) {
  const month = params.get('month');
  if (month && /^\d{4}-\d{2}$/.test(month)) return month;

  const weekStart = params.get('week_start_date');
  if (weekStart && /^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return weekStart.slice(0, 7);

  return getMonthValueFromDate(new Date());
}

function parseMonthRange(monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  return {
    start: `${year}-${pad2(month)}-01`,
    end: `${year}-${pad2(month)}-${pad2(new Date(year, month, 0).getDate())}`,
  };
}

function toDateLabel(date) {
  const dateObject = new Date(`${date}T00:00:00`);
  return `${DAY_NAMES[dateObject.getDay()]} ${pad2(dateObject.getDate())}.${pad2(dateObject.getMonth() + 1)}`;
}

function formatMonthLabel(monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  return new Intl.DateTimeFormat('he-IL', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1));
}

function getDisplayName(user) {
  if (!user) return '';
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
}

function buildWorkingDays(monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  const currentMonth = getMonthValueFromDate(new Date());
  if (monthValue > currentMonth) return [];

  const today = new Date();
  const monthLastDay = new Date(year, month, 0).getDate();
  const totalDays = monthValue === currentMonth ? Math.min(today.getDate(), monthLastDay) : monthLastDay;
  const dates = [];

  for (let day = totalDays; day >= 1; day -= 1) {
    const date = `${year}-${pad2(month)}-${pad2(day)}`;
    const weekday = new Date(`${date}T00:00:00`).getDay();
    if (weekday === 5 || weekday === 6) continue;
    dates.push(date);
  }

  return dates;
}

function enumerateWorkingDaysInRange(startDate, endDate) {
  const dates = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  while (cursor <= end) {
    const weekday = cursor.getDay();
    if (weekday !== 5 && weekday !== 6) {
      dates.push(`${cursor.getFullYear()}-${pad2(cursor.getMonth() + 1)}-${pad2(cursor.getDate())}`);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function summarizeMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${pad2(minutes)} שעות`;
}

function getAbsenceTypeLabel(type, isPartial) {
  if (type === 'sick') return isPartial ? 'מחלה חלקית' : 'מחלה';
  if (type === 'reserve') return isPartial ? 'מילואים חלקי' : 'מילואים';
  if (type === 'vacation_full') return 'חופשה';
  if (type === 'vacation_half') return 'חצי יום חופשה';
  return 'העדרות';
}

function pickDayStatus(date, entriesByDate, absenceByDate) {
  const absence = absenceByDate.get(date);
  if (absence) {
    return {
      key: 'absence',
      detail: getAbsenceTypeLabel(absence.type, absence.is_partial),
    };
  }

  const entries = entriesByDate.get(date) ?? [];
  const totalMinutes = entries.reduce((sum, entry) => sum + (entry.duration_minutes ?? 0), 0);

  if (totalMinutes > 0) {
    return {
      key: 'reported',
      detail: summarizeMinutes(totalMinutes),
    };
  }

  return {
    key: 'missing',
    detail: 'לא נמצא דיווח ליום זה',
  };
}

function getStatus(error) {
  return error?.response?.status ?? error?.status;
}

function mapErrorMessage(error) {
  const status = getStatus(error);
  if (status === 401) return 'פג תוקף ההתחברות. צריך להיכנס שוב.';
  if (status === 403) return 'אין לך הרשאה לצפות בסקירת הדיווחים.';
  return 'אירעה שגיאה בזמן טעינת סקירת הדיווחים.';
}

export function AdminReportsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const userId = params.get('user_id');
  const [monthValue, setMonthValue] = useState(() => getDefaultMonthValue(params));
  const [users, setUsers] = useState([]);
  const [entries, setEntries] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [error, setError] = useState(null);
  const deferredSearch = useDeferredValue(employeeSearch);

  useEffect(() => {
    let active = true;

    setUsersLoading(true);
    listUsers({ isActive: 'active' })
      .then((response) => {
        if (!active) return;
        setUsers(Array.isArray(response?.data) ? response.data : []);
      })
      .catch(() => {
        if (!active) return;
        setUsers([]);
      })
      .finally(() => {
        if (active) setUsersLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setError('לא נבחר עובד להצגה.');
      setLoading(false);
      return undefined;
    }

    let active = true;
    const numericUserId = Number(userId);
    const { start, end } = parseMonthRange(monthValue);

    setLoading(true);
    setError(null);

    Promise.all([
      listTimeEntries({ userId: numericUserId, month: monthValue }),
      listAbsences({ userId: numericUserId, dateFrom: start, dateTo: end }),
    ])
      .then(([timeEntries, absenceRows]) => {
        if (!active) return;
        setEntries(Array.isArray(timeEntries) ? timeEntries : []);
        setAbsences(Array.isArray(absenceRows) ? absenceRows : []);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(mapErrorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [monthValue, userId]);

  useEffect(() => {
    const nextParams = new URLSearchParams(params.toString());
    let changed = false;

    if (params.get('month') !== monthValue) {
      nextParams.set('month', monthValue);
      changed = true;
    }

    if (!userId && users.length > 0) {
      nextParams.set('user_id', String(users[0].id));
      changed = true;
    }

    if (changed) {
      setParams(nextParams, { replace: true });
    }
  }, [monthValue, params, setParams, userId, users]);

  const selectedUser = useMemo(() => {
    return users.find((user) => String(user.id) === String(userId)) ?? null;
  }, [userId, users]);

  const filteredUsers = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return users;

    return users.filter((user) => {
      const fullName = getDisplayName(user).toLowerCase();
      return fullName.includes(query);
    });
  }, [deferredSearch, users]);

  const dayRows = useMemo(() => {
    const entriesByDate = new Map();
    for (const entry of entries) {
      const existing = entriesByDate.get(entry.date) ?? [];
      existing.push(entry);
      entriesByDate.set(entry.date, existing);
    }

    const absenceByDate = new Map();
    const { start: monthStart, end: monthEnd } = parseMonthRange(monthValue);
    for (const absence of absences) {
      const rangeStart = absence.start_date > monthStart ? absence.start_date : monthStart;
      const rangeEnd = absence.end_date < monthEnd ? absence.end_date : monthEnd;
      if (rangeStart > rangeEnd) continue;
      const dates = enumerateWorkingDaysInRange(rangeStart, rangeEnd);
      for (const date of dates) {
        if (!absenceByDate.has(date)) {
          absenceByDate.set(date, absence);
        }
      }
    }

    return buildWorkingDays(monthValue).map((date) => {
      const status = pickDayStatus(date, entriesByDate, absenceByDate);
      return {
        date,
        ...status,
      };
    });
  }, [absences, entries, monthValue]);

  const summary = useMemo(() => {
    return dayRows.reduce((acc, row) => {
      acc.total += 1;
      acc[row.key] += 1;
      return acc;
    }, { total: 0, reported: 0, missing: 0, absence: 0 });
  }, [dayRows]);

  function shiftMonth(offset) {
    const [year, month] = monthValue.split('-').map(Number);
    setMonthValue(getMonthValueFromDate(new Date(year, month - 1 + offset, 1)));
  }

  function selectUser(nextUserId) {
    const nextParams = new URLSearchParams(params.toString());
    nextParams.set('user_id', String(nextUserId));
    nextParams.set('month', monthValue);
    setParams(nextParams);
    setPickerOpen(false);
    setEmployeeSearch('');
  }

  const actions = (
    <div className={styles.actionsBar}>
      <Button variant="secondary" className={styles.backButton} onClick={() => navigate(`/admin/dashboard?month=${monthValue}`)}>
        חזרה ללוח הבקרה
      </Button>
      <div className={styles.monthControl}>
        <button type="button" className={styles.monthArrow} onClick={() => shiftMonth(-1)} aria-label="חודש קודם">
          ‹
        </button>
        <input
          className={styles.monthInput}
          type="month"
          value={monthValue}
          onChange={(event) => setMonthValue(event.target.value)}
        />
        <button type="button" className={styles.monthArrow} onClick={() => shiftMonth(1)} aria-label="חודש הבא">
          ›
        </button>
      </div>
    </div>
  );

  return (
    <div className="app-page">
      <AdminShell
        title="סקירת דיווחים"
        subtitle="סקירה חודשית יומית שמציגה האם קיים דיווח, חסר דיווח או קיימת העדרות."
        actions={actions}
      >
        <div className={styles.page}>
          <section className={styles.hero}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>עובד</p>
              <button type="button" className={styles.employeeTrigger} onClick={() => setPickerOpen((open) => !open)}>
                <span>{selectedUser ? getDisplayName(selectedUser) : 'בחר עובד'}</span>
                <span className={styles.employeeTriggerChevron}>{pickerOpen ? '▴' : '▾'}</span>
              </button>
              <p className={styles.heroSubtitle}>חודש נבחר: {formatMonthLabel(monthValue)}</p>
            </div>
            <div className={styles.heroMeta}>
              <span className={styles.heroMetaLabel}>ימי עבודה בחודש</span>
              <strong className={styles.heroMetaValue}>{summary.total}</strong>
            </div>
          </section>

          {pickerOpen ? (
            <section className={styles.pickerCard}>
              <input
                className={styles.searchInput}
                type="search"
                placeholder="חיפוש עובד לפי שם"
                value={employeeSearch}
                onChange={(event) => setEmployeeSearch(event.target.value)}
              />

              {usersLoading ? (
                <div className={styles.pickerState}>
                  <Spinner label="טוען עובדים..." />
                </div>
              ) : null}

              {!usersLoading && filteredUsers.length === 0 ? (
                <p className={styles.noResults}>לא נמצאו עובדים מתאימים.</p>
              ) : null}

              {!usersLoading && filteredUsers.length > 0 ? (
                <div className={styles.pickerList}>
                  {filteredUsers.slice(0, 8).map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className={`${styles.pickerItem} ${String(user.id) === String(userId) ? styles.pickerItemActive : ''}`}
                      onClick={() => selectUser(user.id)}
                    >
                      {getDisplayName(user)}
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {!loading && !error ? (
            <section className={styles.summaryGrid}>
              <article className={`${styles.summaryCard} ${styles.summaryCardReported}`}>
                <p className={styles.summaryLabel}>ימי דיווח</p>
                <p className={styles.summaryValue}>{summary.reported}</p>
              </article>
              <article className={`${styles.summaryCard} ${styles.summaryCardMissing}`}>
                <p className={styles.summaryLabel}>ימים ללא דיווח</p>
                <p className={styles.summaryValue}>{summary.missing}</p>
              </article>
              <article className={`${styles.summaryCard} ${styles.summaryCardAbsence}`}>
                <p className={styles.summaryLabel}>ימי העדרות</p>
                <p className={styles.summaryValue}>{summary.absence}</p>
              </article>
            </section>
          ) : null}

          <section className={styles.legend}>
            {Object.entries(STATUS_META).map(([key, item]) => (
              <div key={item.label} className={`${styles.legendItem} ${item.className}`}>
                <span className={styles.legendDot} />
                {key === 'reported' ? 'יש דיווח ליום זה' : key === 'missing' ? 'חסר דיווח ליום זה' : 'היום הוגדר כהעדרות'}
              </div>
            ))}
          </section>

          {loading ? (
            <div className={styles.state}>
              <Spinner label="טוען את סקירת החודש..." />
            </div>
          ) : null}

          {!loading && error ? (
            <div className={styles.state}>
              <ErrorState title="טעינת סקירת הדיווחים נכשלה" description={error} onAction={() => setMonthValue((current) => current)} />
            </div>
          ) : null}

          {!loading && !error && dayRows.length === 0 ? (
            <div className={styles.state}>
              <EmptyState title="אין נתונים להצגה" description="לא נמצאו ימי עבודה עבור החודש שנבחר." />
            </div>
          ) : null}

          {!loading && !error && dayRows.length > 0 ? (
            <section className={styles.timeline}>
              {dayRows.map((row) => {
                const meta = STATUS_META[row.key];
                return (
                  <article key={row.date} className={styles.dayRow}>
                    <span className={`${styles.statusBadge} ${meta.className}`}>{meta.label}</span>
                    <div className={styles.dayInfo}>
                      <p className={styles.dayDate}>{toDateLabel(row.date)}</p>
                      <p className={styles.dayDetail}>{row.detail}</p>
                    </div>
                  </article>
                );
              })}
            </section>
          ) : null}
        </div>
      </AdminShell>
    </div>
  );
}
