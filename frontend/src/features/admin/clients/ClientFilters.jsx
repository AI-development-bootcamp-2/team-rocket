import { Select } from '../../../components/ui/Select.jsx';

export function ClientFilters({ status, onStatusChange }) {
  return (
    <section className="user-filters">
      <div className="user-filters__select">
        <Select label="סטטוס" value={status} onChange={(event) => onStatusChange(event.target.value)}>
          <option value="all">כל הסטטוסים</option>
          <option value="active">פעיל</option>
          <option value="inactive">לא פעיל</option>
        </Select>
      </div>
    </section>
  );
}
