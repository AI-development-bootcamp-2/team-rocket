import { Input } from '../../../components/ui/Input.jsx';
import { Select } from '../../../components/ui/Select.jsx';

export function UserFilters({
  search,
  role,
  status,
  onSearchChange,
  onRoleChange,
  onStatusChange,
}) {
  return (
    <section className="user-filters">
      <div className="user-filters__search">
        <Input
          label="חיפוש"
          placeholder="חיפוש לפי שם או אימייל"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="user-filters__select">
        <Select label="תפקיד" value={role} onChange={(event) => onRoleChange(event.target.value)}>
          <option value="all">כל התפקידים</option>
          <option value="admin">מנהל מערכת</option>
          <option value="user">משתמש</option>
        </Select>
      </div>

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
