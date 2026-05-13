import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AdminReportsPage } from './AdminReportsPage.jsx';

const mockNavigate = jest.fn();
const mockSetParams = jest.fn();
const mockListUsers = jest.fn();
const mockListTimeEntries = jest.fn();
const mockListAbsences = jest.fn();
let mockSearchParams = 'user_id=2&month=2026-04&week_start_date=2026-04-07';

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams(mockSearchParams), mockSetParams],
}), { virtual: true });

jest.mock('../../../api/users.api.js', () => ({
  listUsers: (...args) => mockListUsers(...args),
}));

jest.mock('../../../api/timeEntries.api', () => ({
  listTimeEntries: (...args) => mockListTimeEntries(...args),
}));

jest.mock('../../../api/absences.api.js', () => ({
  listAbsences: (...args) => mockListAbsences(...args),
}));

jest.mock('../../../components/layout/AdminShell', () => ({
  AdminShell: ({ title, subtitle, actions, children }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <div>{actions}</div>
      {children}
    </div>
  ),
}));

jest.mock('../../../components/ui/Spinner.jsx', () => ({
  Spinner: ({ label }) => <div>{label}</div>,
}));

jest.mock('../../../components/ui/ErrorState.jsx', () => ({
  ErrorState: ({ title, description }) => (
    <div>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  ),
}));

jest.mock('../../../components/ui/EmptyState', () => ({
  EmptyState: ({ title, description }) => (
    <div>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  ),
}));

describe('AdminReportsPage', () => {
  beforeEach(() => {
    mockSearchParams = 'user_id=2&month=2026-04&week_start_date=2026-04-07';
    mockNavigate.mockReset();
    mockSetParams.mockReset();
    mockListUsers.mockReset();
    mockListTimeEntries.mockReset();
    mockListAbsences.mockReset();

    mockListUsers.mockResolvedValue({
      data: [
        { id: 2, firstName: 'Alice', lastName: 'Cohen' },
        { id: 3, firstName: 'Bob', lastName: 'Levi' },
      ],
    });
    mockListTimeEntries.mockResolvedValue([
      { id: 1, date: '2026-04-20', duration_minutes: 540 },
    ]);
    mockListAbsences.mockResolvedValue([
      { id: 5, type: 'sick', is_partial: false, start_date: '2026-04-15', end_date: '2026-04-15' },
    ]);
  });

  it('renders employee month details, supports employee search, and navigates back to dashboard', async () => {
    render(<AdminReportsPage />);

    expect(await screen.findByText('סקירת דיווחים')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Alice Cohen/ })).toBeInTheDocument();

    expect(screen.getByText('ימי דיווח')).toBeInTheDocument();
    expect(screen.getByText('ימים ללא דיווח')).toBeInTheDocument();
    expect(screen.getByText('ימי העדרות')).toBeInTheDocument();
    expect(screen.getByText('יש דיווח ליום זה')).toBeInTheDocument();
    expect(screen.getByText('חסר דיווח ליום זה')).toBeInTheDocument();
    expect(screen.getByText('היום הוגדר כהעדרות')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Alice Cohen/ }));
    fireEvent.change(screen.getByPlaceholderText('חיפוש עובד לפי שם'), { target: { value: 'Bob' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Bob Levi' }));

    expect(mockSetParams).toHaveBeenCalled();
    const selectedParams = mockSetParams.mock.calls.at(-1)?.[0];
    expect(selectedParams.toString()).toContain('user_id=3');
    expect(selectedParams.toString()).toContain('month=2026-04');

    fireEvent.click(screen.getByRole('button', { name: 'חזרה ללוח הבקרה' }));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/dashboard?month=2026-04');
  });

  it('shows the expected absence labels and reported-hours summary for multiple absence types', async () => {
    mockListAbsences.mockResolvedValue([
      { id: 10, type: 'sick', is_partial: true, start_date: '2026-04-16', end_date: '2026-04-16' },
      { id: 11, type: 'reserve', is_partial: true, start_date: '2026-04-15', end_date: '2026-04-15' },
      { id: 12, type: 'vacation_full', is_partial: false, start_date: '2026-04-14', end_date: '2026-04-14' },
      { id: 13, type: 'vacation_half', is_partial: false, start_date: '2026-04-13', end_date: '2026-04-13' },
      { id: 14, type: 'other', is_partial: false, start_date: '2026-04-12', end_date: '2026-04-12' },
    ]);
    mockListTimeEntries.mockResolvedValue([
      { id: 9, date: '2026-04-20', duration_minutes: 540 },
    ]);

    render(<AdminReportsPage />);

    expect(await screen.findByText('מחלה חלקית')).toBeInTheDocument();
    expect(screen.getByText('מילואים חלקי')).toBeInTheDocument();
    expect(screen.getByText('חופשה')).toBeInTheDocument();
    expect(screen.getByText('חצי יום חופשה')).toBeInTheDocument();
    expect(screen.getAllByText('העדרות').length).toBeGreaterThan(0);
    expect(await screen.findByText('9:00 שעות')).toBeInTheDocument();
  });

  it('maps 401 and 403 loading failures to the correct user-facing messages', async () => {
    mockListTimeEntries
      .mockRejectedValueOnce({ response: { status: 401 } })
      .mockRejectedValueOnce({ response: { status: 403 } });

    const { rerender } = render(<AdminReportsPage />);

    expect(await screen.findByText('פג תוקף ההתחברות. צריך להיכנס שוב.')).toBeInTheDocument();

    rerender(<AdminReportsPage key="forbidden" />);

    expect(await screen.findByText('אין לך הרשאה לצפות בסקירת הדיווחים.')).toBeInTheDocument();
  });

  it('shows an empty state for a future month with no working days yet', async () => {
    mockSearchParams = 'user_id=2&month=2099-04';
    mockListTimeEntries.mockResolvedValue([]);
    mockListAbsences.mockResolvedValue([]);

    render(<AdminReportsPage />);

    expect(await screen.findByText('אין נתונים להצגה')).toBeInTheDocument();
    expect(screen.getByText('לא נמצאו ימי עבודה עבור החודש שנבחר.')).toBeInTheDocument();
  });

  it('auto-selects the first employee when the route has no user id', async () => {
    mockSearchParams = 'week_start_date=2026-04-07';

    render(<AdminReportsPage />);

    await waitFor(() => {
      expect(
        mockSetParams.mock.calls.some(([value]) => value.toString().includes('user_id=2'))
      ).toBe(true);
    });
    const params = mockSetParams.mock.calls.find(([value]) => value.toString().includes('user_id=2'))?.[0];
    expect(params.toString()).toContain('user_id=2');
    expect(params.toString()).toContain('month=2026-04');
  });

  it('falls back to the current month when neither month nor week is provided', async () => {
    mockSearchParams = 'user_id=2';

    render(<AdminReportsPage />);

    const today = new Date();
    const currentMonthValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    expect(await screen.findByDisplayValue(currentMonthValue)).toBeInTheDocument();
  });

  it('shows no search results when the picker filter does not match any employee', async () => {
    render(<AdminReportsPage />);

    expect(await screen.findByRole('button', { name: /Alice Cohen/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Alice Cohen/ }));
    fireEvent.change(screen.getByPlaceholderText('חיפוש עובד לפי שם'), { target: { value: 'Ziv' } });

    expect(await screen.findByText('לא נמצאו עובדים מתאימים.')).toBeInTheDocument();
  });

  it('handles user-list loading failures without crashing the picker', async () => {
    mockListUsers.mockRejectedValue(new Error('network'));

    render(<AdminReportsPage />);

    expect(await screen.findByText('סקירת דיווחים')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /בחר עובד/ }));
    expect(await screen.findByText('לא נמצאו עובדים מתאימים.')).toBeInTheDocument();
  });

  it('shows a generic error message for unexpected review-load failures', async () => {
    mockListTimeEntries.mockRejectedValue(new Error('boom'));

    render(<AdminReportsPage />);

    expect(await screen.findByText('אירעה שגיאה בזמן טעינת סקירת הדיווחים.')).toBeInTheDocument();
  });

  it('supports month navigation with arrows and direct month input', async () => {
    mockListTimeEntries
      .mockResolvedValueOnce([{ id: 1, date: '2026-04-20', duration_minutes: 540 }])
      .mockResolvedValue([{ id: 2, date: '2026-05-18', duration_minutes: 480 }]);
    mockListAbsences.mockResolvedValue([]);

    render(<AdminReportsPage />);

    expect(await screen.findByText('9:00 שעות')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'חודש הבא' }));
    await waitFor(() => expect(mockListTimeEntries).toHaveBeenLastCalledWith({ userId: 2, month: '2026-05' }));

    fireEvent.click(screen.getByRole('button', { name: 'חודש קודם' }));
    await waitFor(() => expect(mockListTimeEntries).toHaveBeenLastCalledWith({ userId: 2, month: '2026-04' }));

    fireEvent.change(screen.getByDisplayValue('2026-04'), { target: { value: '2026-03' } });
    await waitFor(() => expect(mockListTimeEntries).toHaveBeenLastCalledWith({ userId: 2, month: '2026-03' }));
    expect(mockSetParams).toHaveBeenCalled();
  });
});
