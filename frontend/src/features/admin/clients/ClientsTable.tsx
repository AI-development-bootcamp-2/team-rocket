// @ts-nocheck
import { ClientRowActions } from './ClientRowActions';
import { ClientStatusBadge } from './ClientStatusBadge';

export function ClientsTable({ clients, onEdit, onArchive, loading }) {
  return (
    <div className="users-table-card">
      <table className="users-table">
        <thead>
          <tr>
            <th>שם לקוח</th>
            <th>פרטי קשר</th>
            <th>סטטוס</th>
            <th>פרויקטים פעילים</th>
            <th>פעולות</th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 6 }, (_, index) => (
                <tr key={index}>
                  <td colSpan="5">
                    <div className="users-table__skeleton" />
                  </td>
                </tr>
              ))
            : clients.map((client) => (
                <tr key={client.id} className={!client.isActive ? 'users-table__row--archived' : ''}>
                  <td>{client.name}</td>
                  <td className="users-table__email">{client.contactInfo ?? '—'}</td>
                  <td>
                    <ClientStatusBadge isActive={client.isActive} />
                  </td>
                  <td>{client.activeProjectsCount ?? '—'}</td>
                  <td>
                    <ClientRowActions client={client} onEdit={onEdit} onArchive={onArchive} />
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}


