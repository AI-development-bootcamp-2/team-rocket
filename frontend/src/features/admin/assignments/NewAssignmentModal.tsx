import { useMemo, useState, FormEvent } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';

const ROWS_PER_PAGE = 12;


function buildPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current]);
  for (let d = -1; d <= 1; d++) {
    const p = current + d;
    if (p > 1 && p < total) pages.add(p);
  }
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const result: (number | string)[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('…');
    result.push(sorted[i]);
  }
  return result;
}

interface NewAssignmentModalProps {
  projects: any[];
  tasks: any[];
  users: any[];
  saving: boolean;
  isScopedUser: boolean;
  scopedProjectIds: number[] | null;
  defaultTaskId: number | null;
  onClose: () => void;
  onSubmit: (payload: { task_id: number; user_ids: number[] }) => void;
}

export function NewAssignmentModal({
  projects,
  tasks,
  users,
  saving,
  isScopedUser,
  scopedProjectIds,
  defaultTaskId,
  onClose,
  onSubmit,
}: NewAssignmentModalProps) {
  const defaultTask = defaultTaskId != null ? tasks.find((t) => t.id === defaultTaskId) : null;
  const [projectId, setProjectId] = useState(defaultTask ? String(defaultTask.projectId) : '');
  const [taskId, setTaskId] = useState(defaultTask ? String(defaultTask.id) : '');
  const [selectedUserIds, setSelectedUserIds] = useState(new Set<number>());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const visibleProjects =
    scopedProjectIds != null
      ? projects.filter((p) => scopedProjectIds.includes(p.id))
      : projects;

  const filteredTasks = tasks.filter(
    (t) => projectId !== '' && String(t.projectId) === projectId && t.status === 'open',
  );

  const selectedTask = tasks.find((t) => String(t.id) === taskId);
  const breadcrumbParts = selectedTask
    ? [selectedTask.clientName, selectedTask.projectName, selectedTask.name].filter(Boolean)
    : [];

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q) ||
        (u.employeeNumber ?? '').toLowerCase().includes(q),
    );
  }, [users, search]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ROWS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageUsers = filteredUsers.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE,
  );
  const pageNums = buildPageNumbers(currentPage, totalPages);

  function handleSearch(val: string) {
    setSearch(val);
    setPage(1);
  }

  function toggleUser(id: number) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const allSelected = filteredUsers.length > 0 && filteredUsers.every((u) => selectedUserIds.has(u.id));
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        filteredUsers.forEach((u) => next.delete(u.id));
      } else {
        filteredUsers.forEach((u) => next.add(u.id));
      }
      return next;
    });
  }

  const allFiltered =
    filteredUsers.length > 0 && filteredUsers.every((u) => selectedUserIds.has(u.id));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!taskId || selectedUserIds.size === 0) return;
    onSubmit({ task_id: Number(taskId), user_ids: Array.from(selectedUserIds) });
  }

  const canSubmit = taskId !== '' && selectedUserIds.size > 0 && !saving;

  const breadcrumbArrow = (
    <svg className="assignment-breadcrumb-arrow" width="11" height="8" viewBox="0 0 11 8" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.5 4.18164C10.7761 4.18164 11 3.95778 11 3.68164C11 3.4055 10.7761 3.18164 10.5 3.18164V3.68164V4.18164ZM0.146446 3.32809C-0.0488157 3.52335 -0.0488157 3.83993 0.146446 4.03519L3.32843 7.21717C3.52369 7.41244 3.84027 7.41244 4.03553 7.21717C4.2308 7.02191 4.2308 6.70533 4.03553 6.51007L1.20711 3.68164L4.03553 0.853214C4.2308 0.657951 4.2308 0.341369 4.03553 0.146107C3.84027 -0.0491555 3.52369 -0.0491555 3.32843 0.146107L0.146446 3.32809ZM10.5 3.68164V3.18164L0.5 3.18164V3.68164V4.18164L10.5 4.18164V3.68164Z" fill="#181818" fillOpacity="0.24"/>
    </svg>
  );

  const breadcrumbSubtitle =
    breadcrumbParts.length > 0 ? (
      <>
        <span className="assignment-breadcrumb-text">כאן תוכל לשייך עובד חדש מהמאגר לטובת</span>
        <span className="assignment-breadcrumb-pills">
          {breadcrumbParts.map((part, i) => (
            <span key={i} className="assignment-breadcrumb-pills__item">
              {i > 0 && breadcrumbArrow}
              <span className={`assignment-breadcrumb-pill assignment-breadcrumb-pill--${
                i === 0 ? 'client' : i === 1 ? 'project' : 'task'
              }`}>
                {part}
              </span>
            </span>
          ))}
        </span>
      </>
    ) : null;

  const modalIcon = (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16.0002 16.0003C19.6821 16.0003 22.6668 13.0156 22.6668 9.33366C22.6668 5.65176 19.6821 2.66699 16.0002 2.66699C12.3183 2.66699 9.3335 5.65176 9.3335 9.33366C9.3335 13.0156 12.3183 16.0003 16.0002 16.0003Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4.54688 29.3333C4.54688 24.1733 9.6802 20 16.0002 20C17.2802 20 18.5202 20.1733 19.6802 20.4933" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M29.3332 24.0003C29.3332 24.427 29.2798 24.8403 29.1732 25.2403C29.0532 25.7736 28.8399 26.2937 28.5599 26.747C27.6399 28.2937 25.9465 29.3337 23.9998 29.3337C22.6265 29.3337 21.3865 28.8136 20.4532 27.9603C20.0532 27.6136 19.7065 27.2003 19.4398 26.747C18.9465 25.947 18.6665 25.0003 18.6665 24.0003C18.6665 22.5603 19.2398 21.2404 20.1732 20.2804C21.1465 19.2804 22.5065 18.667 23.9998 18.667C25.5732 18.667 26.9998 19.347 27.9598 20.4403C28.8132 21.387 29.3332 22.6403 29.3332 24.0003Z" stroke="white" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M25.9865 23.9727H22.0132" stroke="white" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M24 22.0264V26.013" stroke="white" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  return (
    <Modal
      title="שיוך עובד חדש למשימה"
      subtitle={breadcrumbSubtitle}
      icon={modalIcon}
      onClose={onClose}
      className="assignment-modal"
      footer={
        <button
          type="submit"
          form="new-assignment-form"
          disabled={!canSubmit}
          className={`assignment-modal__submit-btn${canSubmit ? ' assignment-modal__submit-btn--active' : ''}`}
        >
          {saving ? 'שומר...' : (
            <>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 12H16" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 16V8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {`שייך עובד למשימה${selectedUserIds.size > 1 ? ` (${selectedUserIds.size})` : ''}`}
            </>
          )}
        </button>
      }
    >
      {isScopedUser && (
        <p className="assignment-scope-hint">⚠️ ניתן לשייך רק בתוך הפרויקטים המורשים לך</p>
      )}

      <form id="new-assignment-form" onSubmit={handleSubmit} className="assignment-modal__selects">
        <Select
          label="פרויקט"
          value={projectId}
          required
          onChange={(e) => {
            setProjectId(e.target.value);
            setTaskId('');
          }}
        >
          <option value="" disabled>בחר פרויקט</option>
          {visibleProjects.map((p) => (
            <option key={p.id} value={String(p.id)}>{p.name}</option>
          ))}
        </Select>

        <Select
          label="משימה"
          value={taskId}
          required
          disabled={filteredTasks.length === 0}
          onChange={(e) => setTaskId(e.target.value)}
        >
          <option value="" disabled>
            {projectId === '' ? 'בחר פרויקט תחילה' : 'בחר משימה'}
          </option>
          {filteredTasks.map((t) => (
            <option key={t.id} value={String(t.id)}>{t.name}</option>
          ))}
        </Select>
      </form>

      <div className="assignment-modal__employee-section">
        <div className="assignment-modal__employee-header">
          <p className="assignment-modal__section-label">בחר עובד מהרשימה</p>
          <div className="assignment-modal__search-wrap">
          <svg
            className="assignment-modal__search-icon"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
          >
            <circle cx="6.5" cy="6.5" r="5" stroke="#9CA3AF" strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="חיפוש לפי שם עובד"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="assignment-modal__search"
          />
          </div>
        </div>

        <div className="assignment-modal__table-wrap">
          <table className="users-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 40, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={allFiltered}
                    onChange={toggleAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th>מספר עובד</th>
                <th>שם מלא</th>
                <th>סוג</th>
                <th>אחוז משרה</th>
              </tr>
            </thead>
            <tbody>
              {pageUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: '#9CA3AF', padding: 16 }}>
                    לא נמצאו עובדים
                  </td>
                </tr>
              ) : (
                pageUsers.map((u) => {
                  const selected = selectedUserIds.has(u.id);
                  return (
                    <tr
                      key={u.id}
                      className={selected ? 'assignment-modal__row--selected' : ''}
                      onClick={() => toggleUser(u.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleUser(u.id)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ cursor: 'pointer', accentColor: '#142A3F' }}
                        />
                      </td>
                      <td>{u.id}</td>
                      <td>{u.firstName} {u.lastName}</td>
                      <td>{u.role === 'admin' ? 'מנהל' : 'עובד'}</td>
                      <td>
                        {u.employmentPercentage != null ? `${u.employmentPercentage}%` : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="assignment-pagination">
            <button
              className="assignment-pagination__btn"
              disabled={currentPage === totalPages}
              onClick={() => setPage(totalPages)}
              aria-label="עמוד אחרון"
            >
              |◀
            </button>
            <button
              className="assignment-pagination__btn"
              disabled={currentPage === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="עמוד הבא"
            >
              ◀
            </button>
            {pageNums.map((n, i) =>
              n === '…' ? (
                <span
                  key={`ellipsis-${i}`}
                  style={{ padding: '0 4px', lineHeight: '32px', fontSize: 13 }}
                >
                  …
                </span>
              ) : (
                <button
                  key={n}
                  className={`assignment-pagination__btn${n === currentPage ? ' assignment-pagination__btn--active' : ''}`}
                  onClick={() => setPage(n as number)}
                >
                  {n}
                </button>
              ),
            )}
            <button
              className="assignment-pagination__btn"
              disabled={currentPage === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="עמוד קודם"
            >
              ▶
            </button>
            <button
              className="assignment-pagination__btn"
              disabled={currentPage === 1}
              onClick={() => setPage(1)}
              aria-label="עמוד ראשון"
            >
              ▶|
            </button>
          </div>
        )}

        {selectedUserIds.size > 0 && (
          <p style={{ fontSize: 12, color: '#142A3F', marginTop: 4 }}>
            {selectedUserIds.size} עובד{selectedUserIds.size > 1 ? 'ים' : ''} נבחר
            {selectedUserIds.size > 1 ? 'ו' : ''}
          </p>
        )}
      </div>
    </Modal>
  );
}


