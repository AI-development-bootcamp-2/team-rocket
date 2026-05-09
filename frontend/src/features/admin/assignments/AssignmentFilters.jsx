import { Select } from '../../../components/ui/Select.jsx';

/**
 * AssignmentFilters
 *
 * props:
 *   projects       – full list of projects available to the caller
 *   projectId      – current project filter value ('all' or numeric string)
 *   users          – list of users for the user filter (admin only)
 *   userId         – current user filter value ('all' or numeric string)
 *   isAdmin        – whether to show the user filter
 *   isScopedUser   – caller has canAssignProjectTasks flag (show scope hint)
 *   onProjectChange, onUserChange
 */
export function AssignmentFilters({
  projects,
  projectId,
  users,
  userId,
  isAdmin,
  isScopedUser,
  onProjectChange,
  onUserChange,
}) {
  return (
    <section className="user-filters">
      <div className="user-filters__select">
        <Select
          label="פרויקט"
          value={projectId}
          onChange={(e) => onProjectChange(e.target.value)}
        >
          <option value="all">כל הפרויקטים</option>
          {projects.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>

      {(isAdmin || isScopedUser) && users.length > 0 ? (
        <div className="user-filters__select">
          <Select
            label="עובד"
            value={userId}
            onChange={(e) => onUserChange(e.target.value)}
          >
            <option value="all">כל העובדים</option>
            {users.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {u.firstName} {u.lastName}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      {isScopedUser ? (
        <p className="assignment-scope-hint">
          ⚠️ ניתן לשייך רק בתוך הפרויקטים המורשים לך
        </p>
      ) : null}
    </section>
  );
}
