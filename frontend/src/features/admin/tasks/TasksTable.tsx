// @ts-nocheck
import { TaskRowActions } from './TaskRowActions';
import { TaskStatusBadge } from './TaskStatusBadge';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function TasksTable({ tasks, isAdmin, onEdit, onArchive, loading }) {
  return (
    <div className="users-table-card">
      <table className="users-table">
        <thead>
          <tr>
            <th>שם משימה</th>
            <th>פרויקט</th>
            <th>תאריך התחלה</th>
            <th>תאריך סיום</th>
            <th>סטטוס</th>
            <th>משתמשים משויכים</th>
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
            : tasks.map((task) => (
                <tr key={task.id}>
                  <td>{task.name}</td>
                  <td>
                    <div className="task-table__project-cell">
                      <strong>{task.projectName}</strong>
                      <span>{task.clientName}</span>
                    </div>
                  </td>
                  <td>{formatDate(task.startDate)}</td>
                  <td>{formatDate(task.endDate)}</td>
                  <td>
                    <TaskStatusBadge status={task.status} />
                  </td>
                  <td>{task.assignedUsersCount}</td>
                  <td>
                    <TaskRowActions
                      task={task}
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


