import { useMemo, useState } from 'react';
import { Modal } from '../../../components/ui/Modal.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Select } from '../../../components/ui/Select.jsx';

/**
 * NewAssignmentModal
 *
 * Cascade flow: project → task, then searchable checkbox employee table.
 * Supports multi-select: multiple employees can be assigned in one action.
 *
 * props:
 *   projects         – all active projects
 *   tasks            – all open tasks
 *   users            – active users (full list for admin; minimal for flag-holder)
 *   saving           – loading state
 *   isScopedUser     – caller has canAssignProjectTasks flag (show scope hint)
 *   scopedProjectIds – null = no restriction; number[] = restrict project dropdown
 *   onClose()
 *   onSubmit({ task_id, user_ids })
 */
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
}) {
  const defaultTask = defaultTaskId != null ? tasks.find((t) => t.id === defaultTaskId) : null;
  const [projectId, setProjectId] = useState(defaultTask ? String(defaultTask.projectId) : '');
  const [taskId, setTaskId] = useState(defaultTask ? String(defaultTask.id) : '');
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());
  const [search, setSearch] = useState('');

  // Scoped users may only pick from their allowed projects
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

  const hasEmail = users.some((u) => u.email != null);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q),
    );
  }, [users, search]);

  function toggleUser(id) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedUserIds.size === filteredUsers.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(filteredUsers.map((u) => u.id)));
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!taskId || selectedUserIds.size === 0) return;
    onSubmit({ task_id: Number(taskId), user_ids: [...selectedUserIds] });
  }

  const canSubmit = taskId !== '' && selectedUserIds.size > 0 && !saving;

  return (
    <Modal
      title="שיוך עובד חדש למשימה"
      icon="+"
      onClose={onClose}
      footer={
        <Button type="submit" form="new-assignment-form" disabled={!canSubmit}>
          {saving
            ? 'שומר...'
            : `שייך עובד למשימה ⊕${selectedUserIds.size > 1 ? ` (${selectedUserIds.size})` : ''}`}
        </Button>
      }
    >
      {isScopedUser ? (
        <p className="assignment-scope-hint">⚠️ ניתן לשייך רק בתוך הפרויקטים המורשים לך</p>
      ) : null}

      <form id="new-assignment-form" onSubmit={handleSubmit} className="task-form">
        <Select
          label="פרויקט"
          value={projectId}
          required
          onChange={(e) => {
            setProjectId(e.target.value);
            setTaskId('');
          }}
        >
          <option value="" disabled>
            בחר פרויקט
          </option>
          {visibleProjects.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.name}
            </option>
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
            <option key={t.id} value={String(t.id)}>
              {t.name}
            </option>
          ))}
        </Select>
      </form>

      {breadcrumbParts.length > 0 && (
        <div className="assignment-breadcrumb" aria-label="הקשר">
          {breadcrumbParts.map((part, i) => (
            <span key={i}>
              {i > 0 && (
                <span style={{ color: '#666666', margin: '0 4px' }}>→</span>
              )}
              <span
                style={{
                  background: '#F3F4F6',
                  borderRadius: 6,
                  padding: '4px 8px',
                  fontSize: 12,
                  color: '#050804',
                }}
              >
                {part}
              </span>
            </span>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, color: '#050804' }}>
          בחר עובד מהרשימה
        </p>
        <input
          type="text"
          placeholder="חיפוש לפי שם עובד"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            height: 40,
            padding: '0 12px',
            border: '1px solid #D1D5DB',
            borderRadius: 8,
            marginBottom: 8,
            fontSize: 14,
            boxSizing: 'border-box',
          }}
        />
        <div
          style={{
            maxHeight: 280,
            overflowY: 'auto',
            border: '1px solid #E5E7EB',
            borderRadius: 8,
          }}
        >
          <table className="users-table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ background: '#1B2340', color: '#FFFFFF', height: 40 }}>
                <th style={{ width: 40, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={
                      filteredUsers.length > 0 &&
                      selectedUserIds.size === filteredUsers.length
                    }
                    onChange={toggleAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th>שם מלא</th>
                {hasEmail && <th>מייל</th>}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={hasEmail ? 3 : 2}
                    style={{ textAlign: 'center', color: '#9CA3AF', padding: 16 }}
                  >
                    לא נמצאו עובדים
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const selected = selectedUserIds.has(u.id);
                  return (
                    <tr
                      key={u.id}
                      style={{
                        height: 44,
                        background: selected ? '#EFF6FF' : undefined,
                        cursor: 'pointer',
                        borderBottom: '1px solid #E5E7EB',
                      }}
                      onClick={() => toggleUser(u.id)}
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
                      <td>
                        {u.firstName} {u.lastName}
                      </td>
                      {hasEmail && (
                        <td style={{ fontSize: 12, color: '#6B7280' }}>{u.email}</td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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
