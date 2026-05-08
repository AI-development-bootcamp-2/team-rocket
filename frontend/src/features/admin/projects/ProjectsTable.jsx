import { ProjectRowActions } from './ProjectRowActions.jsx';
import { ProjectStatusBadge } from './ProjectStatusBadge.jsx';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function ProjectsTable({ projects, isAdmin, onEdit, onArchive, loading }) {
  return (
    <div className="users-table-card">
      <table className="users-table">
        <thead>
          <tr>
            <th>שם פרויקט</th>
            <th>לקוח</th>
            <th>מנהל ראשי</th>
            <th>תאריך התחלה</th>
            <th>תאריך סיום</th>
            <th>סטטוס</th>
            <th>פעולות</th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }, (_, i) => (
                <tr key={i}>
                  <td colSpan="7">
                    <div className="users-table__skeleton" />
                  </td>
                </tr>
              ))
            : projects.map((project) => (
                <tr key={project.id}>
                  <td>{project.name}</td>
                  <td>{project.clientName ?? project.clientId}</td>
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
    </div>
  );
}
