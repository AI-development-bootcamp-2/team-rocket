export function UserRowActions({
  user,
  currentUserId,
  onEdit,
  onToggleActive,
  onResetPassword,
}) {
  const isSelf = currentUserId === user.id;
  const isInactive = !user.isActive;

  return (
    <div className="user-row-actions">
      <button
        type="button"
        className="user-row-actions__button"
        onClick={() => onEdit(user)}
        aria-label={`עריכת ${user.firstName} ${user.lastName}`}
      >
        עריכה
      </button>
      <button
        type="button"
        className="user-row-actions__button"
        onClick={() => onResetPassword(user)}
        aria-label={`איפוס סיסמה עבור ${user.firstName} ${user.lastName}`}
      >
        איפוס סיסמה
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
            ? 'אי אפשר להשבית את החשבון שלך'
            : 'השבתת משתמש'
        }
        aria-label={`${isInactive ? 'הפעלה' : 'השבתה'} ${user.firstName} ${user.lastName}`}
      >
        {isInactive ? 'הפעלה' : 'השבתה'}
      </button>
    </div>
  );
}
