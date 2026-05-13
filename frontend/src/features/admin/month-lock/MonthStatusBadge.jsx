function getBadgeConfig(isLocked, unapprovedWeekCount) {
  if (!isLocked) return { label: 'פתוח', className: 'month-status-badge--open' };
  if (unapprovedWeekCount > 0) return { label: 'חלקית', className: 'month-status-badge--partial' };
  return { label: 'נעול 🔒', className: 'month-status-badge--locked' };
}

export function MonthStatusBadge({ isLocked, unapprovedWeekCount = 0 }) {
  const config = getBadgeConfig(isLocked, unapprovedWeekCount);
  return <span className={`month-status-badge ${config.className}`}>{config.label}</span>;
}
