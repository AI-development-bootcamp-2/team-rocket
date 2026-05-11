import { useState } from 'react';
import { deleteTimeEntry } from '../../api/timeEntries.api';
import styles from './ExistingEntriesList.module.css';

const LOCATION_LABELS = { office: 'משרד', home: 'בית', client: 'לקוח' };
const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function formatTime(t) {
  if (!t) return '—';
  return String(t).slice(0, 5);
}

function formatDuration(minutes) {
  if (!minutes && minutes !== 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

function getStatusColor(totalMinutes, standardMinutes) {
  if (!totalMinutes) return styles.statusMissing;
  if (totalMinutes >= standardMinutes) return styles.statusComplete;
  if (totalMinutes > 0) return styles.statusPartial;
  return styles.statusMissing;
}

function resolveNames(entry, dropdownData) {
  if (!dropdownData?.clients) return { clientName: null, projectName: null, taskName: null };
  for (const client of dropdownData.clients) {
    if (client.id === entry.client_id) {
      for (const project of client.projects) {
        if (project.id === entry.project_id) {
          for (const task of project.tasks) {
            if (task.id === entry.task_id) {
              return {
                clientName: client.name,
                projectName: project.name,
                taskName: task.name,
              };
            }
          }
          return { clientName: client.name, projectName: project.name, taskName: null };
        }
      }
      return { clientName: client.name, projectName: null, taskName: null };
    }
  }
  return { clientName: null, projectName: null, taskName: null };
}

function DeleteConfirmDialog({ entry, onConfirm, onCancel, loading }) {
  return (
    <div className={styles.dialogBackdrop} role="presentation">
      <div className={styles.dialog} role="alertdialog" aria-modal="true">
        <h3 className={styles.dialogTitle}>מחיקת דיווח</h3>
        <p className={styles.dialogBody}>
          האם אתה בטוח שברצונך למחוק את הדיווח?
          <br />
          <strong>{formatTime(entry.start_time)} – {formatTime(entry.end_time)}</strong>
        </p>
        <div className={styles.dialogActions}>
          <button className={styles.dialogCancelBtn} onClick={onCancel} disabled={loading} type="button">
            ביטול
          </button>
          <button className={styles.dialogDeleteBtn} onClick={onConfirm} disabled={loading} type="button">
            {loading ? 'מוחק…' : 'מחק'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ExistingEntriesList({ entries, dropdownData, loading, onEdit, onRefresh, standardHours = 9 }) {
  const [deletingId, setDeletingId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [expandedDate, setExpandedDate] = useState(null);

  async function handleDeleteConfirm() {
    setDeleteLoading(true);
    try {
      await deleteTimeEntry(deletingId);
      setDeletingId(null);
      onRefresh();
    } catch (err) {
      // error handled by parent
    } finally {
      setDeleteLoading(false);
    }
  }

  if (loading) {
    return <div className={styles.list} aria-busy="true" aria-label="טוען דיווחים" />;
  }

  if (!entries || entries.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}>📋</span>
        <p className={styles.emptyTitle}>אין דיווחים ליום זה</p>
        <p className={styles.emptyBody}>לחץ על "הוספת דיווח" כדי לדווח שעות</p>
      </div>
    );
  }

  // Group entries by date
  const entriesByDate = {};
  entries.forEach((entry) => {
    if (!entriesByDate[entry.date]) {
      entriesByDate[entry.date] = [];
    }
    entriesByDate[entry.date].push(entry);
  });

  const sortedDates = Object.keys(entriesByDate).sort().reverse();

  const entryBeingDeleted = deletingId ? entries.find((e) => e.id === deletingId) : null;

  return (
    <>
      <div className={styles.list}>
        {sortedDates.map((date) => {
          const dayEntries = entriesByDate[date];
          const totalMinutes = dayEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
          const standardMinutes = standardHours * 60;

          const dateObj = new Date(date + 'T00:00:00');
          const dayName = HE_DAYS[dateObj.getDay()];
          const dateStr = `${dateObj.getDate()}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
          const isExpanded = expandedDate === date;

          return (
            <div key={date} className={styles.daySection}>
              {/* Day header (collapsible) */}
              <button
                type="button"
                className={styles.dayHeader}
                onClick={() => setExpandedDate(isExpanded ? null : date)}
                aria-expanded={isExpanded}
              >
                {/* Left: chevron */}
                <span className={`${styles.chevron} ${isExpanded ? styles.expanded : ''}`}>
                  ‹
                </span>

                {/* Center: status badge + location badge + project count */}
                <div className={styles.dayHeaderCenter}>
                  <span className={`${styles.statusBadge} ${getStatusColor(totalMinutes, standardMinutes)}`}>
                    {formatDuration(totalMinutes)}
                  </span>
                </div>

                {/* Right: date + day name + calendar icon */}
                <div className={styles.dayHeaderRight}>
                  <span className={styles.dateText}>
                    {dayName} {dateStr}
                  </span>
                  <span className={styles.dateIcon}>📅</span>
                </div>
              </button>

              {/* Expanded entries */}
              {isExpanded && (
                <div className={styles.dayEntriesContainer}>
                  {dayEntries.map((entry) => {
                    const { projectName, clientName } = resolveNames(entry, dropdownData);
                    const editable = entry.status === 'draft' || entry.status === 'rejected';

                    return (
                      <div key={entry.id} className={styles.entryRow}>
                        <div className={styles.entryLeft}>
                          <button
                            className={styles.editLink}
                            onClick={() => onEdit(entry)}
                            disabled={!editable}
                            type="button"
                          >
                            ✏️
                          </button>
                          <span className={styles.timeRange}>
                            {formatTime(entry.start_time)}–{formatTime(entry.end_time)}
                          </span>
                        </div>

                        <div className={styles.entryCenter}>
                          <span className={styles.projectNameText}>
                            {projectName || `פרויקט #${entry.project_id}`}
                          </span>
                          {clientName && (
                            <span className={styles.clientNameText}>{clientName}</span>
                          )}
                        </div>

                        <div className={styles.entryRight}>
                          {entry.location && (
                            <span className={styles.locationBadge}>
                              {LOCATION_LABELS[entry.location]}
                            </span>
                          )}
                          <button
                            className={styles.deleteLink}
                            onClick={() => setDeletingId(entry.id)}
                            disabled={!editable}
                            type="button"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {entryBeingDeleted && (
        <DeleteConfirmDialog
          entry={entryBeingDeleted}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingId(null)}
          loading={deleteLoading}
        />
      )}
    </>
  );
}
