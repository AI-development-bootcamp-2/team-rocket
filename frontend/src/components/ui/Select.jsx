export function Select({ label, id, error, children, className = '', ...props }) {
  return (
    <label className="ui-field">
      {label ? <span className="ui-field__label">{label}</span> : null}
      <select
        id={id}
        className={`ui-select ${error ? 'ui-select--error' : ''} ${className}`.trim()}
        {...props}
      >
        {children}
      </select>
      {error ? <span className="ui-field__error">{error}</span> : null}
    </label>
  );
}
