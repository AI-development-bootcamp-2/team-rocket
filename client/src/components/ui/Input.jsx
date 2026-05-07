export function Input({ label, id, error, className = '', ...props }) {
  return (
    <label className="ui-field">
      {label ? <span className="ui-field__label">{label}</span> : null}
      <input
        id={id}
        className={`ui-input ${error ? 'ui-input--error' : ''} ${className}`.trim()}
        {...props}
      />
      {error ? <span className="ui-field__error">{error}</span> : null}
    </label>
  )
}
