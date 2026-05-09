import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function AdminShell({ title, subtitle, actions, children }) {
  const { logout, user } = useAuth();

  const initials = user?.fullName
    ? user.fullName
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
    : '?';

  return (
    <div className="admin-shell" dir="rtl" lang="he">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <img
            src={`${process.env.PUBLIC_URL}/images/abra_logo2.png`}
            alt="abra"
            className="admin-brand__logo"
          />
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
          <NavLink
            to="/admin/projects"
            className={({ isActive }) =>
              `admin-nav__item ${isActive ? 'admin-nav__item--active' : ''}`.trim()
            }
          >
            פרויקטים
          </NavLink>
          <NavLink
            to="/admin/tasks"
            className={({ isActive }) =>
              `admin-nav__item ${isActive ? 'admin-nav__item--active' : ''}`.trim()
            }
          >
            משימות
          </NavLink>
        </nav>

        <div className="admin-sidebar__footer">
          <div className="admin-user-profile">
            <div className="admin-user-profile__avatar" aria-hidden="true">
              {initials}
            </div>
            <div className="admin-user-profile__info">
              <div className="admin-user-profile__name">{user?.fullName ?? ''}</div>
              <div className="admin-user-profile__role">
                {user?.role === 'admin' ? 'מנהל מערכת' : 'משתמש'}
              </div>
              <button
                type="button"
                className="admin-user-profile__logout"
                onClick={logout}
              >
                התנתקות
              </button>
            </div>
          </div>
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
