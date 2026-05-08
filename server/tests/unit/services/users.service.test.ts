import {
  parseEmploymentPercentage,
  parseEmploymentType,
  parseIsActiveFilter,
  parseOptionalBoolean,
  parseOptionalSmallInt,
  parseOptionalText,
  parseRequiredText,
  parseRoleFilter,
  parseRoleValue,
  parseSortPreferences,
  parseUserId,
  toAuditUserValue,
} from '../../../src/services/users.service';

describe('users.service parsing helpers', () => {
  describe('parseIsActiveFilter', () => {
    it('accepts true/false strings and empty values', () => {
      expect(parseIsActiveFilter('true')).toBe(true);
      expect(parseIsActiveFilter('false')).toBe(false);
      expect(parseIsActiveFilter(undefined)).toBeUndefined();
      expect(parseIsActiveFilter('')).toBeUndefined();
    });

    it('rejects invalid values', () => {
      expect(() => parseIsActiveFilter('yes')).toThrow(expect.objectContaining({ statusCode: 400 }));
    });
  });

  describe('parseRoleFilter / parseRoleValue', () => {
    it('accepts supported roles', () => {
      expect(parseRoleFilter('admin')).toBe('admin');
      expect(parseRoleFilter('user')).toBe('user');
      expect(parseRoleValue('admin')).toBe('admin');
    });

    it('allows empty filter values but rejects missing role value', () => {
      expect(parseRoleFilter(undefined)).toBeUndefined();
      expect(parseRoleFilter('')).toBeUndefined();
      expect(() => parseRoleValue(undefined)).toThrow(expect.objectContaining({ statusCode: 400 }));
    });

    it('rejects unsupported roles', () => {
      expect(() => parseRoleFilter('manager')).toThrow(expect.objectContaining({ statusCode: 400 }));
    });
  });

  describe('parseUserId', () => {
    it('accepts positive integer IDs', () => {
      expect(parseUserId('17')).toBe(17);
    });

    it('rejects invalid IDs', () => {
      expect(() => parseUserId('0')).toThrow(expect.objectContaining({ statusCode: 400 }));
      expect(() => parseUserId('abc')).toThrow(expect.objectContaining({ statusCode: 400 }));
    });
  });

  describe('parseOptionalText / parseRequiredText', () => {
    it('trims valid string values', () => {
      expect(parseOptionalText('  dept  ')).toBe('dept');
      expect(parseRequiredText('  first  ', 'first_name')).toBe('first');
    });

    it('normalizes blank optional text to null', () => {
      expect(parseOptionalText('   ')).toBeNull();
    });

    it('rejects invalid required text values', () => {
      expect(() => parseRequiredText('', 'email')).toThrow(expect.objectContaining({ statusCode: 400 }));
      expect(() => parseOptionalText(5)).toThrow(expect.objectContaining({ statusCode: 400 }));
    });
  });

  describe('parseOptionalBoolean', () => {
    it('accepts booleans and undefined', () => {
      expect(parseOptionalBoolean(true)).toBe(true);
      expect(parseOptionalBoolean(false)).toBe(false);
      expect(parseOptionalBoolean(undefined)).toBeUndefined();
    });

    it('rejects non-boolean values', () => {
      expect(() => parseOptionalBoolean('true')).toThrow(expect.objectContaining({ statusCode: 400 }));
    });
  });

  describe('employment fields', () => {
    it('accepts supported employment types', () => {
      expect(parseEmploymentType('full_time')).toBe('full_time');
      expect(parseEmploymentType('part_time')).toBe('part_time');
      expect(parseEmploymentType('contractor')).toBe('contractor');
      expect(parseEmploymentType('')).toBeNull();
      expect(parseEmploymentType(undefined)).toBeUndefined();
    });

    it('rejects unsupported employment types', () => {
      expect(() => parseEmploymentType('intern')).toThrow(expect.objectContaining({ statusCode: 400 }));
    });

    it('accepts valid employment percentages only', () => {
      expect(parseEmploymentPercentage(0)).toBe(0);
      expect(parseEmploymentPercentage(100)).toBe(100);
      expect(parseEmploymentPercentage(undefined)).toBeUndefined();
    });

    it('rejects invalid employment percentages', () => {
      expect(() => parseEmploymentPercentage(101)).toThrow(expect.objectContaining({ statusCode: 400 }));
      expect(() => parseEmploymentPercentage(50.5)).toThrow(expect.objectContaining({ statusCode: 400 }));
    });
  });

  describe('parseOptionalSmallInt', () => {
    it('accepts integers, empty strings, and undefined', () => {
      expect(parseOptionalSmallInt(8, 'daily_hours_override')).toBe(8);
      expect(parseOptionalSmallInt('', 'daily_hours_override')).toBeNull();
      expect(parseOptionalSmallInt(undefined, 'daily_hours_override')).toBeUndefined();
    });

    it('rejects non-integer values', () => {
      expect(() => parseOptionalSmallInt('8', 'daily_hours_override')).toThrow(
        expect.objectContaining({ statusCode: 400 }),
      );
    });
  });

  describe('parseSortPreferences', () => {
    it('accepts plain objects', () => {
      const value = { client_id: 1, project_id: 2, task_id: 3 };
      expect(parseSortPreferences(value)).toEqual(value);
    });

    it('rejects arrays and primitives', () => {
      expect(() => parseSortPreferences([])).toThrow(expect.objectContaining({ statusCode: 400 }));
      expect(() => parseSortPreferences('bad')).toThrow(expect.objectContaining({ statusCode: 400 }));
    });
  });
});

describe('toAuditUserValue', () => {
  it('maps DB user fields into the audit payload shape', () => {
    expect(
      toAuditUserValue({
        id: 9,
        email: 'audit@test.com',
        first_name: 'Audit',
        last_name: 'User',
        role: 'admin',
        is_active: true,
        must_change_password: false,
        created_at: new Date(),
        updated_at: new Date(),
      }),
    ).toEqual({
      id: 9,
      email: 'audit@test.com',
      firstName: 'Audit',
      lastName: 'User',
      role: 'admin',
      isActive: true,
      mustChangePassword: false,
    });
  });
});
