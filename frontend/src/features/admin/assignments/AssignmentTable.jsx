import { useMemo, useState, useEffect } from 'react';

const PAGE_SIZE = 10;
const MAX_PILLS = 4;

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  for (let i = 1; i <= totalPages; i++) pages.push(i);

  return (
    <div className="assignment-pagination">
      <button
        className="assignment-pagination__btn"
        onClick={() => onChange(1)}
        disabled={page === 1}
        aria-label="עמוד ראשון"
      >
        ⊣
      </button>
      <button
        className="assignment-pagination__btn"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        aria-label="עמוד קודם"
      >
        ‹
      </button>
      {pages.map((p) => (
        <button
          key={p}
          className={`assignment-pagination__btn${p === page ? ' assignment-pagination__btn--active' : ''}`}
          onClick={() => onChange(p)}
          aria-current={p === page ? 'page' : undefined}
        >
          {p}
        </button>
      ))}
      <button
        className="assignment-pagination__btn"
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        aria-label="עמוד הבא"
      >
        ›
      </button>
      <button
        className="assignment-pagination__btn"
        onClick={() => onChange(totalPages)}
        disabled={page === totalPages}
        aria-label="עמוד אחרון"
      >
        ⊢
      </button>
    </div>
  );
}

export function AssignmentTable({ assignments, tasks = [], loading, canMutate, search = '', onToggle, onEdit }) {
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    const taskGroups = new Map();
    for (const a of assignments) {
      if (!taskGroups.has(a.taskId)) {
        const task = tasks.find((t) => t.id === a.taskId);
        taskGroups.set(a.taskId, {
          taskId: a.taskId,
          taskName: a.task?.name ?? task?.name ?? '',
          projectName: a.projectName ?? task?.projectName ?? '',
          clientName: task?.clientName ?? a.clientName ?? '',
          assignments: [],
        });
      }
      taskGroups.get(a.taskId).assignments.push(a);
    }
    return [...taskGroups.values()];
  }, [assignments, tasks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.taskName.toLowerCase().includes(q) ||
        row.projectName.toLowerCase().includes(q) ||
        row.clientName.toLowerCase().includes(q) ||
        row.assignments.some((a) =>
          `${a.user?.firstName ?? ''} ${a.user?.lastName ?? ''}`.toLowerCase().includes(q),
        ),
    );
  }, [rows, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) {
    return (
      <div className="users-table-card">
        <div className="users-table__skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="users-table-card">
        <p style={{ textAlign: 'center', color: '#9CA3AF', padding: 24 }}>אין שיוכים</p>
      </div>
    );
  }

  function handleDeleteRow(row) {
    for (const a of row.assignments) {
      if (a.isActive) onToggle(a.id, false);
    }
  }

  return (
    <div className="users-table-card">
      <div style={{ overflowX: 'auto' }}>
        <table className="users-table">
          <thead>
            <tr>
              <th>שם לקוח</th>
              <th>שם פרויקט</th>
              <th>שם המשימה</th>
              <th>שמות העובדים המשויכים</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: '#9CA3AF', padding: 24 }}>
                  לא נמצאו תוצאות לחיפוש
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr key={row.taskId}>
                  <td>{row.clientName}</td>
                  <td>{row.projectName}</td>
                  <td>{row.taskName}</td>
                  <td>
                    <div className="assignment-pills">
                      {row.assignments.slice(0, MAX_PILLS).map((a) => (
                        <span key={a.id} className="assignment-pill">
                          {a.user?.firstName} {a.user?.lastName}
                        </span>
                      ))}
                      {row.assignments.length > MAX_PILLS && (
                        <span className="assignment-pill assignment-pill--overflow">
                          +{row.assignments.length - MAX_PILLS}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="assignment-row-actions">
                      {canMutate && (
                        <>
                          <button
                            type="button"
                            className="assignment-action-btn assignment-action-btn--edit"
                            onClick={() => onEdit(row.taskId)}
                            title="עריכה"
                            aria-label="עריכת שיוך"
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                              <path d="M11.333 2a1.886 1.886 0 0 1 2.667 2.667L4.889 13.778l-3.556.888.889-3.555L11.333 2Z" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="assignment-action-btn assignment-action-btn--delete"
                            onClick={() => handleDeleteRow(row)}
                            title="ביטול שיוכים"
                            aria-label="ביטול כל שיוכי המשימה"
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                              <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 0 1 1.334-1.334h2.666a1.333 1.333 0 0 1 1.334 1.334V4M13.333 4l-.889 9.333A1.333 1.333 0 0 1 11.111 14.667H4.89a1.333 1.333 0 0 1-1.333-1.334L2.667 4" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}
