import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function AdminShell({ title, subtitle, actions, children }) {
  const { logout } = useAuth();

  return (
    <div className="admin-shell" dir="rtl" lang="he">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand__flame" aria-hidden="true">
            ▲
          </span>
          <div>
            <div className="admin-brand__name">abra</div>
            <div className="admin-brand__tag">ניהול</div>
          </div>
        </div>

        <nav className="admin-nav" aria-label="ניווט ראשי">
          <NavLink
            to="/admin/users"
            className={({ isActive }) =>
              `admin-nav__item ${isActive ? 'admin-nav__item--active' : ''}`.trim()
            }
          >
            ניהול משתמשים
          </NavLink>
          <button type="button" className="admin-nav__item" disabled>
            לקוחות
          </button>
          <button type="button" className="admin-nav__item" disabled>
            פרויקטים
          </button>
          <button type="button" className="admin-nav__item" disabled>
            משימות
          </button>
        </nav>

        <div className="admin-sidebar__footer">
          <button type="button" className="admin-nav__item" onClick={logout}>
            התנתקות
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-page-header">
          <div className="admin-page-header__copy">
            <h1 className="admin-page-header__title">{title}</h1>
            <p className="admin-page-header__subtitle">{subtitle}</p>
          </div>
          <div className="admin-page-header__actions">{actions}</div>
        </header>

        {children}
      </main>
    </div>
  );
}
