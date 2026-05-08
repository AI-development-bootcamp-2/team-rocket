export function Spinner({ label = 'טוען...' }) {
  return (
    <div className="ui-spinner" role="status" aria-label={label}>
      <span className="ui-spinner__ring" aria-hidden="true" />
      <span className="ui-spinner__label">{label}</span>
    </div>
  );
}
