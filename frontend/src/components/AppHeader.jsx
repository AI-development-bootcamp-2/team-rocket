import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getTimerStatus, startTimer, quickStopTimer } from '../api/timer.api';
import styles from './AppHeader.module.css';

function formatElapsed(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

function toHHMM(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function AppHeader({ onManualReport, onTimerToggle }) {
  const { logout } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);

  const startTicking = useCallback((initialSeconds, startDate) => {
    startTimeRef.current = startDate;
    setElapsed(initialSeconds);
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setElapsed((s) => s + 1);
    }, 1000);
  }, []);

  const stopTicking = useCallback(() => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    setElapsed(0);
  }, []);

  useEffect(() => {
    getTimerStatus()
      .then((data) => {
        if (data.running) {
          setIsRunning(true);
          startTicking(data.elapsedSeconds, new Date(data.startTime));
        }
      })
      .catch(() => {});
    return () => clearInterval(intervalRef.current);
  }, [startTicking]);

  const handleStart = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const data = await startTimer();
      const startDate = new Date(data.startTime);
      setIsRunning(true);
      startTicking(0, startDate);
    } catch {
      // leave state unchanged on error
    } finally {
      setLoading(false);
    }
  }, [loading, startTicking]);

  const handleStop = useCallback(async () => {
    stopTicking();
    setIsRunning(false);
    try {
      const result = await quickStopTimer();
      onTimerToggle?.({
        id: result.timeEntryId,
        start_time: toHHMM(new Date(result.startTime)),
        end_time: toHHMM(new Date(result.stopTime)),
        version: result.version,
      });
    } catch {
      onTimerToggle?.({
        start_time: startTimeRef.current ? toHHMM(startTimeRef.current) : '',
        end_time: toHHMM(new Date()),
      });
    }
  }, [stopTicking, onTimerToggle]);

  return (
    <header className={styles.header} dir="rtl" lang="he">
      <div className={styles.headerInner}>
      {/* Right (RTL start): Logo */}
      <div className={styles.headerBrand}>
        <img
          src={`${process.env.PUBLIC_URL}/images/abra-logo.png`}
          alt="abra"
          className={styles.headerLogo}
        />
      </div>

      {/* Left (RTL end): Action buttons + Logout grouped together */}
      <div className={styles.headerEnd}>
        <div className={styles.headerCenter}>
          {isRunning ? (
            <div className={styles.timerRunning}>
              <button
                className={styles.timerStopBtn}
                onClick={handleStop}
                type="button"
                title="עצירת שעון"
                aria-label="עצירת שעון"
              >
                <span className={styles.timerStopDot} aria-hidden="true" />
              </button>
              <span className={styles.timerElapsed}>{formatElapsed(elapsed)}</span>
            </div>
          ) : (
            <button
              className={styles.timerBtn}
              onClick={handleStart}
              type="button"
              disabled={loading}
              title="הפעלת שעון"
            >
              <span className={styles.timerBtnLabel}>הפעלת שעון</span>
              <span className={styles.timerBtnIcon} aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 14 16" fill="white">
                  <path d="M2 1l12 7L2 15V1z" />
                </svg>
              </span>
            </button>
          )}

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

        <button className={styles.logoutBtn} onClick={logout} type="button">
          <span className={styles.logoutIcon} aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.4395 14.62L19.9995 12.06L17.4395 9.5" stroke="#0C69FF" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9.75977 12.0601H19.9298" stroke="#0C69FF" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M11.7598 20C7.33977 20 3.75977 17 3.75977 12C3.75977 7 7.33977 4 11.7598 4" stroke="#0C69FF" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          יציאה
        </button>
      </div>
      </div>
    </header>
  );
}
