// @ts-nocheck
import { useState } from 'react';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';

export function ProjectForm({ id, initialValues, clients, users, onSubmit, onValuesChange }) {
  const [errors, setErrors] = useState({});

  function handleSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = (fd.get('name') ?? '').trim();
    const clientId = fd.get('client_id');
    const startDate = fd.get('start_date') || null;
    const endDate = fd.get('end_date') || null;

    const nextErrors = {};
    if (!name) nextErrors.name = 'שם הפרויקט הוא שדה חובה';
    else if (name.length > 255) nextErrors.name = 'שם הפרויקט לא יכול לעלות על 255 תווים';
    if (!clientId) nextErrors.client_id = 'יש לבחור לקוח';
    if (startDate && endDate && endDate < startDate) {
      nextErrors.end_date = 'תאריך הסיום חייב להיות אחרי תאריך ההתחלה';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({
      name,
      client_id: Number(clientId),
      manager_user_id: fd.get('manager_user_id') ? Number(fd.get('manager_user_id')) : null,
      start_date: startDate,
      end_date: endDate,
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
        {errors.name && <span className="ui-field__error">{errors.name}</span>}
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
        {errors.client_id && <span className="ui-field__error">{errors.client_id}</span>}
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
          {errors.end_date && <span className="ui-field__error">{errors.end_date}</span>}
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


