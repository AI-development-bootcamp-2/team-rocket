import { useState } from 'react';
import { ProjectRowActions } from './ProjectRowActions.jsx';
import { ProjectStatusBadge } from './ProjectStatusBadge.jsx';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function ClientGroup({ clientName, projects, isAdmin, onEdit, onArchive }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="client-group">
      <button
        type="button"
        className="client-group__header"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <span className="client-group__chevron" aria-hidden="true">
          {expanded ? '▾' : '▸'}
        </span>
        <span className="client-group__name">{clientName}</span>
        <span className="client-group__count">{projects.length}</span>
      </button>

      {expanded && (
        <table className="users-table">
          <thead>
            <tr>
              <th>שם פרויקט</th>
              <th>מנהל ראשי</th>
              <th>תאריך התחלה</th>
              <th>תאריך סיום</th>
              <th>סטטוס</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr
                key={project.id}
                className={!project.isActive ? 'users-table__row--archived' : ''}
              >
                <td>{project.name}</td>
                <td>{project.managerName ?? '—'}</td>
                <td>{formatDate(project.startDate)}</td>
                <td>{formatDate(project.endDate)}</td>
                <td>
                  <ProjectStatusBadge isActive={project.isActive} />
                </td>
                <td>
                  <ProjectRowActions
                    project={project}
                    isAdmin={isAdmin}
                    onEdit={onEdit}
                    onArchive={onArchive}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function groupByClient(projects) {
  const seen = new Map();
  const groups = [];
  for (const project of projects) {
    const key = project.clientId ?? 0;
    if (!seen.has(key)) {
      const list = [];
      seen.set(key, list);
      groups.push({
        clientId: key,
        clientName: project.clientName ?? `לקוח #${key}`,
        projects: list,
      });
    }
    seen.get(key).push(project);
  }
  return groups;
}

export function ProjectsTable({ projects, isAdmin, onEdit, onArchive, loading }) {
  if (loading) {
    return (
      <div className="users-table-card">
        <table className="users-table">
          <tbody>
            {Array.from({ length: 5 }, (_, i) => (
              <tr key={i}>
                <td colSpan="6">
                  <div className="users-table__skeleton" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const groups = groupByClient(projects);

  return (
    <div className="client-groups">
      {groups.map(({ clientId, clientName, projects: groupProjects }) => (
        <div key={clientId} className="users-table-card">
          <ClientGroup
            clientName={clientName}
            projects={groupProjects}
            isAdmin={isAdmin}
            onEdit={onEdit}
            onArchive={onArchive}
          />
        </div>
      ))}
    </div>
  );
}
