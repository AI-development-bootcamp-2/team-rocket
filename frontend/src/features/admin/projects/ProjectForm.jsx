import { Input } from '../../../components/ui/Input.jsx';
import { Select } from '../../../components/ui/Select.jsx';

export function ProjectForm({ id, initialValues, clients, users, onSubmit }) {
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

  const v = initialValues ?? {};

  return (
    <form id={id} onSubmit={handleSubmit} noValidate>
      <div className="user-form__field">
        <Input
          label="שם הפרויקט"
          name="name"
          defaultValue={v.name ?? ''}
          required
        />
      </div>

      <div className="user-form__field">
        <Select label="לקוח" name="client_id" defaultValue={v.clientId ?? ''} required>
          <option value="" disabled>
            בחר לקוח
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="user-form__field">
        <Select label="מנהל ראשי" name="manager_user_id" defaultValue={v.managerUserId ?? ''}>
          <option value="">— ללא מנהל —</option>
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
        <label className="ui-input__label">תיאור הפרויקט</label>
        <textarea
          name="description"
          className="ui-input__control"
          style={{ minHeight: 80, resize: 'vertical' }}
          defaultValue={v.description ?? ''}
        />
      </div>
    </form>
  );
}
