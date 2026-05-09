const STATUS_MAP = {
  open: { label: 'פעיל', className: 'user-status-badge--active' },
  closed: { label: 'סגור', className: 'user-status-badge--inactive' },
};

export function TaskStatusBadge({ status }) {
  const config = STATUS_MAP[status] ?? STATUS_MAP.open;
  return <span className={`user-status-badge ${config.className}`}>{config.label}</span>;
}
