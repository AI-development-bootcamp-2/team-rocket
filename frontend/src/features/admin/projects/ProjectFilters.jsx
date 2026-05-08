import { Select } from '../../../components/ui/Select.jsx';

export function ProjectFilters({ clientId, status, clients, onClientChange, onStatusChange }) {
  return (
    <section className="user-filters">
      <div className="user-filters__select">
        <Select
          label="לקוח"
          value={clientId}
          onChange={(e) => onClientChange(e.target.value)}
        >
          <option value="all">כל הלקוחות</option>
          {clients.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name}
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
          <option value="active">פעיל</option>
          <option value="inactive">לא פעיל</option>
        </Select>
      </div>
    </section>
  );
}
