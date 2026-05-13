export function AssignmentFilters({ search, onSearchChange, isScopedUser }) {
  return (
    <section className="assignment-filters">
      <div className="assignment-search">
        <svg
          className="assignment-search__icon"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <circle cx="7" cy="7" r="5" stroke="#9CA3AF" strokeWidth="1.5" />
          <path d="M11 11L14 14" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          className="assignment-search__input"
          placeholder="חיפוש לפי שם עובד"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="חיפוש שיוכים"
        />
      </div>

      {isScopedUser && (
        <p className="assignment-scope-hint">⚠️ ניתן לשייך רק בתוך הפרויקטים המורשים לך</p>
      )}
    </section>
  );
}
