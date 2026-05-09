/**
 * AssignmentTable
 *
 * User-grouped table: each user occupies one or more rows (one per assignment).
 * Users with no assignments show a single "אין שיוכים" row.
 * Active/inactive toggling uses a checkbox control.
 * Out-of-scope assignments (scoped-user) are greyed out with a tooltip.
 *
 * props:
 *   assignments      – array of assignment response objects
 *   users            – array of user objects (admin / canMutate); used to show
 *                      per-user empty rows. Falls back to assignment-derived list.
 *   loading          – show skeleton rows
 *   canMutate        – admin or user+flag (controls checkbox visibility)
 *   scopedProjectIds – null = no restriction; array = only those project IDs allowed
 *   onToggle(assignmentId, newIsActive)
 */
export function AssignmentTable({ assignments, users = [], loading, canMutate, scopedProjectIds, onToggle }) {
  if (loading) {
    return (
      <div className="users-table-card">
        <table className="users-table">
          <thead>
            <tr>
              <th>עובד</th>
              <th>משימה</th>
              <th>פרויקט</th>
              <th>לקוח</th>
              <th>פעיל</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }, (_, i) => (
              <tr key={i}>
                <td colSpan={5}>
                  <div className="users-table__skeleton" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Index assignments by user_id
  const byUser = new Map();
  for (const a of assignments) {
    if (!byUser.has(a.userId)) byUser.set(a.userId, []);
    byUser.get(a.userId).push(a);
  }

  // If the full users list is available, show every user (including those with no assignments).
  // Otherwise fall back to the users inferred from the assignments array.
  const userRows =
    users.length > 0
      ? users.map((u) => ({
          id: u.id,
          name: `${u.firstName} ${u.lastName}`,
          items: byUser.get(u.id) ?? [],
        }))
      : [...byUser.entries()].map(([id, items]) => ({
          id,
          name: `${items[0].user.firstName} ${items[0].user.lastName}`,
          items,
        }));

  return (
    <div className="users-table-card">
      <table className="users-table">
        <thead>
          <tr>
            <th>עובד</th>
            <th>משימה</th>
            <th>פרויקט</th>
            <th>לקוח</th>
            <th>פעיל</th>
          </tr>
        </thead>
        <tbody>
          {userRows.map(({ id, name, items }) => {
            const userGroupBorder = { borderTop: '2px solid #E5E7EB' };

            // User has no assignments — show a single empty row
            if (items.length === 0) {
              return (
                <tr key={`empty-${id}`} style={userGroupBorder}>
                  <td>{name}</td>
                  <td colSpan={4} style={{ color: '#9CA3AF', fontStyle: 'italic' }}>
                    אין שיוכים
                  </td>
                </tr>
              );
            }

            // User has assignments — one row per assignment
            return items.map((a, i) => {
              const outOfScope =
                scopedProjectIds != null && !scopedProjectIds.includes(a.projectId);

              return (
                <tr
                  key={a.id}
                  style={{
                    ...(outOfScope ? { opacity: 0.45 } : {}),
                    ...(i === 0 ? userGroupBorder : {}),
                  }}
                >
                  {/* Only the first row of each user group shows the name */}
                  <td>{i === 0 ? name : ''}</td>
                  <td>{a.task.name}</td>
                  <td>{a.projectName}</td>
                  <td>{a.clientName}</td>
                  <td>
                    {outOfScope ? (
                      <span
                        title="מחוץ לפרויקטים המורשים לך"
                        style={{ color: '#9CA3AF', fontSize: 12 }}
                      >
                        מחוץ להרשאות
                      </span>
                    ) : canMutate ? (
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
                        {a.isActive ? 'פעיל' : 'לא פעיל'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            });
          })}
        </tbody>
      </table>
    </div>
  );
}
