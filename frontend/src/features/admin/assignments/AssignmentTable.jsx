/**
 * AssignmentTable
 *
 * Flat table listing current assignments with an inline is_active toggle.
 *
 * props:
 *   assignments    – array of assignment response objects
 *   loading        – show skeleton rows
 *   canMutate      – admin or user+flag (controls toggle visibility)
 *   scopedProjectIds – null means no restriction; array means only those project IDs
 *   onToggle(assignmentId, newIsActive)
 */
export function AssignmentTable({ assignments, loading, canMutate, scopedProjectIds, onToggle }) {
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
            {canMutate ? <th>פעולות</th> : null}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }, (_, i) => (
                <tr key={i}>
                  <td colSpan={canMutate ? 6 : 5}>
                    <div className="users-table__skeleton" />
                  </td>
                </tr>
              ))
            : assignments.map((a) => {
                const outOfScope =
                  scopedProjectIds != null && !scopedProjectIds.includes(a.projectId);

                return (
                  <tr key={a.id} style={outOfScope ? { opacity: 0.45 } : undefined}>
                    <td>
                      {a.user.firstName} {a.user.lastName}
                    </td>
                    <td>{a.task.name}</td>
                    <td>{a.projectName}</td>
                    <td>{a.clientName}</td>
                    <td>
                      <span
                        className={`task-status-badge task-status-badge--${a.isActive ? 'open' : 'closed'}`}
                      >
                        {a.isActive ? 'פעיל' : 'לא פעיל'}
                      </span>
                    </td>
                    {canMutate ? (
                      <td>
                        {outOfScope ? (
                          <span
                            title="מחוץ לפרויקטים המורשים לך"
                            style={{ color: '#9CA3AF', fontSize: 12 }}
                          >
                            מחוץ להרשאות
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="ui-btn ui-btn--sm"
                            onClick={() => onToggle(a.id, !a.isActive)}
                          >
                            {a.isActive ? 'בטל שיוך' : 'הפעל שיוך'}
                          </button>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
        </tbody>
      </table>
    </div>
  );
}
