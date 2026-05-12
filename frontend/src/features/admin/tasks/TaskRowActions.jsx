function PencilIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M11.5 1.5a1.5 1.5 0 0 1 2.121 0l.879.879a1.5 1.5 0 0 1 0 2.121L5.5 13.5l-3.5.5.5-3.5 9-9Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="1.5" width="14" height="3" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2.5 4.5V13a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M6 8h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export function TaskRowActions({ task, isAdmin, onEdit, onArchive }) {
  return (
    <div className="user-row-actions">
      <button
        type="button"
        className="user-row-actions__button"
        onClick={() => onEdit(task)}
        disabled={!isAdmin}
        aria-label={`עריכת ${task.name}`}
        data-tooltip="עריכה"
      >
        <PencilIcon />
      </button>
      <button
        type="button"
        className="user-row-actions__button user-row-actions__button--danger"
        onClick={() => onArchive(task)}
        disabled={!isAdmin || task.status === 'closed'}
        aria-label={`סגירת ${task.name}`}
        data-tooltip={task.status === 'closed' ? 'המשימה כבר סגורה' : 'סגירה'}
      >
        <ArchiveIcon />
      </button>
    </div>
  );
}
