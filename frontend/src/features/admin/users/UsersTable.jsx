import { UserRowActions } from './UserRowActions.jsx';
import { UserStatusBadge } from './UserStatusBadge.jsx';

export function UsersTable({
  users,
  currentUserId,
  onEdit,
  onToggleActive,
  onResetPassword,
  loading,
}) {
  return (
    <div className="users-table-card">
      <table className="users-table">
        <thead>
          <tr>
            <th>שם מלא</th>
            <th>אימייל</th>
            <th>תפקיד</th>
            <th>סטטוס</th>
            <th>פעולות</th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 6 }, (_, index) => (
                <tr key={index}>
                  <td colSpan="5">
                    <div className="users-table__skeleton" />
                  </td>
                </tr>
              ))
            : users.map((user) => (
                <tr key={user.id}>
                  <td>{`${user.firstName} ${user.lastName}`}</td>
                  <td className="users-table__email">{user.email}</td>
                  <td>{user.role === 'admin' ? 'מנהל מערכת' : 'משתמש'}</td>
                  <td>
                    <UserStatusBadge isActive={user.isActive} />
                  </td>
                  <td>
                    <UserRowActions
                      user={user}
                      currentUserId={currentUserId}
                      onEdit={onEdit}
                      onToggleActive={onToggleActive}
                      onResetPassword={onResetPassword}
                    />
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
