import { Select } from '../../../components/ui/Select.jsx';

export function TaskFilters({ projectId, status, projects, onProjectChange, onStatusChange }) {
  return (
    <section className="user-filters">
      <div className="user-filters__select">
        <Select
          label="פרויקט"
          value={projectId}
          onChange={(e) => onProjectChange(e.target.value)}
        >
          <option value="all">כל הפרויקטים</option>
          {projects.map((project) => (
            <option key={project.id} value={String(project.id)}>
              {project.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="user-filters__select">
        <Select
          label="סטטוס"
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
        >
          <option value="all">כל הסטטוסים</option>
          <option value="open">פעיל</option>
          <option value="closed">סגור</option>
        </Select>
      </div>
    </section>
  );
}
