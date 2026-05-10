/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { LoginCard } from './LoginCard';
import ChangePasswordCard from './ChangePasswordCard';
import ProtectedRoute from './ProtectedRoute';
import InactivityWarningModal from './InactivityWarningModal';
import { AdminShell } from './layout/AdminShell.jsx';
import { Button } from './ui/Button.jsx';
import { Input } from './ui/Input.jsx';
import { Select } from './ui/Select.jsx';
import { Modal } from './ui/Modal.jsx';
import { EmptyState } from './ui/EmptyState.jsx';
import { ErrorState } from './ui/ErrorState.jsx';
import { Spinner } from './ui/Spinner.jsx';
import { Toast } from './ui/Toast.jsx';
import axiosClient, { tokenStore } from '../api/axiosClient';

const mockNavigate = jest.fn();
const mockLogout = jest.fn();
const mockContinue = jest.fn();
const mockClearMustChangePassword = jest.fn();

let mockAuthState: any = {
  user: null,
  isAuthenticated: false,
  logout: mockLogout,
  continueSession: mockContinue,
  clearMustChangePassword: mockClearMustChangePassword,
  showInactivityWarning: false,
};

jest.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate">{to}</div>,
  NavLink: ({ children, className }: any) => (
    <a className={typeof className === 'function' ? className({ isActive: true }) : className} href="/admin/users">
      {children}
    </a>
  ),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: null, pathname: '/' }),
}), { virtual: true });

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('../api/axiosClient', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
  tokenStore: {
    set: jest.fn(),
  },
}));

describe('auth and shared UI components', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
    mockAuthState = {
      user: null,
      isAuthenticated: false,
      logout: mockLogout,
      continueSession: mockContinue,
      clearMustChangePassword: mockClearMustChangePassword,
      showInactivityWarning: false,
    };
  });

  it('validates login input, toggles password visibility, and submits valid credentials', () => {
    const onSubmit = jest.fn();
    localStorage.setItem('rememberedEmail', 'saved@test.com');

    render(<LoginCard onSubmit={onSubmit} />);

    expect(screen.getByDisplayValue('saved@test.com')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /התחבר/i }));
    expect(screen.getAllByText(/שדה חובה/i)).toHaveLength(1);

    fireEvent.change(screen.getByPlaceholderText(/כתובת דוא״ל|כתובת דוא"ל|כתובת/i), {
      target: { value: 'ada@test.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/סיסמה/i), { target: { value: 'Password1!' } });
    fireEvent.click(screen.getByLabelText(/הצג סיסמה/i));
    expect(screen.getByDisplayValue('Password1!')).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: /התחבר/i }));

    expect(onSubmit).toHaveBeenCalledWith('ada@test.com', 'Password1!', true);
  });

  it('shows offline state in LoginCard', () => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });

    render(<LoginCard />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /אין חיבור לאינטרנט/i })).toBeDisabled();
  });

  it('changes password successfully and handles API errors', async () => {
    (axiosClient.post as jest.Mock)
      .mockResolvedValueOnce({ data: { accessToken: 'next-token' } })
      .mockRejectedValueOnce({ response: { status: 401 } })
      .mockRejectedValueOnce({ response: { status: 400 } })
      .mockRejectedValueOnce({ response: { status: 500 } });

    mockAuthState.user = { fullName: 'Ada Lovelace' };

    const { rerender } = render(<ChangePasswordCard />);

    fireEvent.change(screen.getByPlaceholderText(/נוכחית/i), { target: { value: 'OldPass1!' } });
    fireEvent.change(screen.getByPlaceholderText(/^יש להזין סיסמה חדשה$/i), { target: { value: 'NewPass1!' } });
    fireEvent.change(screen.getByPlaceholderText(/לאמת/i), { target: { value: 'NewPass1!' } });
    fireEvent.click(screen.getByRole('button', { name: /שמירת סיסמה/i }));

    await waitFor(() => expect(tokenStore.set).toHaveBeenCalledWith('next-token'));
    expect(mockClearMustChangePassword).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });

    rerender(<ChangePasswordCard />);
    fireEvent.change(screen.getByPlaceholderText(/^יש להזין סיסמה חדשה$/i), { target: { value: 'NewPass1!' } });
    fireEvent.change(screen.getByPlaceholderText(/לאמת/i), { target: { value: 'NewPass1!' } });
    fireEvent.click(screen.getByRole('button', { name: /שמירת סיסמה/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/הסיסמה הנוכחית שגויה/i);

    fireEvent.click(screen.getByRole('button', { name: /שמירת סיסמה/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/לא עומדת בדרישות/i);

    fireEvent.click(screen.getByRole('button', { name: /שמירת סיסמה/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/משהו השתבש/i);
  });

  it('renders protected route redirects and inactivity modal states', () => {
    const { rerender } = render(
      <ProtectedRoute>
        <div>secret</div>
      </ProtectedRoute>,
    );
    expect(screen.getByTestId('navigate')).toHaveTextContent('/login');

    mockAuthState.isAuthenticated = true;
    mockAuthState.user = { mustChangePassword: true };
    rerender(
      <ProtectedRoute>
        <div>secret</div>
      </ProtectedRoute>,
    );
    expect(screen.getByTestId('navigate')).toHaveTextContent('/change-password');

    mockAuthState.user = { mustChangePassword: false };
    rerender(
      <ProtectedRoute>
        <div>secret</div>
      </ProtectedRoute>,
    );
    expect(screen.getByText('secret')).toBeInTheDocument();

    rerender(<InactivityWarningModal />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    mockAuthState.showInactivityWarning = true;
    rerender(<InactivityWarningModal />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockContinue).toHaveBeenCalled();
  });

  it('renders shared UI primitives and admin shell interactions', () => {
    render(
      <div>
        <Button variant="secondary">secondary</Button>
        <Input id="field" label="field" error="bad" value="x" onChange={() => {}} />
        <Select id="select" label="select" error="bad" value="a" onChange={() => {}}>
          <option value="a">A</option>
        </Select>
        <Modal title="modal" icon="M" onClose={mockLogout} footer={<Button>save</Button>}>
          <div>modal body</div>
        </Modal>
        <EmptyState title="empty" description="none" actionLabel="act" onAction={mockLogout} />
        <ErrorState title="error" description="desc" onAction={mockLogout} />
        <Spinner />
        <Toast message="saved" tone="error" onClose={mockLogout} />
        <AdminShell title="title" subtitle="subtitle" actions={<Button>action</Button>}>
          <div>content</div>
        </AdminShell>
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { name: /^act$/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /סגירה/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /התנתקות/i }));

    expect(mockLogout).toHaveBeenCalledTimes(3);
    expect(screen.getByText('content')).toBeInTheDocument();
    expect(screen.getByText('secondary')).toHaveClass('ui-button--secondary');
    expect(screen.getAllByText('bad')).toHaveLength(2);
    expect(screen.getByRole('status', { name: /טוען/i })).toBeInTheDocument();
    expect(screen.getByText('saved')).toBeInTheDocument();

    const modal = screen.getByRole('dialog', { name: 'modal' });
    fireEvent.click(within(modal).getByText('modal body'));
    expect(mockLogout).toHaveBeenCalledTimes(3);
  });

  it('covers LoginCard validation branches and remember-me toggle without relying on copy', () => {
    const onSubmit = jest.fn();
    const { container } = render(<LoginCard onSubmit={onSubmit} />);
    const inputs = container.querySelectorAll('input') as NodeListOf<HTMLInputElement>;
    const submitButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;

    fireEvent.click(submitButton);
    expect(container.querySelectorAll('p').length).toBeGreaterThan(0);

    fireEvent.change(inputs[0], { target: { value: 'not-an-email' } });
    fireEvent.change(inputs[1], { target: { value: 'Password1!' } });
    fireEvent.click(submitButton);
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(inputs[2]);
    fireEvent.change(inputs[0], { target: { value: 'valid@test.com' } });
    fireEvent.click(submitButton);

    expect(onSubmit).toHaveBeenCalledWith('valid@test.com', 'Password1!', true);
  });
});
