import { useState } from 'react';
import type { AuditLogEntry } from '../../../api/audit-logs.api';

const ACTION_BADGE: Record<string, { bg: string; color: string }> = {
  LOGIN:              { bg: '#F3F4F6', color: '#374151' },
  CREATE:             { bg: '#DCFCE7', color: '#16A34A' },
  UPDATE:             { bg: '#DBEAFE', color: '#2563EB' },
  DELETE:             { bg: '#FEE2E2', color: '#EF4444' },
  SUBMIT:             { bg: '#DBEAFE', color: '#2563EB' },
  APPROVE:            { bg: '#DCFCE7', color: '#16A34A' },
  REJECT:             { bg: '#FEE2E2', color: '#EF4444' },
  LOCK:               { bg: '#F3F4F6', color: '#374151' },
  UNLOCK:             { bg: '#FEF3C7', color: '#D97706' },
  ADMIN_EDIT:         { bg: '#FEF3C7', color: '#D97706' },
  ENTRY_CORRECTED:    { bg: '#EDE9FE', color: '#7C3AED' },
  EXPORT:             { bg: '#F3F4F6', color: '#374151' },
  PASSWORD_RESET:     { bg: '#FEF3C7', color: '#D97706' },
  DEACTIVATE:         { bg: '#FEE2E2', color: '#EF4444' },
  TIMER_AUTO_STOPPED: { bg: '#F3F4F6', color: '#374151' },
  WEEK_RESUBMITTED:   { bg: '#DBEAFE', color: '#2563EB' },
};

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'כניסה', CREATE: 'יצירה', UPDATE: 'עדכון', DELETE: 'מחיקה',
  SUBMIT: 'הגשה', APPROVE: 'אישור', REJECT: 'דחייה', LOCK: 'נעילה',
  UNLOCK: 'ביטול נעילה', ADMIN_EDIT: 'עריכת מנהל', ENTRY_CORRECTED: 'תיקון רשומה',
  EXPORT: 'ייצוא', PASSWORD_RESET: 'איפוס סיסמה', DEACTIVATE: 'השבתה',
  TIMER_AUTO_STOPPED: 'טיימר הופסק', WEEK_RESUBMITTED: 'הגשה מחדש',
};

const ENTITY_LABELS: Record<string, string> = {
  USER: 'משתמש', CLIENT: 'לקוח', PROJECT: 'פרויקט', TASK: 'משימה',
  ASSIGNMENT: 'שיוך', TIME_ENTRY: 'רשומת זמן', ABSENCE: 'היעדרות',
  WEEKLY_SUBMISSION: 'הגשה שבועית', MONTH_LOCK: 'נעילת חודש',
  SETTING: 'הגדרה', HOLIDAY: 'חג', TIMER: 'טיימר',
};

interface User {
  id: number;
  firstName: string;
  lastName: string;
}

interface AuditLogTableProps {
  entries: AuditLogEntry[];
  users: User[];
  loading: boolean;
}

function ActionBadge({ action }: { action: string }) {
  const style = ACTION_BADGE[action] ?? { bg: '#F3F4F6', color: '#374151' };
  return (
    <span
      className="audit-table__badge"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {ACTION_LABELS[action] ?? action}
    </span>
  );
}

function JsonDiff({ oldValue, newValue }: { oldValue: Record<string, unknown> | null; newValue: Record<string, unknown> | null }) {
  if (!oldValue && !newValue) return <span className="audit-table__no-diff">אין נתונים</span>;

  const keys = Array.from(new Set([
    ...Object.keys(oldValue ?? {}),
    ...Object.keys(newValue ?? {}),
  ]));

  return (
    <div className="audit-table__diff">
      {keys.map((key) => {
        const before = oldValue?.[key];
        const after = newValue?.[key];
        const changed = JSON.stringify(before) !== JSON.stringify(after);
        return (
          <div key={key} className={`audit-table__diff-row${changed ? ' audit-table__diff-row--changed' : ''}`}>
            <span className="audit-table__diff-key">{key}:</span>
            {changed ? (
              <>
                <span className="audit-table__diff-old">{JSON.stringify(before) ?? '—'}</span>
                <span className="audit-table__diff-arrow">→</span>
                <span className="audit-table__diff-new">{JSON.stringify(after) ?? '—'}</span>
              </>
            ) : (
              <span className="audit-table__diff-unchanged">{JSON.stringify(before)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="audit-table__skeleton-row">
          {Array.from({ length: 6 }).map((__, j) => (
            <td key={j}><div className="audit-table__skeleton-cell" /></td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function AuditLogTable({ entries, users, loading }: AuditLogTableProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

  function formatTimestamp(ts: string) {
    const d = new Date(ts);
    return d.toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
  }

  function toggleExpand(id: number) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="audit-table-card">
      <table className="audit-table" dir="rtl">
        <thead>
          <tr className="audit-table__header-row">
            <th className="audit-table__th">תאריך ושעה</th>
            <th className="audit-table__th">משתמש</th>
            <th className="audit-table__th">פעולה</th>
            <th className="audit-table__th">ישות</th>
            <th className="audit-table__th">סיבה</th>
            <th className="audit-table__th">פרטים</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonRows />
          ) : (
            entries.map((entry) => (
              <>
                <tr
                  key={entry.id}
                  className={`audit-table__row${expandedId === entry.id ? ' audit-table__row--expanded' : ''}`}
                >
                  <td className="audit-table__td">{formatTimestamp(entry.timestamp)}</td>
                  <td className="audit-table__td">
                    {entry.actor_user_id ? (userMap.get(entry.actor_user_id) ?? `ID ${entry.actor_user_id}`) : 'מערכת'}
                  </td>
                  <td className="audit-table__td">
                    <ActionBadge action={entry.action} />
                  </td>
                  <td className="audit-table__td">
                    <span>{ENTITY_LABELS[entry.target_entity_type] ?? entry.target_entity_type}</span>
                    {entry.target_entity_id ? (
                      <span className="audit-table__entity-id"> #{entry.target_entity_id}</span>
                    ) : null}
                  </td>
                  <td className="audit-table__td audit-table__td--reason">
                    {entry.reason ?? '—'}
                  </td>
                  <td className="audit-table__td">
                    {(entry.old_value || entry.new_value) ? (
                      <button
                        type="button"
                        className="audit-table__expand-btn"
                        onClick={() => toggleExpand(entry.id)}
                        aria-expanded={expandedId === entry.id}
                      >
                        {expandedId === entry.id ? 'סגור' : 'פרטים'}
                      </button>
                    ) : (
                      <span className="audit-table__no-details">—</span>
                    )}
                  </td>
                </tr>

                {expandedId === entry.id && (
                  <tr key={`${entry.id}-expanded`} className="audit-table__expand-row">
                    <td colSpan={6} className="audit-table__expand-cell">
                      <div className="audit-table__expand-content">
                        <JsonDiff oldValue={entry.old_value} newValue={entry.new_value} />
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
