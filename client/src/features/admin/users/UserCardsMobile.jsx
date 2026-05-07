import { UserRowActions } from './UserRowActions.jsx'
import { UserStatusBadge } from './UserStatusBadge.jsx'

export function UserCardsMobile({
  users,
  currentUserId,
  onEdit,
  onToggleActive,
  onResetPassword,
  loading,
}) {
  return (
    <div className="user-cards">
      {loading
        ? Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="user-card user-card--loading">
              <div className="users-table__skeleton" />
            </div>
          ))
        : users.map((user) => (
            <article key={user.id} className="user-card">
              <div className="user-card__header">
                <div>
                  <h3 className="user-card__name">{`${user.firstName} ${user.lastName}`}</h3>
                  <p className="user-card__email">{user.email}</p>
                </div>
                <UserStatusBadge isActive={user.isActive} />
              </div>

              <div className="user-card__meta">
                <span>תפקיד</span>
                <strong>{user.role === 'admin' ? 'מנהל' : 'משתמש'}</strong>
              </div>

              <UserRowActions
                user={user}
                currentUserId={currentUserId}
                onEdit={onEdit}
                onToggleActive={onToggleActive}
                onResetPassword={onResetPassword}
              />
            </article>
          ))}
    </div>
  )
}
