import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function AdminShell({ title, subtitle, actions, children }) {
  const { logout, user } = useAuth();

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
            to="/admin/dashboard"
            className={({ isActive }) =>
              `admin-nav__item ${isActive ? 'admin-nav__item--active' : ''}`.trim()
            }
          >
            לוח בקרה
          </NavLink>
          <NavLink
            to="/admin/users"
            className={({ isActive }) =>
              `admin-nav__item ${isActive ? 'admin-nav__item--active' : ''}`.trim()
            }
          >
            ניהול משתמשים
          </NavLink>
          <NavLink
            to="/admin/clients"
            className={({ isActive }) =>
              `admin-nav__item ${isActive ? 'admin-nav__item--active' : ''}`.trim()
            }
          >
            לקוחות
          </NavLink>
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
          <NavLink
            to="/admin/assignments"
            className={({ isActive }) =>
              `admin-nav__item ${isActive ? 'admin-nav__item--active' : ''}`.trim()
            }
          >
            שיוך עובדים
          </NavLink>
        </nav>

        <div className="admin-sidebar__footer">
          <div className="admin-user-profile">
            <div className="admin-user-profile__avatar" aria-hidden="true">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="0.5" y="0.5" width="39" height="39" rx="19.5" fill="white" fillOpacity="0.05"/>
                <rect x="0.5" y="0.5" width="39" height="39" rx="19.5" stroke="white"/>
                <g clipPath="url(#clip0_11200_14258)">
                  <path d="M6.59195 24.4586C6.61928 24.3131 6.64662 24.1676 6.675 24.02C6.79344 23.3909 7.0934 22.8127 7.53605 22.3604C8.18157 21.6944 8.83655 21.0381 9.48733 20.3785C9.50059 20.3651 9.51463 20.3525 9.52939 20.3408L14.3256 25.2076L14.232 25.3078C13.6012 25.9458 12.9767 26.5891 12.3396 27.2217C11.7813 27.7829 11.0429 28.1169 10.2622 28.1614C8.39394 28.3156 6.73808 26.67 6.62033 24.9791C6.61424 24.9507 6.60396 24.9235 6.58984 24.8983L6.59195 24.4586Z" fill="#ED764C"/>
                  <path d="M19.7812 19.3207L15.1963 14.6685L19.798 10L24.3829 14.6523L19.7812 19.3207Z" fill="#ED764C"/>
                  <path d="M28.2829 19.792C28.2829 20.2231 28.2829 20.6541 28.2829 21.0906C28.2789 21.1656 28.2496 21.2369 28.1999 21.2921C27.6034 21.9042 27.0035 22.5127 26.4 23.1177C26.3422 23.1714 26.2677 23.2023 26.1897 23.205C25.3367 23.2114 24.4834 23.2114 23.6297 23.205C23.5516 23.2019 23.4771 23.1706 23.4195 23.1166C22.8153 22.5131 22.2153 21.9049 21.6196 21.2921C21.568 21.2324 21.5383 21.1562 21.5355 21.0766C21.5298 20.2144 21.5298 19.3523 21.5355 18.4902C21.5382 18.4101 21.5688 18.3336 21.6217 18.2746C22.2167 17.6618 22.8163 17.0529 23.4205 16.448C23.4825 16.3904 23.562 16.3566 23.6455 16.3521C24.4866 16.3449 25.3297 16.3449 26.175 16.3521C26.2588 16.3554 26.3386 16.3894 26.4 16.448C27.0028 17.0508 27.6024 17.6589 28.1988 18.2725C28.2517 18.3317 28.2829 18.4079 28.2871 18.488C28.2882 18.9245 28.2829 19.3566 28.2829 19.792Z" fill="#E95386"/>
                  <path d="M25.3115 25.1172L30.1046 20.2559C30.1372 20.285 30.1771 20.3227 30.216 20.3636L32.0916 22.2668C32.6938 22.8894 33.0317 23.7307 33.0317 24.6075C33.0317 25.4843 32.6938 26.3255 32.0916 26.9482C31.5659 27.487 30.974 27.8944 30.2265 28.0258C29.1163 28.2284 28.1344 27.9461 27.3175 27.154C26.652 26.5074 26.0128 25.8393 25.363 25.1765C25.3445 25.1581 25.3273 25.1382 25.3115 25.1172Z" fill="#ED764C"/>
                  <path d="M14.5426 23.1464C13.6634 23.151 12.8181 22.7984 12.1918 22.1658C11.8832 21.854 11.6378 21.4826 11.4699 21.0731C11.3021 20.6636 11.2151 20.224 11.2139 19.7798C11.2127 19.3356 11.2974 18.8956 11.4631 18.4851C11.6288 18.0747 11.8722 17.7019 12.1792 17.3885C12.8041 16.7503 13.6501 16.3919 14.5321 16.3916C14.9711 16.3907 15.406 16.4774 15.8127 16.647C16.2174 16.8168 16.5857 17.0666 16.8966 17.382C17.2063 17.6938 17.4523 18.0658 17.6203 18.4762C17.7882 18.8866 17.8747 19.3272 17.8747 19.7723C17.8747 20.2173 17.7882 20.6579 17.6203 21.0683C17.4523 21.4787 17.2063 21.8507 16.8966 22.1625C16.2696 22.7944 15.4251 23.1479 14.5458 23.1464H14.5426Z" fill="#F49C1A"/>
                </g>
                <defs>
                  <clipPath id="clip0_11200_14258">
                    <rect width="26.6667" height="20" fill="white" transform="translate(6.66699 10)"/>
                  </clipPath>
                </defs>
              </svg>
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
