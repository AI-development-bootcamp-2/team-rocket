export function ProjectRowActions({ project, isAdmin, onEdit, onArchive }) {
  return (
    <div className="user-row-actions">
      <button
        type="button"
        className="user-row-actions__button"
        onClick={() => onEdit(project)}
        disabled={!isAdmin}
        title={!isAdmin ? 'Admin only' : undefined}
        aria-label={`עריכת ${project.name}`}
      >
        עריכה
      </button>
      <button
        type="button"
        className="user-row-actions__button user-row-actions__button--danger"
        onClick={() => onArchive(project)}
        disabled={!isAdmin || !project.isActive}
        title={!isAdmin ? 'Admin only' : !project.isActive ? 'פרויקט כבר מושבת' : undefined}
        aria-label={`העברה לארכיון ${project.name}`}
      >
        העברה לארכיון
      </button>
    </div>
  );
}
