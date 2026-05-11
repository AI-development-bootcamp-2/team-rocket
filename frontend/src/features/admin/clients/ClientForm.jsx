import { useState, useEffect } from 'react';

export function ClientForm({ id, mode = 'create', initialValues, onSubmit, onNameChange }) {
  const v = initialValues ?? {};
  const [active, setActive] = useState(v.is_active ?? true);
  const isEdit = mode === 'edit';

  useEffect(() => {
    setActive(v.is_active ?? true);
  }, [v.is_active]);

  function handleSubmit(event) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    onSubmit({
      name: fd.get('name')?.toString().trim() ?? '',
      contact_info: fd.get('contact_info')?.toString().trim() || null,
      is_active: isEdit ? active : true,
    });
  }

  return (
    <form id={id} className="client-form" onSubmit={handleSubmit} noValidate>
      <label className="client-form__field">
        <span className="client-form__label">שם הלקוח</span>
        <input
          type="text"
          name="name"
          className="client-form__input"
          placeholder="מה שם הלקוח"
          defaultValue={v.name ?? ''}
          required
          autoFocus
          onChange={(e) => onNameChange?.(e.target.value)}
        />
      </label>

      <label className="client-form__field">
        <span className="client-form__label">פרטי קשר</span>
        <textarea
          name="contact_info"
          className="client-form__textarea"
          placeholder="פרטי קשר של הלקוח"
          defaultValue={v.contact_info ?? ''}
        />
      </label>

      {isEdit && (
        <div className="client-form__field client-form__field--row">
          <span className="client-form__label">סטטוס לקוח</span>
          <label className="client-form__toggle">
            <input
              type="checkbox"
              className="client-form__toggle-input"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            <span className="client-form__toggle-track" aria-hidden="true" />
            <span className="client-form__toggle-label">{active ? 'פעיל' : 'לא פעיל'}</span>
          </label>
        </div>
      )}
    </form>
  );
}
