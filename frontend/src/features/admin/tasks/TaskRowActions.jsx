export function TaskRowActions({ task, isAdmin, onEdit, onArchive }) {
  return (
    <div className="user-row-actions">
      <button
        type="button"
        className="user-row-actions__button"
        onClick={() => onEdit(task)}
        disabled={!isAdmin}
        title={!isAdmin ? 'Admin only' : undefined}
        aria-label={`עריכת ${task.name}`}
      >
        עריכה
      </button>
      <button
        type="button"
        className="user-row-actions__button user-row-actions__button--danger"
        onClick={() => onArchive(task)}
        disabled={!isAdmin || task.status === 'closed'}
        title={!isAdmin ? 'Admin only' : task.status === 'closed' ? 'המשימה כבר סגורה' : undefined}
        aria-label={`סגירת ${task.name}`}
      >
        סגירה
      </button>
    </div>
  );
}
