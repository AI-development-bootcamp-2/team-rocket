import { serializeAbsence } from '../../../src/services/absences.service';

describe('absences.service serialization', () => {
  it('normalizes date-valued absence rows into YYYY-MM-DD API fields', () => {
    const serialized = serializeAbsence({
      id: 17,
      user_id: 9,
      type: 'sick',
      start_date: new Date('2026-05-07T00:00:00Z'),
      end_date: new Date('2026-05-10T00:00:00Z'),
      is_partial: false,
      notes: 'Medical leave',
      status: 'draft',
      version: 0,
      deleted_at: null,
      created_at: new Date('2026-05-01T09:00:00Z'),
      updated_at: new Date('2026-05-01T09:00:00Z'),
      attachments: [],
    });

    expect(serialized.start_date).toBe('2026-05-07');
    expect(serialized.end_date).toBe('2026-05-10');
    expect(serialized.working_days_count).toBe(2);
    expect(serialized.quota_hours_impact).toBe(18);
  });
});
