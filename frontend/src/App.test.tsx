import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';

let mockAuthState: any;

jest.mock('react-router-dom', () => {
  const React = require('react');

  function Route({ element }: { element: React.ReactNode }) {
    return <>{element}</>;
  }

  function Routes({ children }: { children: React.ReactNode }) {
    const routeElements = React.Children.toArray(children);
    const pathname = globalThis.location?.pathname ?? '/';

    const directMatch = routeElements.find((child: any) => child?.props?.path === pathname);
    if (directMatch) {
      return <>{(directMatch as any).props.element}</>;
    }

    const wildcardMatch = routeElements.find((child: any) => child?.props?.path === '*');
    return wildcardMatch ? <>{(wildcardMatch as any).props.element}</> : null;
  }

  return {
    BrowserRouter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Navigate: ({ to }: { to: string }) => <div>{`navigate:${to}`}</div>,
    Route,
    Routes,
    useLocation: () => ({ state: null, pathname: globalThis.location?.pathname ?? '/' }),
  };
}, { virtual: true });

jest.mock('./components/LoginCard', () => ({
  LoginCard: ({ onSubmit, isLoading, error }: any) => (
    <div>
      <div data-testid="login-card">{isLoading ? 'loading' : 'idle'}</div>
      {error ? <div>{error}</div> : null}
      <button type="button" onClick={() => void onSubmit('user@test.com', 'Password1!', true)}>
        submit-login
      </button>
    </div>
  ),
}));

jest.mock('./components/ChangePasswordCard', () => () => <div>change-password-card</div>);
jest.mock('./components/ProtectedRoute', () => ({ children }: any) => <>{children}</>);
jest.mock('./components/InactivityWarningModal', () => () => <div>inactivity-warning-modal</div>);
jest.mock('./components/ui/ErrorState.jsx', () => ({
  ErrorState: ({ title, description, actionLabel, onAction }: any) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      <button type="button" onClick={onAction}>
        {actionLabel}
      </button>
    </div>
  ),
}));
jest.mock('./features/admin/users/UserListPage.jsx', () => ({
  UserListPage: () => <div>user-list-page</div>,
}));
jest.mock('./features/admin/dashboard/AdminDashboard.jsx', () => ({
  AdminDashboard: () => <div>admin-dashboard-page</div>,
}));
jest.mock('./contexts/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

function buildAuthState(overrides: Partial<any> = {}) {
  return {
    user: null,
    isAuthenticated: false,
    login: jest.fn(),
    logout: jest.fn(),
    clearMustChangePassword: jest.fn(),
    showInactivityWarning: false,
    continueSession: jest.fn(),
    ...overrides,
  };
}

function renderAppAt(pathname: string, overrides: Partial<any> = {}) {
  window.history.pushState({}, '', pathname);
  mockAuthState = buildAuthState(overrides);
  return render(<App />);
}

describe('App routing and shell', () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockAuthState = buildAuthState();
  });

  it('renders the login route for signed-out users', () => {
    renderAppAt('/login');

    expect(screen.getByTestId('login-card')).toHaveTextContent('idle');
    expect(screen.getByText('inactivity-warning-modal')).toBeInTheDocument();
  });

  it.each([
    [423, { retryAfterMinutes: 15 }, 'החשבון ננעל. נסו שוב בעוד 15 דקות.'],
    [401, {}, 'כתובת האימייל או הסיסמה שגויות.'],
    [429, {}, 'בוצעו יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.'],
    [500, {}, 'משהו השתבש. נסו שוב.'],
  ])('maps login error status %s to the correct message', async (status, data, message) => {
    const login = jest.fn().mockRejectedValue({ response: { status, data } });
    renderAppAt('/login', { login });

    fireEvent.click(screen.getByRole('button', { name: 'submit-login' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it('redirects authenticated users away from login', () => {
    renderAppAt('/login', {
      isAuthenticated: true,
      user: { fullName: 'Dana Admin', role: 'user', mustChangePassword: false },
    });

    expect(screen.getByText('navigate:/')).toBeInTheDocument();
  });

  it('renders the change-password page when a password reset is required', () => {
    renderAppAt('/change-password', {
      isAuthenticated: true,
      user: { fullName: 'Dana Admin', role: 'user', mustChangePassword: true },
    });

    expect(screen.getByText('change-password-card')).toBeInTheDocument();
  });

  it('redirects from change-password when the password was already changed', () => {
    renderAppAt('/change-password', {
      isAuthenticated: true,
      user: { fullName: 'Dana Admin', role: 'user', mustChangePassword: false },
    });

    expect(screen.getByText('navigate:/')).toBeInTheDocument();
  });

  it('renders the signed-in home page and logs out regular users', () => {
    const logout = jest.fn();
    renderAppAt('/', {
      isAuthenticated: true,
      user: { fullName: 'Dana Admin', role: 'user', mustChangePassword: false },
      logout,
    });

    expect(screen.getByRole('heading', { name: /דיווח שעות/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/רשימת דיווחים חודשית/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /יציאה/i }));
    expect(logout).toHaveBeenCalled();
  });

  it('redirects admins from home to the admin dashboard page', () => {
    renderAppAt('/', {
      isAuthenticated: true,
      user: { fullName: 'Ada Admin', role: 'admin', mustChangePassword: false },
    });

    expect(screen.getByText('navigate:/admin/dashboard')).toBeInTheDocument();
  });

  it('renders the admin dashboard page for admins', () => {
    renderAppAt('/admin/dashboard', {
      isAuthenticated: true,
      user: { fullName: 'Ada Admin', role: 'admin', mustChangePassword: false },
    });

    expect(screen.getByText('admin-dashboard-page')).toBeInTheDocument();
  });

  it('renders the admin users page for admins', () => {
    renderAppAt('/admin/users', {
      isAuthenticated: true,
      user: { fullName: 'Ada Admin', role: 'admin', mustChangePassword: false },
    });

    expect(screen.getByText('user-list-page')).toBeInTheDocument();
  });

  it('renders the access denied page for non-admins and sends them home', () => {
    const originalLocation = window.location;
    const assignSpy = jest.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, assign: assignSpy },
    });

    renderAppAt('/admin/users', {
      isAuthenticated: true,
      user: { fullName: 'Dana User', role: 'user', mustChangePassword: false },
    });

    expect(screen.getByText('אין הרשאה')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /חזרה לדף הבית/i }));
    expect(assignSpy).toHaveBeenCalledWith('/');
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('redirects unknown routes to home', () => {
    renderAppAt('/missing-route');

    expect(screen.getByText('navigate:/')).toBeInTheDocument();
  });

  it('shows and dismisses the global toast for server errors', async () => {
    jest.useFakeTimers();
    renderAppAt('/login');

    act(() => {
      window.dispatchEvent(new CustomEvent('app:serverError', { detail: { message: 'Server down' } }));
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Server down');

    act(() => {
      jest.advanceTimersByTime(4000);
    });

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});
