import { fireEvent, render, screen } from '@testing-library/react';
import { SubmissionStatusTable } from './SubmissionStatusTable.jsx';

describe('SubmissionStatusTable', () => {
  it('renders employee rows and forwards clicks with the derived month cell payload', () => {
    const onCellClick = jest.fn();

    render(
      <SubmissionStatusTable
        monthLabel="מאי 2026"
        onCellClick={onCellClick}
        rows={[
          {
            user_id: 7,
            first_name: 'Alice',
            last_name: 'Cohen',
            month_status: 'missing',
            target_week_start_date: '2026-05-04',
          },
        ]}
      />
    );

    expect(screen.getAllByText('Alice Cohen').length).toBeGreaterThan(0);
    expect(screen.getAllByText('חסר דיווח').length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: 'פירוט' })[0]);

    expect(onCellClick).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 7 }),
      { week_start_date: '2026-05-04', status: 'missing' }
    );
  });

  it('falls back to the default status meta and placeholder initials for unexpected data', () => {
    render(
      <SubmissionStatusTable
        monthLabel="יוני 2026"
        rows={[
          {
            user_id: 9,
            first_name: '',
            last_name: '',
            month_status: 'unexpected',
            target_week_start_date: null,
          },
        ]}
      />
    );

    expect(screen.getAllByText('?').length).toBeGreaterThan(0);
    expect(screen.getAllByText('טרם התחיל דיווח').length).toBeGreaterThan(0);
  });
});
