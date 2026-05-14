// @ts-nocheck
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
      <rect x="1" y="2" width="14" height="3" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2 5v7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M6 9h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export function ProjectRowActions({ project, isAdmin, onEdit, onArchive }) {
  const archiveDisabled = !isAdmin || !project.isActive;
  const archiveTooltip = !isAdmin
    ? 'Admin only'
    : !project.isActive
    ? 'פרויקט כבר בארכיון'
    : 'העברה לארכיון';

  return (
    <div className="user-row-actions">
      <button
        type="button"
        className="user-row-actions__button"
        onClick={() => onEdit(project)}
        disabled={!isAdmin}
        aria-label={`עריכת ${project.name}`}
        data-tooltip="עריכה"
      >
        <PencilIcon />
      </button>
      <button
        type="button"
        className="user-row-actions__button user-row-actions__button--danger"
        onClick={() => onArchive(project)}
        disabled={archiveDisabled}
        aria-label={`העברה לארכיון ${project.name}`}
        data-tooltip={archiveTooltip}
      >
        <ArchiveIcon />
      </button>
    </div>
  );
}

