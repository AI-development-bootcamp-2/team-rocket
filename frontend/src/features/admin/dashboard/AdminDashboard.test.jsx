import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AdminDashboard } from './AdminDashboard.jsx';

const mockNavigate = jest.fn();
const mockSetParams = jest.fn();
const mockGetAdminDashboard = jest.fn();

function createDashboardPayload(overrides = {}) {
  return {
    year: 2026,
    month: 5,
    weeks: [
      { week_start_date: '2026-05-04', in_requested_month: true },
    ],
    rows: [
      {
        user_id: 7,
        first_name: 'Alice',
        last_name: 'Cohen',
        cells: [{ week_start_date: '2026-05-04', status: 'submitted' }],
      },
    ],
    summary: {
      total_users: 1,
      submitted_this_week: 1,
      missing: 0,
      approved: 0,
      summary_week_start_date: '2026-05-04',
    },
    ...overrides,
  };
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams('month=2026-05'), mockSetParams],
}), { virtual: true });

jest.mock('../../../api/adminDashboard.api.js', () => ({
  getAdminDashboard: (...args) => mockGetAdminDashboard(...args),
}));

jest.mock('../../../components/layout/AdminShell.jsx', () => ({
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

jest.mock('../../../components/ui/EmptyState.jsx', () => ({
  EmptyState: ({ title, description }) => (
    <div>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  ),
}));

describe('AdminDashboard', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockSetParams.mockReset();
    mockGetAdminDashboard.mockReset();
  });

  it('renders monthly summary data and drills into employee details', async () => {
    mockGetAdminDashboard.mockResolvedValue(createDashboardPayload());

    render(<AdminDashboard />);

    expect(await screen.findByText('לוח בקרה')).toBeInTheDocument();
    expect(mockGetAdminDashboard).toHaveBeenCalledWith({ year: 2026, month: 5 });

    await waitFor(() => expect(screen.getAllByText('Alice Cohen').length).toBeGreaterThan(0));
    expect(screen.getByText('סה"כ עובדים')).toBeInTheDocument();
    expect(screen.getByText('הוגש החודש')).toBeInTheDocument();
    expect(screen.getAllByText('דיווח הוגש').length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: 'פירוט' })[0]);

    expect(mockNavigate).toHaveBeenCalledWith('/admin/reports?user_id=7&month=2026-05&week_start_date=2026-05-04');
  });

  it('shows a loading state while the dashboard request is pending', () => {
    const deferred = createDeferred();
    mockGetAdminDashboard.mockReturnValue(deferred.promise);

    render(<AdminDashboard />);

    expect(screen.getByText('טוען את לוח הבקרה...')).toBeInTheDocument();
  });

  it('renders an empty state when there are no employees to display', async () => {
    mockGetAdminDashboard.mockResolvedValue(createDashboardPayload({ rows: [] }));

    render(<AdminDashboard />);

    expect(await screen.findByText('אין נתונים להצגה')).toBeInTheDocument();
    expect(screen.getByText('לא נמצאו עובדים או דיווחים עבור החודש שנבחר.')).toBeInTheDocument();
  });

  it('maps 401 and 403 dashboard errors to the expected messages', async () => {
    mockGetAdminDashboard
      .mockRejectedValueOnce({ response: { status: 401 } })
      .mockRejectedValueOnce({ response: { status: 403 } });

    const { rerender } = render(<AdminDashboard />);

    expect(await screen.findByText('פג תוקף ההתחברות. צריך להיכנס שוב.')).toBeInTheDocument();

    rerender(<AdminDashboard key="forbidden" />);

    expect(await screen.findByText('אין לך הרשאה לצפות בלוח הבקרה.')).toBeInTheDocument();
  });

  it('falls back to a generic dashboard error message for unexpected failures', async () => {
    mockGetAdminDashboard.mockRejectedValue(new Error('boom'));

    render(<AdminDashboard />);

    expect(await screen.findByText('אירעה שגיאה בזמן טעינת לוח הבקרה.')).toBeInTheDocument();
  });

  it('updates the month filter, syncs the URL params, and recomputes summary cards', async () => {
    mockGetAdminDashboard
      .mockResolvedValueOnce(createDashboardPayload())
      .mockResolvedValueOnce(createDashboardPayload({
        year: 2026,
        month: 6,
        weeks: [{ week_start_date: '2026-06-01', in_requested_month: true }],
        rows: [
          {
            user_id: 9,
            first_name: 'Dana',
            last_name: 'Levy',
            cells: [{ week_start_date: '2026-06-01', status: 'missing' }],
          },
          {
            user_id: 10,
            first_name: 'Eli',
            last_name: 'Shaham',
            cells: [{ week_start_date: '2026-06-01', status: 'not_started' }],
          },
        ],
        summary: {
          total_users: 2,
          submitted_this_week: 0,
          missing: 1,
          approved: 0,
          summary_week_start_date: '2026-06-01',
        },
      }));

    render(<AdminDashboard />);

    await waitFor(() => expect(screen.getAllByText('Alice Cohen').length).toBeGreaterThan(0));

    fireEvent.change(screen.getByLabelText('חודש תצוגה'), { target: { value: '2026-06' } });

    await waitFor(() => expect(mockGetAdminDashboard).toHaveBeenLastCalledWith({ year: 2026, month: 6 }));
    expect(mockSetParams).toHaveBeenCalled();
    const lastParams = mockSetParams.mock.calls.at(-1)?.[0];
    expect(lastParams.get('month')).toBe('2026-06');

    await waitFor(() => expect(screen.getAllByText('Dana Levy').length).toBeGreaterThan(0));
    expect(screen.getAllByText('חסר דיווח').length).toBeGreaterThan(0);
    expect(screen.getAllByText('טרם התחיל דיווח').length).toBeGreaterThan(0);
    expect(screen.getAllByText('לא התחיל').length).toBeGreaterThan(0);
    expect(screen.getByText('חסרים למעקב')).toBeInTheDocument();
  });
});
