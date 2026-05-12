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

// Pads a single-digit number with a leading zero (e.g. 5 → "05")
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// Returns the number of calendar days in the given month
function totalDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// Builds a "YYYY-MM-DD" string from year/month/day parts
function dateStr(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

// Normalises a value from the DB to "YYYY-MM-DD".
// pg returns `date` columns as Date objects (local midnight), not strings.
function toDateStr(d: unknown): string {
  if (d instanceof Date) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  return String(d).slice(0, 10);
}

// Rounds a number to at most 2 decimal places
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Returns true for Israel weekends: Fri(5) and Sat(6)
function isWeekend(dow: number): boolean {
  return dow === 5 || dow === 6;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m ?? 0);
}

// Total duration_minutes for non-deleted entries between two dates (inclusive)
async function sumDurationInRange(userId: number, from: string, to: string): Promise<number> {
  const [{ total }] = (await db('time_entries')
    .where('user_id', userId)
    .whereNull('deleted_at')
    .whereBetween('date', [from, to])
    .sum('duration_minutes as total')) as [{ total: string | null }];
  return Number(total ?? 0);
}

// start_time + end_time for every non-deleted entry on a given date
async function fetchEntryTimesOnDate(
  userId: number,
  date: string,
): Promise<Array<{ start_time: string; end_time: string }>> {
  return db('time_entries')
    .where('user_id', userId)
    .whereNull('deleted_at')
    .where('date', date)
    .select('start_time', 'end_time') as Promise<Array<{ start_time: string; end_time: string }>>;
}

// Sum of post-midnight minutes for entries where end_time < start_time
export function crossMidnightOverflow(
  entries: Array<{ start_time: string; end_time: string }>,
): number {
  return entries.reduce((sum, e) => {
    const endMin = timeToMinutes(e.end_time);
    return endMin < timeToMinutes(e.start_time) ? sum + endMin : sum;
  }, 0);
}

// Reported hours for the month, with cross-month-boundary entries split at midnight
export async function computeReportedHours(
  userId: number,
  year: number,
  month: number,
): Promise<number> {
  const startOfMonth = dateStr(year, month, 1);
  const endOfMonth = dateStr(year, month, totalDaysInMonth(year, month));

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonthLastDay = dateStr(prevYear, prevMonth, totalDaysInMonth(prevYear, prevMonth));

  const [rawDuration, lastDayEntries, prevLastDayEntries] = await Promise.all([
    sumDurationInRange(userId, startOfMonth, endOfMonth),
    fetchEntryTimesOnDate(userId, endOfMonth),
    fetchEntryTimesOnDate(userId, prevMonthLastDay),
  ]);

  const totalMinutes =
    rawDuration -
    crossMidnightOverflow(lastDayEntries) + // outflow to next month
    crossMidnightOverflow(prevLastDayEntries); // inflow from previous month

  return Math.round((totalMinutes / 60) * 100) / 100;
}

// Fetches national + company holiday dates in the month as a Set<"YYYY-MM-DD">
async function fetchHolidaySet(year: number, month: number): Promise<Set<string>> {
  const rows = (await db('holiday_calendar')
    .whereBetween('date', [
      dateStr(year, month, 1),
      dateStr(year, month, totalDaysInMonth(year, month)),
    ])
    .whereIn('type', ['national', 'company'])
    .pluck('date')) as unknown[];
  return new Set(rows.map(toDateStr));
}

// Counts working days (non-weekend, non-holiday) in the month
export function countWorkingDaysInMonth(year: number, month: number, holidays: string[]): number {
  const holidaySet = new Set(holidays);
  const numDays = totalDaysInMonth(year, month);
  let count = 0;
  for (let d = 1; d <= numDays; d++) {
    const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
    if (!isWeekend(dow) && !holidaySet.has(dateStr(year, month, d))) count++;
  }
  return count;
}

// Returns every working-day date string in the month (non-weekend, non-holiday)
function listWorkingDays(year: number, month: number, holidays: Set<string>): string[] {
  const numDays = totalDaysInMonth(year, month);
  const workingDates: string[] = [];
  for (let dayNum = 1; dayNum <= numDays; dayNum++) {
    const date = dateStr(year, month, dayNum);
    const dayOfWeek = new Date(Date.UTC(year, month - 1, dayNum)).getUTCDay();
    if (!isWeekend(dayOfWeek) && !holidays.has(date)) workingDates.push(date);
  }
  return workingDates;
}

// Returns the set of dates (YYYY-MM-DD) where the user has at least one non-deleted time entry
async function fetchDatesWithEntries(
  userId: number,
  year: number,
  month: number,
): Promise<Set<string>> {
  const rows = (await db('time_entries')
    .where('user_id', userId)
    .whereNull('deleted_at')
    .whereRaw('EXTRACT(YEAR FROM date) = ? AND EXTRACT(MONTH FROM date) = ?', [year, month])
    .pluck('date')) as unknown[];
  return new Set(rows.map(toDateStr));
}

// Returns the set of working-day dates covered by a full-day absence.
// Multi-day absences are expanded day by day; weekends and holidays are already excluded
// from workingDayDates so they never appear in the result.
async function fetchFullAbsenceDates(
  userId: number,
  year: number,
  month: number,
  workingDayDates: string[],
): Promise<Set<string>> {
  const startOfMonth = dateStr(year, month, 1);
  const endOfMonth = dateStr(year, month, totalDaysInMonth(year, month));
  const absences = (await db('absence_entries')
    .where('user_id', userId)
    .where('is_partial', false)
    .where('start_date', '<=', endOfMonth)
    .where('end_date', '>=', startOfMonth)
    .select('start_date', 'end_date')) as Array<{ start_date: string; end_date: string }>;

  const fullAbsenceDates = new Set<string>();
  for (const absence of absences) {
    const absenceStart = toDateStr(absence.start_date);
    const absenceEnd = toDateStr(absence.end_date);
    for (const date of workingDayDates) {
      if (date >= absenceStart && date <= absenceEnd) fullAbsenceDates.add(date);
    }
  }
  return fullAbsenceDates;
}

// Pure: counts working days with no entry and no full-day absence.
// Partial-absence days still count — only a full-day absence (or an entry) clears a day.
export function buildDaysWithoutReport(
  workingDayDates: string[],
  datesWithEntries: Set<string>,
  fullAbsenceDates: Set<string>,
): number {
  const count = workingDayDates.filter(
    (date) => !datesWithEntries.has(date) && !fullAbsenceDates.has(date),
  ).length;
  return count;
}

// DB-backed: fetches data via helpers then delegates to buildDaysWithoutReport
export async function computeDaysWithoutReport(
  userId: number,
  year: number,
  month: number,
): Promise<number> {
  const now = new Date();
  const todayYear = now.getUTCFullYear();
  const todayMonth = now.getUTCMonth() + 1;
  const todayDay = now.getUTCDate();

  let cutoffDate: string;
  if (todayYear < year || (todayYear === year && todayMonth < month)) {
    return 0; // future month — no days have passed yet
  } else if (todayYear > year || (todayYear === year && todayMonth > month)) {
    cutoffDate = dateStr(year, month, totalDaysInMonth(year, month));
  } else {
    cutoffDate = dateStr(year, month, todayDay);
  }

  const holidays = await fetchHolidaySet(year, month);
  const allWorkingDayDates = listWorkingDays(year, month, holidays);
  const workingDayDates = allWorkingDayDates.filter((d) => d <= cutoffDate);
  const datesWithEntries = await fetchDatesWithEntries(userId, year, month);
  const fullAbsenceDates = await fetchFullAbsenceDates(userId, year, month, workingDayDates);
  const daysWithoutReport = buildDaysWithoutReport(
    workingDayDates,
    datesWithEntries,
    fullAbsenceDates,
  );
  return daysWithoutReport;
}

// Pure: absence hours for the month — full-day × dailyStandard, partial × dailyStandard/2
export function buildAbsenceHours(
  fullDays: number,
  partialDays: number,
  dailyStandard: number,
): number {
  const hours = fullDays * dailyStandard + partialDays * (dailyStandard / 2);
  return Math.round(hours * 100) / 100;
}

// DB-backed: counts absence days then delegates to buildAbsenceHours; holidays are excluded
export async function computeAbsenceHours(
  userId: number,
  year: number,
  month: number,
  dailyStandard: number,
): Promise<number> {
  const holidays = await fetchHolidaySet(year, month);
  const { fullDays, partialDays } = await countAbsenceDays(userId, year, month, holidays);
  const absenceHours = buildAbsenceHours(fullDays, partialDays, dailyStandard);
  return absenceHours;
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
    const absStart = toDateStr(absence.start_date);
    const absEnd = toDateStr(absence.end_date);

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

// Counts working days (non-weekend, non-holiday) from day 1 up to cutoffDay inclusive
export function countPassedWorkingDays(
  year: number,
  month: number,
  cutoffDay: number,
  holidays: string[],
): number {
  if (cutoffDay <= 0) return 0;
  const holidaySet = new Set(holidays);
  const lastDay = Math.min(cutoffDay, totalDaysInMonth(year, month));
  let count = 0;
  for (let d = 1; d <= lastDay; d++) {
    const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
    if (!isWeekend(dow) && !holidaySet.has(dateStr(year, month, d))) count++;
  }
  return count;
}

// How many hours the user should have reported by now vs. how many they actually did
export function buildMissingHoursToDate(
  passedWorkingDays: number,
  dailyStandard: number,
  reportedHours: number,
): number {
  const expected = passedWorkingDays * dailyStandard;
  return Math.max(0, Math.round((expected - reportedHours) * 100) / 100);
}

// Calculates expected monthly work hours from working days minus absences, clamped to 0
export function buildQuotaHours(
  workingDays: number,
  dailyStandard: number,
  fullDayAbsences: number,
  partialAbsences: number,
): number {
  const quota =
    workingDays * dailyStandard -
    fullDayAbsences * dailyStandard -
    partialAbsences * (dailyStandard / 2);
  return Math.max(0, Math.round(quota * 100) / 100);
}

// Counts full-day and partial absence days that fall within days 1..cutoffDay of the month
async function countPassedAbsenceDays(
  userId: number,
  year: number,
  month: number,
  cutoffDay: number,
  holidays: Set<string>,
): Promise<{ fullDays: number; partialDays: number }> {
  const startDate = dateStr(year, month, 1);
  const endDate = dateStr(year, month, cutoffDay);

  const absences = (await db('absence_entries')
    .where('user_id', userId)
    .where('start_date', '<=', endDate)
    .where('end_date', '>=', startDate)
    .select('start_date', 'end_date', 'is_partial')) as Array<{
    start_date: string;
    end_date: string;
    is_partial: boolean;
  }>;

  let fullDays = 0;
  let partialDays = 0;

  for (const absence of absences) {
    const absStart = toDateStr(absence.start_date);
    const absEnd = toDateStr(absence.end_date);

    for (let d = 1; d <= cutoffDay; d++) {
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

// Expected hours the user should have worked from day 1 up to today (or end of month for past months)
export async function computeExpectedHoursToDate(
  userId: number,
  year: number,
  month: number,
  dailyStandard: number,
): Promise<number> {
  const now = new Date();
  const todayYear = now.getUTCFullYear();
  const todayMonth = now.getUTCMonth() + 1;
  const todayDay = now.getUTCDate();

  if (todayYear < year || (todayYear === year && todayMonth < month)) {
    return 0; // future month — no days have passed yet
  }

  const cutoffDay =
    todayYear > year || (todayYear === year && todayMonth > month)
      ? totalDaysInMonth(year, month)
      : todayDay;

  const holidays = await fetchHolidaySet(year, month);
  const rawPassed = countPassedWorkingDays(year, month, cutoffDay, [...holidays]);
  const { fullDays, partialDays } = await countPassedAbsenceDays(
    userId,
    year,
    month,
    cutoffDay,
    holidays,
  );
  const adjustedPassed = Math.max(0, rawPassed - fullDays - partialDays * 0.5);
  return round2(adjustedPassed * dailyStandard);
}

// Fetches holidays and absences, determines how many working days have passed, and delegates to buildMissingHoursToDate
export async function computeMissingHoursToDate(
  userId: number,
  year: number,
  month: number,
  dailyStandard: number,
  reportedHours: number,
): Promise<number> {
  const expectedToDate = await computeExpectedHoursToDate(userId, year, month, dailyStandard);
  return Math.max(0, round2(expectedToDate - reportedHours));
}

// Fetches holidays and absences from DB, then calculates expected monthly work hours
export async function computeQuotaHours(
  userId: number,
  year: number,
  month: number,
  dailyStandard: number,
): Promise<number> {
  const holidays = await fetchHolidaySet(year, month);
  const workingDays = countWorkingDaysInMonth(year, month, [...holidays]);
  const { fullDays, partialDays } = await countAbsenceDays(userId, year, month, holidays);

  return buildQuotaHours(workingDays, dailyStandard, fullDays, partialDays);
}

// Aggregates time entries by project for the month, excluding projects with 0 hours,
// sorted by hours descending. Hours are rounded to 2 decimal places.
export async function computeProjectBreakdown(
  userId: number,
  year: number,
  month: number,
): Promise<ProjectBreakdownItem[]> {
  const rows = (await db('time_entries')
    .join('projects', 'time_entries.project_id', 'projects.id')
    .where('time_entries.user_id', userId)
    .whereNull('time_entries.deleted_at')
    .whereRaw(
      'EXTRACT(YEAR FROM time_entries.date) = ? AND EXTRACT(MONTH FROM time_entries.date) = ?',
      [year, month],
    )
    .groupBy('time_entries.project_id', 'projects.name')
    .select('time_entries.project_id as projectId', 'projects.name as projectName')
    .sum('time_entries.duration_minutes as totalMinutes')) as Array<{
    projectId: number;
    projectName: string;
    totalMinutes: string;
  }>;

  const breakdown = rows
    .map((row) => ({
      projectId: row.projectId,
      projectName: row.projectName,
      hours: Math.round((Number(row.totalMinutes) / 60) * 100) / 100,
    }))
    .filter((item) => item.hours > 0)
    .sort((a, b) => b.hours - a.hours);

  return breakdown;
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

export async function getMonthlySummary(params: {
  userId: number;
  year: number;
  month: number;
  caller: AuthenticatedUser;
}): Promise<MonthlySummaryResponse> {
  const { userId, year, month } = params;

  const user = (await db('users')
    .where('id', userId)
    .select('daily_hours_override', 'employment_percentage')
    .first()) as { daily_hours_override: number | null; employment_percentage: number } | undefined;

  if (!user) {
    const { AppError } = await import('../middleware/error.middleware');
    throw new AppError('User not found', 404);
  }

  const dailyStandard = computeDailyStandard(user);
  const [quotaHours, reportedHours] = await Promise.all([
    computeExpectedHoursToDate(userId, year, month, dailyStandard),
    computeReportedHours(userId, year, month),
  ]);
  const completionPercentage = quotaHours > 0 ? Math.floor((reportedHours / quotaHours) * 100) : 0;
  const missingHoursToDate = Math.max(0, round2(quotaHours - reportedHours));
  const daysWithoutReport = await computeDaysWithoutReport(userId, year, month);
  const absenceHours = await computeAbsenceHours(userId, year, month, dailyStandard);
  const projectBreakdown = await computeProjectBreakdown(userId, year, month);

  return {
    year,
    month,
    quotaHours: round2(quotaHours),
    reportedHours: round2(reportedHours),
    completionPercentage,
    missingHoursToDate: round2(missingHoursToDate),
    absenceHours: round2(absenceHours),
    daysWithoutReport,
    projectBreakdown: projectBreakdown.map((item) => ({ ...item, hours: round2(item.hours) })),
    dayStatuses: {},
  };
}
