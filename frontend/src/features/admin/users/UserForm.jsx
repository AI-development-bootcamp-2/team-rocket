import { useMemo, useState } from 'react';
import { Input } from '../../../components/ui/Input.jsx';
import { Select } from '../../../components/ui/Select.jsx';
import { getInitialUserFormState } from './userFormState.js';
import { EMAIL_RE, validatePasswordStrength } from '../../../utils/validation';


export function UserForm({
  mode,
  user,
  permissionFlag,
  onSubmit,
}) {
  const [form, setForm] = useState(getInitialUserFormState(user, permissionFlag));

  const errors = useMemo(() => {
    const nextErrors = {
      first_name: form.first_name.trim() ? '' : 'שדה חובה',
      last_name: form.last_name.trim() ? '' : 'שדה חובה',
      email: form.email.trim() ? (EMAIL_RE.test(form.email.trim()) ? '' : 'כתובת אימייל לא תקינה') : 'שדה חובה',
      password:
        mode === 'create'
          ? form.password.trim()
            ? validatePasswordStrength(form.password, form.email.trim())
              ? ''
              : 'הסיסמה חייבת לכלול אות גדולה, אות קטנה, ספרה, תו מיוחד ולפחות 8 תווים'
            : 'שדה חובה'
          : '',
      employment_percentage:
        form.employment_percentage === ''
          ? ''
          : Number(form.employment_percentage) >= 0 && Number(form.employment_percentage) <= 100
            ? ''
            : 'יש להזין ערך בין 0 ל-100',
    };

    return nextErrors;
  }, [form, mode]);

  const hasErrors = Object.values(errors).some(Boolean);

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (hasErrors) return;

    onSubmit({
      ...form,
      employment_percentage:
        form.employment_percentage === '' ? '' : Number.parseInt(form.employment_percentage, 10),
      daily_hours_override:
        form.daily_hours_override === '' ? '' : Number.parseInt(form.daily_hours_override, 10),
    });
  }

  return (
    <form id="user-form" className="user-form" onSubmit={handleSubmit}>
      <div className="user-form__grid">
        <Input
          label="שם פרטי"
          value={form.first_name}
          error={errors.first_name}
          onChange={(event) => setField('first_name', event.target.value)}
        />
        <Input
          label="שם משפחה"
          value={form.last_name}
          error={errors.last_name}
          onChange={(event) => setField('last_name', event.target.value)}
        />
        <Input
          label="אימייל"
          type="email"
          value={form.email}
          error={errors.email}
          onChange={(event) => setField('email', event.target.value)}
        />
        <Select
          label="תפקיד"
          value={form.role}
          onChange={(event) => setField('role', event.target.value)}
        >
          <option value="user">משתמש</option>
          <option value="admin">מנהל מערכת</option>
        </Select>

        {mode === 'create' ? (
          <div className="user-form__full">
            <Input
              label="סיסמה ראשונית"
              type="password"
              value={form.password}
              error={errors.password}
              onChange={(event) => setField('password', event.target.value)}
            />
            <p className="user-form__hint">
              הסיסמה חייבת לכלול לפחות 8 תווים, אות גדולה, אות קטנה, מספר ותו מיוחד.
            </p>
          </div>
        ) : null}

      </div>

      <section className="user-form__section">
        <header className="user-form__section-header">
          <h3 className="user-form__section-title">פרטי פרופיל נוספים</h3>
        </header>

        <div className="user-form__grid">
          <Input
            label="אחוז משרה"
            type="number"
            min="0"
            max="100"
            value={form.employment_percentage}
            error={errors.employment_percentage}
            onChange={(event) => setField('employment_percentage', event.target.value)}
          />
          <Input
            label="שעות יומיות"
            type="number"
            min="0"
            value={form.daily_hours_override}
            onChange={(event) => setField('daily_hours_override', event.target.value)}
          />
        </div>
      </section>

    </form>
  );
}
