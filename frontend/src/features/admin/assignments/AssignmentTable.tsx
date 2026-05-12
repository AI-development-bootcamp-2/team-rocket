// @ts-nocheck
/**
 * AssignmentTable
 *
 * Matrix view: rows = users, column groups = projects, leaf columns = tasks.
 * Each cell shows a checkbox to toggle/create the assignment for (user, task).
 * Out-of-scope project columns are greyed and cells show a disabled dash.
 *
 * props:
 *   assignments      – array of assignment response objects
 *   users            – array of user objects (rows). Falls back to assignment-derived list.
 *   tasks            – array of open task objects (defines columns). Falls back to
 *                      tasks inferred from assignments.
 *   loading          – show skeleton
 *   canMutate        – admin or user+flag (controls checkbox vs badge)
 *   scopedProjectIds – null = no restriction; number[] = only those project IDs allowed
 *   onToggle(assignmentId, newIsActive)
 */
export function AssignmentTable({ assignments, users = [], tasks = [], loading, canMutate, scopedProjectIds, onToggle }) {
  if (loading) {
    return (
      <div className="users-table-card">
        <div className="users-table__skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  // Build assignment lookup: Map<userId, Map<taskId, assignment>>
  const lookup = new Map();
  for (const a of assignments) {
    if (!lookup.has(a.userId)) lookup.set(a.userId, new Map());
    lookup.get(a.userId).set(a.taskId, a);
  }

  // Build project groups from tasks prop; fall back to deriving from assignments
  const projectMap = new Map();
  const taskSource = tasks.length > 0 ? tasks : [];
  for (const t of taskSource) {
    if (!projectMap.has(t.projectId)) {
      projectMap.set(t.projectId, { projectId: t.projectId, projectName: t.projectName, tasks: [] });
    }
    projectMap.get(t.projectId).tasks.push(t);
  }
  if (taskSource.length === 0) {
    for (const a of assignments) {
      if (!projectMap.has(a.projectId)) {
        projectMap.set(a.projectId, { projectId: a.projectId, projectName: a.projectName, tasks: [] });
      }
      const grp = projectMap.get(a.projectId);
      if (!grp.tasks.find((t) => t.id === a.taskId)) {
        grp.tasks.push({ id: a.taskId, name: a.task.name, projectId: a.projectId });
      }
    }
  }
  const projectGroups = [...projectMap.values()];

  // Build user rows
  const userRows =
    users.length > 0
      ? users
      : [...new Set(assignments.map((a) => a.userId))].map((uid) => {
          const a = assignments.find((x) => x.userId === uid);
          return { id: uid, firstName: a.user.firstName, lastName: a.user.lastName };
        });

  if (projectGroups.length === 0) {
    return (
      <div className="users-table-card">
        <p style={{ textAlign: 'center', color: '#9CA3AF', padding: 24 }}>
          אין משימות פתוחות לתצוגת מטריצה
        </p>
      </div>
    );
  }

  return (
    <div className="users-table-card" style={{ overflowX: 'auto' }}>
      <table className="users-table" style={{ minWidth: 'max-content' }}>
        <thead>
          {/* Row 1 — project group headers */}
          <tr>
            <th rowSpan={2} style={{ verticalAlign: 'bottom', whiteSpace: 'nowrap' }}>
              עובד
            </th>
            {projectGroups.map(({ projectId, projectName, tasks: ptasks }) => {
              const outOfScope =
                scopedProjectIds != null && !scopedProjectIds.includes(Number(projectId));
              return (
                <th
                  key={projectId}
                  colSpan={ptasks.length}
                  style={{
                    textAlign: 'center',
                    borderBottom: '1px solid #E5E7EB',
                    ...(outOfScope
                      ? { opacity: 0.45, background: '#F3F4F6', color: '#6B7280' }
                      : {}),
                  }}
                  title={outOfScope ? 'מחוץ לפרויקטים המורשים לך' : undefined}
                >
                  {projectName}
                </th>
              );
            })}
          </tr>
          {/* Row 2 — individual task name headers */}
          <tr>
            {projectGroups.flatMap(({ projectId, tasks: ptasks }) => {
              const outOfScope =
                scopedProjectIds != null && !scopedProjectIds.includes(Number(projectId));
              return ptasks.map((t) => (
                <th
                  key={t.id}
                  style={{
                    fontWeight: 400,
                    fontSize: 12,
                    textAlign: 'center',
                    maxWidth: 120,
                    wordBreak: 'break-word',
                    padding: '4px 6px',
                    ...(outOfScope
                      ? { opacity: 0.45, background: '#F3F4F6', color: '#9CA3AF' }
                      : {}),
                  }}
                  title={outOfScope ? 'מחוץ לפרויקטים המורשים לך' : t.name}
                >
                  {t.name}
                </th>
              ));
            })}
          </tr>
        </thead>
        <tbody>
          {userRows.map((u) => {
            const userAssignments = lookup.get(u.id) ?? new Map();
            return (
              <tr key={u.id}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {u.firstName} {u.lastName}
                </td>
                {projectGroups.flatMap(({ projectId, tasks: ptasks }) => {
                  const outOfScope =
                    scopedProjectIds != null && !scopedProjectIds.includes(Number(projectId));
                  return ptasks.map((t) => {
                    const a = userAssignments.get(t.id);
                    return (
                      <td
                        key={t.id}
                        style={{
                          textAlign: 'center',
                          ...(outOfScope ? { background: '#FAFAFA', opacity: 0.45 } : {}),
                        }}
                      >
                        {outOfScope ? (
                          <span
                            title="מחוץ לפרויקטים המורשים לך"
                            style={{ color: '#D1D5DB', fontSize: 16 }}
                          >
                            —
                          </span>
                        ) : a ? (
                          canMutate ? (
                            <input
                              type="checkbox"
                              checked={a.isActive}
                              title={a.isActive ? 'בטל שיוך' : 'הפעל שיוך'}
                              onChange={(e) => onToggle(a.id, e.target.checked)}
                              style={{ cursor: 'pointer', width: 16, height: 16 }}
                            />
                          ) : (
                            <span
                              className={`task-status-badge task-status-badge--${a.isActive ? 'open' : 'closed'}`}
                            >
                              {a.isActive ? '✓' : '✗'}
                            </span>
                          )
                        ) : (
                          <span style={{ color: '#E5E7EB', fontSize: 16 }}>—</span>
                        )}
                      </td>
                    );
                  });
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

