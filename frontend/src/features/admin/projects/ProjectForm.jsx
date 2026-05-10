import { Input } from '../../../components/ui/Input.jsx';
import { Select } from '../../../components/ui/Select.jsx';

export function ProjectForm({ id, initialValues, clients, users, onSubmit, onValuesChange }) {
  function handleSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({
      name: fd.get('name'),
      client_id: Number(fd.get('client_id')),
      manager_user_id: fd.get('manager_user_id') ? Number(fd.get('manager_user_id')) : null,
      start_date: fd.get('start_date') || null,
      end_date: fd.get('end_date') || null,
      description: fd.get('description') || null,
    });
  }

  function handleChange(e) {
    const fd = new FormData(e.currentTarget);
    const name = (fd.get('name') ?? '').trim();
    const clientId = fd.get('client_id');
    onValuesChange?.(Boolean(name && clientId));
  }

  const v = initialValues ?? {};

  return (
    <form id={id} onSubmit={handleSubmit} onChange={handleChange} noValidate>
      <div className="user-form__field">
        <Input
          label="שם הפרויקט"
          name="name"
          placeholder="צור שם לפרויקט"
          defaultValue={v.name ?? ''}
          required
        />
      </div>

      <div className="user-form__field">
        <Select label="שם הלקוח" name="client_id" defaultValue={v.clientId ?? ''} required>
          <option value="" disabled>מה שם הלקוח</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="user-form__field">
        <Select label="שייך מנהל ראשי לפרויקט" name="manager_user_id" defaultValue={v.managerUserId ?? ''}>
          <option value="">בחר מנהל</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {`${u.firstName} ${u.lastName}`}
            </option>
          ))}
        </Select>
      </div>

      <div className="user-form__row">
        <div className="user-form__field">
          <Input
            label="תאריך התחלה"
            name="start_date"
            type="date"
            defaultValue={v.startDate ?? ''}
          />
        </div>
        <span className="project-date-sep">—</span>
        <div className="user-form__field">
          <Input
            label="תאריך סיום"
            name="end_date"
            type="date"
            defaultValue={v.endDate ?? ''}
          />
        </div>
      </div>

      <div className="user-form__field">
        <label className="ui-field">
          <span className="ui-field__label">תאור הפרויקט</span>
          <textarea
            name="description"
            className="ui-input"
            placeholder="תאר בקצרה את הפרויקט"
            style={{ height: 114, resize: 'none' }}
            defaultValue={v.description ?? ''}
          />
        </label>
      </div>
    </form>
  );
}
