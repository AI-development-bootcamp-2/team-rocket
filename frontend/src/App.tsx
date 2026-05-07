import React, { CSSProperties, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import styles from './App.module.css';
import { LoginCard } from './components/LoginCard';
import ChangePasswordCard from './components/ChangePasswordCard';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';

const authBgStyle: CSSProperties = {
  backgroundImage: `linear-gradient(rgba(9, 18, 54, 0.35), rgba(9, 18, 54, 0.35)), url(${process.env.PUBLIC_URL}/images/login-illustration.png)`,
};

function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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

function App() {
  return (
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
  );
}

export default App;
