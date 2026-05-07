import React from 'react';
import styles from './MobileFrame.module.css';

interface MobileFrameProps {
  variant?: 'light' | 'dark';
  children?: React.ReactNode;
  hasStatusBar?: boolean;
  /** Custom time string for status bar. Defaults to "9:41". */
  statusTime?: string;
}

export const MobileFrame: React.FC<MobileFrameProps> = ({
  variant = 'light',
  children,
  hasStatusBar = true,
  statusTime,
}) => {
  return (
    <div className={`${styles.mobileFrame} ${styles[variant]}`} dir="rtl" lang="he">
      {hasStatusBar && <StatusBar variant={variant} time={statusTime} />}
      <div className={`${styles.content} ${variant === 'dark' ? styles.dark : ''}`}>
        {children}
      </div>
    </div>
  );
};

interface StatusBarProps {
  variant?: 'light' | 'dark';
  time?: string;
}

const StatusBar: React.FC<StatusBarProps> = ({ variant = 'light', time = '9:41' }) => {
  return (
    <div className={`${styles.statusBar} ${styles[`statusBar-${variant}`]}`} aria-hidden="true">
      <div className={styles.statusBarContent}>
        <span className={styles.time}>{time}</span>
        <div className={styles.statusIcons}>
          <span role="img" aria-label="signal">📶</span>
          <span role="img" aria-label="wifi">📡</span>
          <span role="img" aria-label="battery">🔋</span>
        </div>
      </div>
    </div>
  );
};
