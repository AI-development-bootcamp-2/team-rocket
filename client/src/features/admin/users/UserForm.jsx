import { useMemo, useState } from 'react'
import { Input } from '../../../components/ui/Input.jsx'
import { Select } from '../../../components/ui/Select.jsx'
import { getInitialUserFormState } from './userFormState.js'

const EMPLOYMENT_TYPES = [
  { value: '', label: 'ללא בחירה' },
  { value: 'full_time', label: 'משרה מלאה' },
  { value: 'part_time', label: 'משרה חלקית' },
  { value: 'contractor', label: 'קבלן' },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validatePasswordStrength(password, email) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
    /[!@#$%^&*()\-_=+[{\]};:'",.<>/?\\|`~]/.test(password),
    password.toLowerCase() !== email.toLowerCase(),
  ]

  return checks.every(Boolean)
}

export function UserForm({
  mode,
  user,
  permissionFlag,
  projects,
  loadingMeta,
  onSubmit,
}) {
  const [form, setForm] = useState(getInitialUserFormState(user, permissionFlag))

  const errors = useMemo(() => {
    const nextErrors = {
      first_name: form.first_name.trim() ? '' : 'שדה חובה',
      last_name: form.last_name.trim() ? '' : 'שדה חובה',
      email: form.email.trim() ? (EMAIL_RE.test(form.email.trim()) ? '' : 'אימייל לא תקין') : 'שדה חובה',
      password:
        mode === 'create'
          ? form.password.trim()
            ? validatePasswordStrength(form.password, form.email.trim())
              ? ''
              : 'סיסמה חייבת לכלול 8 תווים, אות גדולה, אות קטנה, מספר ותו מיוחד'
            : 'שדה חובה'
          : '',
      employment_percentage:
        form.employment_percentage === ''
          ? ''
          : Number(form.employment_percentage) >= 0 && Number(form.employment_percentage) <= 100
            ? ''
            : 'יש להזין ערך בין 0 ל-100',
      scoped_project_ids:
        form.can_assign_project_tasks && form.scoped_project_ids.length === 0
          ? 'יש לבחור לפחות פרויקט אחד'
          : '',
    }

    return nextErrors
  }, [form, mode])

  const hasErrors = Object.values(errors).some(Boolean)

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  function toggleProject(projectId) {
    setForm((current) => {
      const exists = current.scoped_project_ids.includes(projectId)
      return {
        ...current,
        scoped_project_ids: exists
          ? current.scoped_project_ids.filter((id) => id !== projectId)
          : [...current.scoped_project_ids, projectId],
      }
    })
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (hasErrors) return

    onSubmit({
      ...form,
      employment_percentage:
        form.employment_percentage === '' ? '' : Number.parseInt(form.employment_percentage, 10),
      daily_hours_override:
        form.daily_hours_override === '' ? '' : Number.parseInt(form.daily_hours_override, 10),
      scoped_project_ids: form.scoped_project_ids.map((id) => Number.parseInt(id, 10)),
    })
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
          <option value="admin">מנהל</option>
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
              הסיסמה חייבת לכלול 8 תווים לפחות, אות גדולה, אות קטנה, מספר ותו מיוחד.
            </p>
          </div>
        ) : null}

        <Select
          label="סטטוס"
          value={String(form.is_active)}
          onChange={(event) => setField('is_active', event.target.value === 'true')}
        >
          <option value="true">פעיל</option>
          <option value="false">לא פעיל</option>
        </Select>
      </div>

      <section className="user-form__section">
        <header className="user-form__section-header">
          <h3 className="user-form__section-title">פרטים נוספים</h3>
        </header>

        <div className="user-form__grid">
          <Input
            label="מס׳ עובד"
            value={form.employee_number}
            onChange={(event) => setField('employee_number', event.target.value)}
          />
          <Select
            label="סוג משרה"
            value={form.employment_type}
            onChange={(event) => setField('employment_type', event.target.value)}
          >
            {EMPLOYMENT_TYPES.map((option) => (
              <option key={option.value || 'empty'} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
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
            label="שיוך ארגוני"
            value={form.department}
            onChange={(event) => setField('department', event.target.value)}
          />
          <Input
            label="תקן שעות יומי"
            type="number"
            min="0"
            value={form.daily_hours_override}
            onChange={(event) => setField('daily_hours_override', event.target.value)}
          />
        </div>
      </section>

      <section className="user-form__section">
        <header className="user-form__section-header">
          <h3 className="user-form__section-title">הרשאות</h3>
        </header>

        <label className="permission-toggle">
          <div>
            <span className="permission-toggle__title">canAssignProjectTasks</span>
            <span className="permission-toggle__subtitle">הגבלת שיוך משימות לפרויקטים נבחרים</span>
          </div>
          <button
            type="button"
            className={`permission-toggle__switch ${
              form.can_assign_project_tasks ? 'permission-toggle__switch--active' : ''
            }`}
            onClick={() =>
              setForm((current) => ({
                ...current,
                can_assign_project_tasks: !current.can_assign_project_tasks,
                scoped_project_ids: !current.can_assign_project_tasks ? current.scoped_project_ids : [],
              }))
            }
            aria-pressed={form.can_assign_project_tasks}
            aria-label="הפעלת הרשאת שיוך משימות לפרויקטים"
          >
            <span className="permission-toggle__thumb" />
          </button>
        </label>

        {form.can_assign_project_tasks ? (
          <div className="project-picker">
            <p className="project-picker__label">בחירת פרויקטים מורשים</p>
            <div className="project-picker__list">
              {loadingMeta ? (
                <div className="users-table__skeleton" />
              ) : projects.length > 0 ? (
                projects.map((project) => {
                  const selected = form.scoped_project_ids.includes(String(project.id))

                  return (
                    <button
                      key={project.id}
                      type="button"
                      className={`project-pill ${selected ? 'project-pill--selected' : ''}`}
                      onClick={() => toggleProject(String(project.id))}
                    >
                      {project.name}
                    </button>
                  )
                })
              ) : (
                <p className="project-picker__empty">אין כרגע פרויקטים פעילים לבחירה.</p>
              )}
            </div>
            {errors.scoped_project_ids ? (
              <span className="ui-field__error">{errors.scoped_project_ids}</span>
            ) : null}
          </div>
        ) : null}
      </section>
    </form>
  )
}
