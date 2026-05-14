// @ts-nocheck
const STATUS_MAP = {
  true: { label: 'פעיל', className: 'user-status-badge--active' },
  false: { label: 'לא פעיל', className: 'user-status-badge--inactive' },
};

export function ProjectStatusBadge({ isActive }) {
  const config = STATUS_MAP[String(isActive)];
  return <span className={`user-status-badge ${config.className}`}>{config.label}</span>;
}

