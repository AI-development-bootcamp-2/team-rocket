import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import styles from './InactivityWarningModal.module.css';

const InactivityWarningModal: React.FC = () => {
  const { showInactivityWarning, continueSession } = useAuth();

  if (!showInactivityWarning) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="inactivity-title" dir="rtl">
      <div className={styles.modal}>
        <p id="inactivity-title" className={styles.message}>
          אתה עומד להתנתק בעוד 2 דקות. האם להמשיך?
        </p>
        <button className={styles.button} onClick={continueSession}>
          כן, המשך
        </button>
      </div>
    </div>
  );
};

export default InactivityWarningModal;
