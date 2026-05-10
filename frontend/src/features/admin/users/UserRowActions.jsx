function PencilIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M11.5 1.5a1.5 1.5 0 0 1 2.121 0l.879.879a1.5 1.5 0 0 1 0 2.121L5.5 13.5l-3.5.5.5-3.5 9-9Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function KeyRoundIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="5.5" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M12 8v2M14 8v1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function UserXIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M1 14c0-2.5 2.239-4.5 5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M10.5 10.5l4 4M14.5 10.5l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function UserCheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M1 14c0-2.5 2.239-4.5 5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M10 12l2 2 3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function UserRowActions({
  user,
  currentUserId,
  onEdit,
  onToggleActive,
  onResetPassword,
}) {
  const isSelf = currentUserId === user.id;
  const isInactive = !user.isActive;
  const toggleTooltip = isInactive
    ? 'הפעלה'
    : isSelf
    ? 'אי אפשר להשבית את החשבון שלך'
    : 'השבתה';

  return (
    <div className="user-row-actions">
      <button
        type="button"
        className="user-row-actions__button"
        onClick={() => onEdit(user)}
        aria-label={`עריכת ${user.firstName} ${user.lastName}`}
        data-tooltip="עריכה"
      >
        <PencilIcon />
      </button>
      <button
        type="button"
        className="user-row-actions__button user-row-actions__button--warning"
        onClick={() => onResetPassword(user)}
        aria-label={`איפוס סיסמה עבור ${user.firstName} ${user.lastName}`}
        data-tooltip="איפוס סיסמה"
      >
        <KeyRoundIcon />
      </button>
      <button
        type="button"
        className={`user-row-actions__button ${
          isInactive ? 'user-row-actions__button--success' : 'user-row-actions__button--danger'
        }`}
        onClick={() => onToggleActive(user)}
        disabled={isSelf && !isInactive}
        aria-label={`${isInactive ? 'הפעלה' : 'השבתה'} ${user.firstName} ${user.lastName}`}
        data-tooltip={toggleTooltip}
      >
        {isInactive ? <UserCheckIcon /> : <UserXIcon />}
      </button>
    </div>
  );
}
