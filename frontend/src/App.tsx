import React, { CSSProperties, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import styles from './App.module.css';
import { LoginCard } from './components/LoginCard';
import ChangePasswordCard from './components/ChangePasswordCard';
import ProtectedRoute from './components/ProtectedRoute';
import InactivityWarningModal from './components/InactivityWarningModal';
import { useAuth } from './contexts/AuthContext';

const authBgStyle: CSSProperties = {
  backgroundImage: `linear-gradient(rgba(9, 18, 54, 0.35), rgba(9, 18, 54, 0.35)), url(${process.env.PUBLIC_URL}/images/login-illustration.png)`,
};

// ── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  return (
    <div className={styles.toast} role="alert">
      {message}
    </div>
  );
}

// ── Pages ─────────────────────────────────────────────────────────────────────

function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading]  = useState(false);
  const [error, setError]          = useState('');

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleSubmit = async (email: string, password: string, rememberMe: boolean) => {
    setIsLoading(true);
    setError('');
    try {
      await login(email, password, rememberMe);
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 423) {
        const mins = err.response?.data?.retryAfterMinutes;
        setError(mins ? `החשבון נעול. נסה שוב בעוד ${mins} דקות` : 'החשבון נעול זמנית');
      } else if (status === 401) {
        setError('כתובת דוא״ל או סיסמה שגויים');
      } else if (status === 429) {
        setError('יותר מדי ניסיונות. נסה שוב בעוד מספר דקות');
      } else {
        setError('אירעה שגיאה. אנא נסה שוב');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className={styles.authBackground} style={authBgStyle}>
      <LoginCard onSubmit={handleSubmit} isLoading={isLoading} error={error} />
    </main>
  );
}

function ChangePasswordPage() {
  const { user } = useAuth();
  if (user && !user.mustChangePassword) return <Navigate to="/" replace />;

  return (
    <main className={styles.authBackground} style={authBgStyle}>
      <ChangePasswordCard />
    </main>
  );
}

function DashboardPage() {
  const { logout, user } = useAuth();
  return (
    <div className={styles.dashboard} dir="rtl">
      <p>שלום, {user?.fullName}</p>
      <button onClick={logout}>התנתק</button>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

function App() {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => setToast((e as CustomEvent).detail.message);
    window.addEventListener('app:serverError', handler);
    return () => window.removeEventListener('app:serverError', handler);
  }, []);

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>

      {/* Rendered outside BrowserRouter — no routing needed */}
      <InactivityWarningModal />
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </>
  );
}

export default App;
