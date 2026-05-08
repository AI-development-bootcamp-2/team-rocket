import {
  parseClientId,
  parseOptionalBoolean,
  parseOptionalText,
  parseRequiredText,
  toAuditClientValue,
} from '../../../src/services/clients.service';

describe('clients.service parsing helpers', () => {
  describe('parseClientId', () => {
    it('accepts positive integer ID strings', () => {
      expect(parseClientId('1')).toBe(1);
      expect(parseClientId('42')).toBe(42);
    });

    it('rejects zero, negatives, and non-integer strings', () => {
      expect(() => parseClientId('0')).toThrow(expect.objectContaining({ statusCode: 400 }));
      expect(() => parseClientId('-5')).toThrow(expect.objectContaining({ statusCode: 400 }));
      expect(() => parseClientId('abc')).toThrow(expect.objectContaining({ statusCode: 400 }));
      expect(() => parseClientId('')).toThrow(expect.objectContaining({ statusCode: 400 }));
    });
  });

  describe('parseRequiredText / parseOptionalText', () => {
    it('trims valid string values', () => {
      expect(parseRequiredText('  Acme Corp  ', 'name')).toBe('Acme Corp');
      expect(parseOptionalText('  hello  ')).toBe('hello');
    });

    it('normalizes blank optional text to null and missing optional text to undefined', () => {
      expect(parseOptionalText('')).toBeNull();
      expect(parseOptionalText('   ')).toBeNull();
      expect(parseOptionalText(undefined)).toBeUndefined();
      expect(parseOptionalText(null)).toBeUndefined();
    });

    it('rejects empty / whitespace / non-string required text', () => {
      expect(() => parseRequiredText('', 'name')).toThrow(
        expect.objectContaining({ statusCode: 400 }),
      );
      expect(() => parseRequiredText('   ', 'name')).toThrow(
        expect.objectContaining({ statusCode: 400 }),
      );
      expect(() => parseRequiredText(undefined, 'name')).toThrow(
        expect.objectContaining({ statusCode: 400 }),
      );
      expect(() => parseRequiredText(123, 'name')).toThrow(
        expect.objectContaining({ statusCode: 400 }),
      );
    });

    it('rejects non-string optional text values', () => {
      expect(() => parseOptionalText(5)).toThrow(expect.objectContaining({ statusCode: 400 }));
      expect(() => parseOptionalText(true)).toThrow(expect.objectContaining({ statusCode: 400 }));
    });
  });

  describe('parseOptionalBoolean', () => {
    it('accepts booleans, undefined, and null', () => {
      expect(parseOptionalBoolean(true, 'is_active')).toBe(true);
      expect(parseOptionalBoolean(false, 'is_active')).toBe(false);
      expect(parseOptionalBoolean(undefined, 'is_active')).toBeUndefined();
      expect(parseOptionalBoolean(null, 'is_active')).toBeUndefined();
    });

    it('rejects non-boolean values', () => {
      expect(() => parseOptionalBoolean('true', 'is_active')).toThrow(
        expect.objectContaining({ statusCode: 400 }),
      );
      expect(() => parseOptionalBoolean(1, 'is_active')).toThrow(
        expect.objectContaining({ statusCode: 400 }),
      );
    });
  });
});

describe('toAuditClientValue', () => {
  it('maps DB client fields into the audit payload shape (camelCase, drops timestamps)', () => {
    expect(
      toAuditClientValue({
        id: 12,
        client_number: '#042',
        name: 'Audit Client',
        contact_info: 'phone: 050-0000000',
        is_active: true,
        created_at: new Date('2026-01-01T00:00:00Z'),
        updated_at: new Date('2026-01-02T00:00:00Z'),
      }),
    ).toEqual({
      id: 12,
      clientNumber: '#042',
      name: 'Audit Client',
      contactInfo: 'phone: 050-0000000',
      isActive: true,
    });
  });

  it('preserves nullable fields as null', () => {
    expect(
      toAuditClientValue({
        id: 9,
        client_number: null,
        name: 'No Number',
        contact_info: null,
        is_active: false,
        created_at: new Date(),
        updated_at: new Date(),
      }),
    ).toMatchObject({
      clientNumber: null,
      contactInfo: null,
      isActive: false,
    });
  });
});
