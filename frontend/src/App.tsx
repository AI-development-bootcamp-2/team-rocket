import React, { CSSProperties, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import styles from './App.module.css';
import { LoginCard } from './components/LoginCard';
import ChangePasswordCard from './components/ChangePasswordCard';
import ProtectedRoute from './components/ProtectedRoute';
import InactivityWarningModal from './components/InactivityWarningModal';
import { ErrorState } from './components/ui/ErrorState.jsx';
import { UserListPage } from './features/admin/users/UserListPage.jsx';
import { ClientListPage } from './features/admin/clients/ClientListPage.jsx';
import { ProjectListPage } from './features/admin/projects/ProjectListPage.jsx';
import { TaskListPage } from './features/admin/tasks/TaskListPage.jsx';
import { AssignmentPage } from './features/admin/assignments/AssignmentPage.jsx';
import { MonthLockPage } from './features/admin/month-lock/MonthLockPage.jsx';
import { DailyReportPage } from './features/time-reports/DailyReportPage.jsx';
import { useAuth } from './contexts/AuthContext';

const authBgStyle: CSSProperties = {
  backgroundImage: `linear-gradient(rgba(9, 18, 54, 0.35), rgba(9, 18, 54, 0.35)), url(${process.env.PUBLIC_URL}/images/login-illustration.png)`,
};

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const timeoutId = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timeoutId);
  }, [message, onDismiss]);

  return (
    <div className={styles.toast} role="alert">
      {message}
    </div>
  );
}

function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: Location })?.from?.pathname || '/';
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (isAuthenticated) return <Navigate to={from} replace />;

  const handleSubmit = async (email: string, password: string, rememberMe: boolean) => {
    // Prevent double-submission if already loading
    if (isLoading) return;

    setIsLoading(true);
    setError('');

    try {
      await login(email, password, rememberMe);
    } catch (err: any) {
      const status = err.response?.status;

      if (status === 423) {
        const mins = err.response?.data?.retryAfterMinutes;
        setError(mins ? `החשבון ננעל. נסו שוב בעוד ${mins} דקות.` : 'החשבון ננעל זמנית.');
      } else if (status === 401) {
        setError('כתובת האימייל או הסיסמה שגויות.');
      } else if (status === 429) {
        setError('בוצעו יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.');
      } else {
        setError('משהו השתבש. נסו שוב.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className={styles.authBackground} style={authBgStyle}>
      <LoginCard
        onSubmit={handleSubmit}
        isLoading={isLoading}
        error={error}
        onErrorDismiss={() => setError('')}
      />
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

function HomePage() {
  const { user } = useAuth();

  if (user?.role === 'admin') return <Navigate to="/admin/users" replace />;

  return <DailyReportPage />;
}

function AccessDeniedPage() {
  return (
    <div className={styles.dashboard}>
      <ErrorState
        title="אין הרשאה"
        description="העמוד הזה זמין רק למנהלי מערכת."
        actionLabel="חזרה לדף הבית"
        onAction={() => window.location.assign('/')}
      />
    </div>
  );
}

function AdminUsersPage() {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <AccessDeniedPage />;
  return <UserListPage />;
}

function AdminClientsPage() {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <AccessDeniedPage />;
  return <ClientListPage />;
}

function AdminProjectsPage() {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <AccessDeniedPage />;
  return <ProjectListPage />;
}

function AdminTasksPage() {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <AccessDeniedPage />;
  return <TaskListPage />;
}

function AdminAssignmentsPage() {
  const { user } = useAuth();
  // Admin and users with canAssignProjectTasks flag may access this page;
  // the AssignmentPage itself handles the 403 state for regular users.
  if (!user) return <AccessDeniedPage />;
  return <AssignmentPage />;
}

function AdminMonthLockPage() {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <AccessDeniedPage />;
  return <MonthLockPage />;
}

function App() {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: Event) => setToast((event as CustomEvent).detail.message);
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
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute>
                <AdminUsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/clients"
            element={
              <ProtectedRoute>
                <AdminClientsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/projects"
            element={
              <ProtectedRoute>
                <AdminProjectsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/tasks"
            element={
              <ProtectedRoute>
                <AdminTasksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/assignments"
            element={
              <ProtectedRoute>
                <AdminAssignmentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/month-lock"
            element={
              <ProtectedRoute>
                <AdminMonthLockPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>

      <InactivityWarningModal />
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </>
  );
}

export default App;
