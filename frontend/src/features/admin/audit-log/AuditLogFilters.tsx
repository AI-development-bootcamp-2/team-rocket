import type { AuditLogsFilters } from '../../../api/audit-logs.api';

const ENTITY_TYPES = [
  { value: '', label: 'כל הישויות' },
  { value: 'USER', label: 'משתמש' },
  { value: 'CLIENT', label: 'לקוח' },
  { value: 'PROJECT', label: 'פרויקט' },
  { value: 'TASK', label: 'משימה' },
  { value: 'ASSIGNMENT', label: 'שיוך' },
  { value: 'TIME_ENTRY', label: 'רשומת זמן' },
  { value: 'ABSENCE', label: 'היעדרות' },
  { value: 'WEEKLY_SUBMISSION', label: 'הגשה שבועית' },
  { value: 'MONTH_LOCK', label: 'נעילת חודש' },
  { value: 'SETTING', label: 'הגדרה' },
  { value: 'HOLIDAY', label: 'חג' },
  { value: 'TIMER', label: 'טיימר' },
];

const ACTIONS = [
  { value: '', label: 'כל הפעולות' },
  { value: 'LOGIN', label: 'כניסה למערכת' },
  { value: 'CREATE', label: 'יצירה' },
  { value: 'UPDATE', label: 'עדכון' },
  { value: 'DELETE', label: 'מחיקה' },
  { value: 'SUBMIT', label: 'הגשה' },
  { value: 'APPROVE', label: 'אישור' },
  { value: 'REJECT', label: 'דחייה' },
  { value: 'LOCK', label: 'נעילה' },
  { value: 'UNLOCK', label: 'ביטול נעילה' },
  { value: 'ADMIN_EDIT', label: 'עריכת מנהל' },
  { value: 'ENTRY_CORRECTED', label: 'תיקון רשומה' },
  { value: 'EXPORT', label: 'ייצוא' },
  { value: 'PASSWORD_RESET', label: 'איפוס סיסמה' },
  { value: 'DEACTIVATE', label: 'השבתה' },
  { value: 'TIMER_AUTO_STOPPED', label: 'טיימר הופסק אוטומטית' },
  { value: 'WEEK_RESUBMITTED', label: 'הגשה מחדש' },
];

interface User {
  id: number;
  firstName: string;
  lastName: string;
}

interface AuditLogFiltersProps {
  filters: AuditLogsFilters;
  users: User[];
  onFiltersChange: (filters: AuditLogsFilters) => void;
  onSearch: () => void;
}

export function AuditLogFilters({ filters, users, onFiltersChange, onSearch }: AuditLogFiltersProps) {
  function handleChange(field: keyof AuditLogsFilters, value: string) {
    onFiltersChange({ ...filters, [field]: value });
  }

  return (
    <div className="audit-filters">
      <div className="audit-filters__row">
        <div className="audit-filters__field">
          <label className="audit-filters__label" htmlFor="audit-date-from">מתאריך</label>
          <input
            id="audit-date-from"
            type="date"
            className="audit-filters__input"
            value={filters.date_from ?? ''}
            onChange={(e) => handleChange('date_from', e.target.value)}
          />
        </div>

        <div className="audit-filters__field">
          <label className="audit-filters__label" htmlFor="audit-date-to">עד תאריך</label>
          <input
            id="audit-date-to"
            type="date"
            className="audit-filters__input"
            value={filters.date_to ?? ''}
            onChange={(e) => handleChange('date_to', e.target.value)}
          />
        </div>

        <div className="audit-filters__field">
          <label className="audit-filters__label" htmlFor="audit-user">משתמש</label>
          <select
            id="audit-user"
            className="audit-filters__select"
            value={filters.user_id ?? ''}
            onChange={(e) => handleChange('user_id', e.target.value)}
          >
            <option value="">כל המשתמשים</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
              </option>
            ))}
          </select>
        </div>

        <div className="audit-filters__field">
          <label className="audit-filters__label" htmlFor="audit-action">פעולה</label>
          <select
            id="audit-action"
            className="audit-filters__select"
            value={filters.action ?? ''}
            onChange={(e) => handleChange('action', e.target.value)}
          >
            {ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>

        <div className="audit-filters__field">
          <label className="audit-filters__label" htmlFor="audit-entity-type">ישות</label>
          <select
            id="audit-entity-type"
            className="audit-filters__select"
            value={filters.entity_type ?? ''}
            onChange={(e) => handleChange('entity_type', e.target.value)}
          >
            {ENTITY_TYPES.map((et) => (
              <option key={et.value} value={et.value}>{et.label}</option>
            ))}
          </select>
        </div>

        <button type="button" className="audit-filters__search-btn" onClick={onSearch}>
          חיפוש
        </button>
      </div>
    </div>
  );
}
