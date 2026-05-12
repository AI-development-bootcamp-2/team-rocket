// @ts-nocheck
import styles from './AdminDashboard.module.css';

const STATUS_META = {
  not_started: { actionLabel: 'פירוט', detailLabel: 'טרם התחיל דיווח', className: styles.statusNotStarted },
  missing: { actionLabel: 'פירוט', detailLabel: 'חסר דיווח', className: styles.statusMissing },
  submitted: { actionLabel: 'פירוט', detailLabel: 'דיווח הוגש', className: styles.statusSubmitted },
};

function getUserInitials(firstName, lastName) {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.trim() || '?';
}

export function SubmissionStatusTable({
  monthLabel,
  rows,
  onCellClick,
}) {
  return (
    <>
      <div className={styles.tableWrap}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>עובד</th>
                <th>{monthLabel}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const meta = STATUS_META[row.month_status] ?? STATUS_META.not_started;
                const cell = {
                  week_start_date: row.target_week_start_date,
                  status: row.month_status,
                };

                return (
                  <tr key={row.user_id}>
                    <td>
                      <div className={styles.userCell}>
                        <div className={styles.userAvatar}>{getUserInitials(row.first_name, row.last_name)}</div>
                        <div>
                          <p className={styles.userName}>{`${row.first_name} ${row.last_name}`}</p>
                          <p className={styles.userMeta}>עובד פעיל</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className={styles.statusCell}>
                        <button
                          type="button"
                          className={`${styles.statusBadgeButton} ${styles.statusBadge} ${meta.className}`}
                          onClick={() => onCellClick?.(row, cell)}
                        >
                          {meta.actionLabel}
                        </button>
                        <span className={styles.statusDetail}>{meta.detailLabel}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.mobileCards}>
        {rows.map((row) => {
          const meta = STATUS_META[row.month_status] ?? STATUS_META.not_started;
          const cell = {
            week_start_date: row.target_week_start_date,
            status: row.month_status,
          };

          return (
            <article key={row.user_id} className={styles.mobileCard}>
              <div className={styles.userCell}>
                <div className={styles.userAvatar}>{getUserInitials(row.first_name, row.last_name)}</div>
                <div>
                  <p className={styles.userName}>{`${row.first_name} ${row.last_name}`}</p>
                  <p className={styles.userMeta}>עובד פעיל</p>
                </div>
              </div>

              <div className={styles.mobileGrid}>
                <div className={styles.mobileRow}>
                  <div className={styles.mobileWeekLabel}>{monthLabel}</div>
                  <div className={styles.mobileStatusCell}>
                    <button
                      type="button"
                      className={`${styles.statusBadgeButton} ${styles.statusBadge} ${meta.className}`}
                      onClick={() => onCellClick?.(row, cell)}
                    >
                      {meta.actionLabel}
                    </button>
                    <span className={styles.statusDetail}>{meta.detailLabel}</span>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

