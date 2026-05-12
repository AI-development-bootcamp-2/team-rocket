import { useAuth } from '../contexts/AuthContext';
import styles from './AppHeader.module.css';

export function AppHeader({ onManualReport, onTimerToggle }) {
  const { logout } = useAuth();

  return (
    <header className={styles.header} dir="rtl" lang="he">
      {/* Right (RTL start): Logo */}
      <div className={styles.headerBrand}>
        <img
          src={`${process.env.PUBLIC_URL}/images/abra-logo.png`}
          alt="abra"
          className={styles.headerLogo}
        />
      </div>

      {/* Center: Action buttons */}
      <div className={styles.headerCenter}>
        {/* Timer button (pink gradient) */}
        <button
          className={styles.timerBtn}
          onClick={onTimerToggle}
          type="button"
          title="הפעלת שעון"
        >
          <span className={styles.timerBtnLabel}>הפעלת שעון</span>
          <span className={styles.timerBtnIcon} aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 14 16" fill="white">
              <path d="M2 1l12 7L2 15V1z" />
            </svg>
          </span>
        </button>

        {/* Manual report button (orange gradient) */}
        <button
          className={styles.manualReportBtn}
          onClick={onManualReport}
          type="button"
        >
          <span className={styles.manualBtnLabel}>דיווח ידני</span>
          <span className={styles.manualBtnIcon} aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="white">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </span>
        </button>
      </div>

      {/* Left (RTL end): Logout button */}
      <button className={styles.logoutBtn} onClick={logout} type="button">
        יציאה
        <span className={styles.logoutArrow} aria-hidden="true">→</span>
      </button>
    </header>
  );
}
