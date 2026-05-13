import { Input } from '../../../components/ui/Input.jsx';
import { Select } from '../../../components/ui/Select.jsx';

export function TaskForm({ id, initialValues, projects, onSubmit, mode, onNameChange }) {
  function handleSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    onSubmit({
      project_id: Number(fd.get('project_id')),
      name: fd.get('name'),
      start_date: fd.get('start_date') || null,
      end_date: fd.get('end_date') || null,
      description: fd.get('description') || null,
      ...(mode === 'edit' ? { status: fd.get('status') } : {}),
    });
  }

  const v = initialValues ?? {};

  return (
    <form id={id} onSubmit={handleSubmit} noValidate className="task-form">
      <Input
        label="שם המשימה"
        name="name"
        defaultValue={v.name ?? ''}
        required
        autoFocus
        onChange={(e) => onNameChange?.(e.target.value)}
      />

      <Select
        label="שיוך לפרויקט"
        name="project_id"
        defaultValue={v.projectId != null ? String(v.projectId) : ''}
        required
      >
        <option value="" disabled>
          בחר פרויקט
        </option>
        {mode === 'edit' && v.projectId != null && !projects.some((p) => p.id === v.projectId) ? (
          <option value={String(v.projectId)} disabled>
            {v.projectName ?? `פרויקט #${v.projectId}`} (לא פעיל)
          </option>
        ) : null}
        {projects.map((project) => (
          <option key={project.id} value={String(project.id)}>
            {project.clientName ? `${project.clientName} / ${project.name}` : project.name}
          </option>
        ))}
      </Select>

      {mode === 'edit' ? (
        <Select label="סטטוס" name="status" defaultValue={v.status ?? 'open'}>
          <option value="open">פעיל</option>
          <option value="closed">סגור</option>
        </Select>
      ) : null}

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

      <label className="ui-field">
        <span className="ui-field__label">תיאור המשימה</span>
        <textarea
          name="description"
          className="ui-input"
          style={{ minHeight: 80, resize: 'vertical' }}
          placeholder="תיאור קצר של המשימה"
          defaultValue={v.description ?? ''}
        />
      </label>
    </form>
  );
}
