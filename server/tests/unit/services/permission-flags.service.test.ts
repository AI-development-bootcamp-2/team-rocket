import { parseFlagName, parseScopedProjectIds } from '../../../src/services/permission-flags.service';

describe('permission-flags.service parsing helpers', () => {
  describe('parseFlagName', () => {
    it('accepts canAssignProjectTasks only', () => {
      expect(parseFlagName('canAssignProjectTasks')).toBe('canAssignProjectTasks');
    });

    it('rejects unsupported flag names', () => {
      expect(() => parseFlagName('canDoAnything')).toThrow(expect.objectContaining({ statusCode: 400 }));
    });
  });

  describe('parseScopedProjectIds', () => {
    it('accepts positive integer project IDs', () => {
      expect(parseScopedProjectIds([1, 2, 3])).toEqual([1, 2, 3]);
    });

    it('deduplicates repeated project IDs', () => {
      expect(parseScopedProjectIds([4, 4, 2, 4, 2])).toEqual([4, 2]);
    });

    it('rejects non-array values', () => {
      expect(() => parseScopedProjectIds('1,2,3')).toThrow(
        expect.objectContaining({ statusCode: 400 }),
      );
    });

    it('rejects invalid project IDs', () => {
      expect(() => parseScopedProjectIds([1, 0])).toThrow(expect.objectContaining({ statusCode: 400 }));
      expect(() => parseScopedProjectIds([1, 1.5])).toThrow(expect.objectContaining({ statusCode: 400 }));
      expect(() => parseScopedProjectIds([1, '2'])).toThrow(expect.objectContaining({ statusCode: 400 }));
    });
  });
});
