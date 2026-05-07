export function AdminShell({ title, subtitle, actions, children }) {
  return (
    <div className="admin-shell" dir="rtl" lang="he">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand__flame" aria-hidden="true">
            ▲
          </span>
          <div>
            <div className="admin-brand__name">abra</div>
            <div className="admin-brand__tag">Management</div>
          </div>
        </div>

        <nav className="admin-nav" aria-label="Main navigation">
          <button type="button" className="admin-nav__item admin-nav__item--active">
            ניהול משתמשים
          </button>
          <button type="button" className="admin-nav__item">
            לקוחות
          </button>
          <button type="button" className="admin-nav__item">
            פרויקטים
          </button>
          <button type="button" className="admin-nav__item">
            משימות
          </button>
        </nav>
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
  )
}
