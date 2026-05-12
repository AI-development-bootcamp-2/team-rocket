import { useEffect, useMemo, useState } from 'react';
import styles from './ExistingEntriesList.module.css';

const HE_DAYS_SHORT = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];

function formatTime(timeValue) {
  if (!timeValue) return '—';
  return String(timeValue).slice(0, 5);
}

function formatDuration(minutes) {
  if (!minutes && minutes !== 0) return '00:00';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function buildMonthDates(monthString) {
  if (!monthString) return [];
  const [year, month] = monthString.split('-').map(Number);
  const totalDays = new Date(year, month, 0).getDate();
  const dates = [];

  for (let day = totalDays; day >= 1; day -= 1) {
    dates.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }

  return dates;
}

function resolveNames(entry, dropdownData) {
  if (!dropdownData?.clients) return { clientName: '', projectName: '', taskName: '' };

  for (const client of dropdownData.clients) {
    for (const project of client.projects) {
      if (project.id !== entry.project_id) continue;

      const task = project.tasks.find((item) => item.id === entry.task_id);
      return {
        clientName: client.name,
        projectName: project.name,
        taskName: task?.name ?? '',
      };
    }
  }

  return { clientName: '', projectName: '', taskName: '' };
}

function statusMeta(date, dayEntries, standardHours) {
  const dateObject = new Date(`${date}T00:00:00`);
  const day = dateObject.getDay();
  const totalMinutes = dayEntries.reduce((sum, entry) => sum + (entry.duration_minutes ?? 0), 0);
  const standardMinutes = standardHours * 60;
  const isWeekend = day === 5 || day === 6;

  if (isWeekend && totalMinutes === 0) {
    return {
      key: 'weekend',
      label: 'סופ"ש',
      className: styles.statusWeekend,
    };
  }

  if (totalMinutes === 0) {
    return {
      key: 'missing',
      label: 'חסר',
      className: styles.statusMissing,
    };
  }

  if (totalMinutes >= standardMinutes) {
    return {
      key: 'filled',
      label: `${formatDuration(totalMinutes)} ש'`,
      className: styles.statusFilled,
    };
  }

  return {
    key: 'partial',
    label: `${formatDuration(totalMinutes)} ש'`,
    className: styles.statusPartial,
  };
}

function BriefcaseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="7.5" width="17" height="12" rx="2.5" />
      <path d="M8.5 7.5V6.4a1.9 1.9 0 0 1 1.9-1.9h3.2a1.9 1.9 0 0 1 1.9 1.9v1.1" />
      <path d="M3.5 12.5h17" />
    </svg>
  );
}

function ChevronIcon({ expanded }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`${styles.chevronIcon} ${expanded ? styles.chevronExpanded : ''}`}
      aria-hidden="true"
    >
      <path d="M5 8.5 10 13.5 15 8.5" />
    </svg>
  );
}

function EditPencil() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M12.8 2.8a1.8 1.8 0 1 1 2.6 2.6l-7.6 7.6-3 0.5 0.5-3 7.5-7.7Z" />
      <path d="M11.6 4l2.4 2.4" />
    </svg>
  );
}

export function ExistingEntriesList({
  entries,
  dropdownData,
  loading,
  onEdit,
  onAddEntry,
  standardHours = 9,
  currentMonth,
  selectedDate,
  isLocked = false,
}) {
  const [expandedDate, setExpandedDate] = useState(selectedDate ?? null);

  useEffect(() => {
    setExpandedDate(selectedDate ?? null);
  }, [selectedDate, currentMonth]);

  const entriesByDate = useMemo(() => {
    const result = {};
    (entries ?? []).forEach((entry) => {
      if (!result[entry.date]) result[entry.date] = [];
      result[entry.date].push(entry);
    });

    Object.values(result).forEach((dayEntries) => {
      dayEntries.sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
    });

    return result;
  }, [entries]);

  const monthDates = useMemo(() => buildMonthDates(currentMonth), [currentMonth]);

  if (loading) {
    return (
      <div className={styles.list} aria-busy="true" aria-label="טוען דיווחים">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className={styles.loadingCard} />
        ))}
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {monthDates.map((date) => {
        const dayEntries = entriesByDate[date] ?? [];
        const meta = statusMeta(date, dayEntries, standardHours);
        const expanded = expandedDate === date;
        const dateObject = new Date(`${date}T00:00:00`);
        const dateLabel = `${HE_DAYS_SHORT[dateObject.getDay()]},${String(dateObject.getDate()).padStart(2, '0')}/${String(dateObject.getMonth() + 1).padStart(2, '0')}/${String(dateObject.getFullYear()).slice(2)}`;

        return (
          <div key={date} className={`${styles.daySection} ${expanded ? styles.daySectionExpanded : ''}`}>
            <button
              type="button"
              className={styles.dayHeader}
              onClick={() => setExpandedDate(expanded ? null : date)}
              aria-expanded={expanded}
            >
              <div className={styles.dayHeaderRight}>
                <span className={styles.dayDate}>{dateLabel}</span>
                <span className={styles.dateIconWrap} aria-hidden="true">
                  <BriefcaseIcon />
                </span>
              </div>

              <div className={styles.dayHeaderLeft}>
                <ChevronIcon expanded={expanded} />
                <span className={`${styles.statusBadge} ${meta.className}`}>{meta.label}</span>
              </div>
            </button>

            {expanded && (
              <div className={styles.dayBody}>
                {dayEntries.length > 0 ? (
                  <>
                    {dayEntries.map((entry) => {
                      const { clientName, projectName, taskName } = resolveNames(entry, dropdownData);
                      const editable = entry.status === 'draft' || entry.status === 'rejected';

                      return (
                        <div key={entry.id} className={styles.entryBlock}>
                          <div className={styles.entryHead}>
                            <button
                              type="button"
                              className={styles.editButton}
                              onClick={() => onEdit(entry)}
                              disabled={!editable || isLocked}
                              title={isLocked ? 'החודש נעול' : undefined}
                            >
                              <EditPencil />
                              עריכה
                            </button>
                            <span className={styles.entryTime}>{formatTime(entry.start_time)}-{formatTime(entry.end_time)}</span>
                          </div>

                          <div className={styles.entryRow}>
                            <span className={styles.entryName}>{projectName || `פרויקט #${entry.project_id}`}</span>
                            <span className={styles.entryHours}>{formatDuration(entry.duration_minutes ?? 0)} ש'</span>
                          </div>

                          {(clientName || taskName) && (
                            <div className={styles.entryRowSecondary}>
                              {clientName && <span className={styles.entrySecondaryText}>{clientName}</span>}
                              {taskName && <span className={styles.entrySecondaryText}>{taskName}</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      className={styles.addReportButton}
                      onClick={() => onAddEntry(date)}
                      disabled={isLocked}
                      title={isLocked ? 'החודש נעול' : undefined}
                    >
                      הוספת דיווח
                    </button>
                  </>
                ) : (
                  <div className={styles.emptyDayBody}>
                    <span className={styles.emptyDayText}>אין דיווחים ליום זה</span>
                    {meta.key !== 'weekend' && (
                      <button
                        type="button"
                        className={styles.addReportButton}
                        onClick={() => onAddEntry(date)}
                        disabled={isLocked}
                        title={isLocked ? 'החודש נעול' : undefined}
                      >
                        הוספת דיווח
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
