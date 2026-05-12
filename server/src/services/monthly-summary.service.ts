import type { Knex } from 'knex';
import type { AuthenticatedUser } from '../middleware/auth.middleware';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require('../database/connection') as Knex;

// Effective hours one user is expected to work in a single working day
export function computeDailyStandard(user: {
  daily_hours_override: number | null;
  employment_percentage: number;
}): number {
  const baseHours = user.daily_hours_override ?? 9;
  return baseHours * (user.employment_percentage / 100);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function totalDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function dateStr(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

// Returns true for Israel weekends: getUTCDay() returns 5=Fri, 6=Sat
function isWeekend(dow: number): boolean {
  return dow === 5 || dow === 6;
}

// Fetches national + company holiday dates in the month as a Set<"YYYY-MM-DD">
async function fetchHolidaySet(year: number, month: number): Promise<Set<string>> {
  const rows = (await db('holiday_calendar')
    .whereBetween('date', [dateStr(year, month, 1), dateStr(year, month, totalDaysInMonth(year, month))])
    .whereIn('type', ['national', 'company'])
    .pluck('date')) as unknown[];
  return new Set(rows.map((d) => String(d).slice(0, 10)));
}

// Counts working days (non-weekend, non-holiday) in the month
function countWorkingDays(year: number, month: number, holidays: Set<string>): number {
  const numDays = totalDaysInMonth(year, month);
  let count = 0;
  for (let d = 1; d <= numDays; d++) {
    const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
    if (!isWeekend(dow) && !holidays.has(dateStr(year, month, d))) count++;
  }
  return count;
}

// Counts how many working days in the month are covered by user absences
async function countAbsenceDays(
  userId: number,
  year: number,
  month: number,
  holidays: Set<string>,
): Promise<{ fullDays: number; partialDays: number }> {
  const startDate = dateStr(year, month, 1);
  const endDate = dateStr(year, month, totalDaysInMonth(year, month));

  const absences = (await db('absence_entries')
    .where('user_id', userId)
    .where('start_date', '<=', endDate)
    .where('end_date', '>=', startDate)
    .select('start_date', 'end_date', 'is_partial')) as Array<{
    start_date: string;
    end_date: string;
    is_partial: boolean;
  }>;

  const numDays = totalDaysInMonth(year, month);
  let fullDays = 0;
  let partialDays = 0;

  for (const absence of absences) {
    const absStart = String(absence.start_date).slice(0, 10);
    const absEnd = String(absence.end_date).slice(0, 10);

    for (let d = 1; d <= numDays; d++) {
      const ds = dateStr(year, month, d);
      if (ds < absStart || ds > absEnd) continue;
      const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
      if (isWeekend(dow) || holidays.has(ds)) continue;

      if (absence.is_partial) partialDays++;
      else fullDays++;
    }
  }

  return { fullDays, partialDays };
}

// Computes quota hours: (workingDays − absences) × dailyStandard
export async function computeQuotaHours(
  userId: number,
  year: number,
  month: number,
  dailyStandard: number,
): Promise<number> {
  const holidays = await fetchHolidaySet(year, month);
  const workingDays = countWorkingDays(year, month, holidays);
  const { fullDays, partialDays } = await countAbsenceDays(userId, year, month, holidays);

  const quota =
    workingDays * dailyStandard -
    fullDays * dailyStandard -
    partialDays * (dailyStandard / 2);

  return Math.round(quota * 100) / 100;
}

export interface DayStatus {
  status: 'full' | 'missing' | 'day_off' | 'half_day_off';
  reportedHours: number;
  standardHours: number;
}

export interface ProjectBreakdownItem {
  projectId: number;
  projectName: string;
  hours: number;
}

export interface MonthlySummaryResponse {
  year: number;
  month: number;
  quotaHours: number;
  reportedHours: number;
  completionPercentage: number;
  missingHoursToDate: number;
  absenceHours: number;
  daysWithoutReport: number;
  projectBreakdown: ProjectBreakdownItem[];
  dayStatuses: Record<string, DayStatus>;
}

export async function getMonthlySummary(_params: {
  userId: number;
  year: number;
  month: number;
  caller: AuthenticatedUser;
}): Promise<MonthlySummaryResponse> {
  return {} as MonthlySummaryResponse;
}
