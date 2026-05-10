export function ClientForm({ id, initialValues, onSubmit }) {
  function handleSubmit(event) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    onSubmit({
      name: fd.get('name')?.toString().trim() ?? '',
      contact_info: fd.get('contact_info')?.toString().trim() || null,
    });
  }

  const v = initialValues ?? {};

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
        />
      </label>

      <label className="client-form__field">
        <span className="client-form__label">תאור הלקוח</span>
        <textarea
          name="contact_info"
          className="client-form__textarea"
          placeholder="תאר בקצרה את הלקוח"
          defaultValue={v.contactInfo ?? ''}
        />
      </label>
    </form>
  );
}
