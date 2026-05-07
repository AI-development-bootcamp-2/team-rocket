export function UserRowActions({
  user,
  currentUserId,
  onEdit,
  onToggleActive,
  onResetPassword,
}) {
  const isSelf = currentUserId === user.id
  const isInactive = !user.isActive

  return (
    <div className="user-row-actions">
      <button
        type="button"
        className="user-row-actions__button"
        onClick={() => onEdit(user)}
        aria-label={`עריכת ${user.firstName} ${user.lastName}`}
      >
        ✎
      </button>
      <button
        type="button"
        className="user-row-actions__button"
        onClick={() => onResetPassword(user)}
        aria-label={`איפוס סיסמה עבור ${user.firstName} ${user.lastName}`}
      >
        ↺
      </button>
      <button
        type="button"
        className={`user-row-actions__button ${
          isInactive ? 'user-row-actions__button--success' : 'user-row-actions__button--danger'
        }`}
        onClick={() => onToggleActive(user)}
        disabled={isSelf && !isInactive}
        title={
          isInactive
            ? 'הפעלת משתמש'
            : isSelf
            ? 'Cannot deactivate your own account'
            : 'השבתת משתמש'
        }
        aria-label={`${isInactive ? 'הפעלת' : 'השבתת'} ${user.firstName} ${user.lastName}`}
      >
        {isInactive ? '↻' : '🗑'}
      </button>
    </div>
  )
}
