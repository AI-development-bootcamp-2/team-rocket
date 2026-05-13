import type { Knex } from 'knex';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require('../database/connection') as Knex;

export type DashboardCellStatus =
  | 'not_started'
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'missing';

export interface DashboardWeekColumn {
  week_start_date: string;
  week_end_date: string;
  in_requested_month: boolean;
}

export interface DashboardUserRow {
  user_id: number;
  first_name: string;
  last_name: string;
  cells: Array<{
    week_start_date: string;
    status: DashboardCellStatus;
  }>;
}

export interface DashboardSummary {
  total_users: number;
  submitted_this_week: number;
  missing: number;
  approved: number;
  summary_week_start_date: string;
}

export interface AdminDashboardResponse {
  year: number;
  month: number;
  weeks: DashboardWeekColumn[];
  rows: DashboardUserRow[];
  summary: DashboardSummary;
}

interface DashboardMatrixRow {
  user_id: number;
  first_name: string;
  last_name: string;
  week_start_date: string | Date;
  status: DashboardCellStatus;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDateOnly(value: string | Date): string {
  if (typeof value === 'string') return value;
  return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
}

function parseDateOnly(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Invalid date: ${value}`);
  }
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function shiftDate(dateStr: string, days: number): string {
  const date = parseDateOnly(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function getWeekStartDate(dateStr: string): string {
  const date = parseDateOnly(dateStr);
  const dayOfWeek = date.getUTCDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  date.setUTCDate(date.getUTCDate() + daysToMonday);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function getIsraelToday(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

function getMonthBounds(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${pad2(month)}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${pad2(month)}-${pad2(lastDay)}`;
  return { start, end };
}

function getWeeksForMonth(year: number, month: number): DashboardWeekColumn[] {
  const { start, end } = getMonthBounds(year, month);
  const firstWeekStart = getWeekStartDate(start);
  const weeks: DashboardWeekColumn[] = [];

  for (let weekStart = firstWeekStart; weekStart <= end; weekStart = shiftDate(weekStart, 7)) {
    const weekEnd = shiftDate(weekStart, 6);
    weeks.push({
      week_start_date: weekStart,
      week_end_date: weekEnd,
      in_requested_month: weekEnd >= start && weekStart <= end,
    });
  }

  return weeks;
}

function buildWeekValuesSql(count: number): string {
  return Array.from({ length: count }, () => '(?::date)').join(', ');
}

function groupRows(rows: DashboardMatrixRow[], weeks: DashboardWeekColumn[]): DashboardUserRow[] {
  const grouped = new Map<number, DashboardUserRow>();

  for (const row of rows) {
    let target = grouped.get(row.user_id);
    if (!target) {
      target = {
        user_id: row.user_id,
        first_name: row.first_name,
        last_name: row.last_name,
        cells: [],
      };
      grouped.set(row.user_id, target);
    }

    target.cells.push({
      week_start_date: formatDateOnly(row.week_start_date),
      status: row.status,
    });
  }

  for (const userRow of grouped.values()) {
    const statusByWeek = new Map(userRow.cells.map((cell) => [cell.week_start_date, cell.status]));
    userRow.cells = weeks.map((week) => ({
      week_start_date: week.week_start_date,
      status: statusByWeek.get(week.week_start_date) ?? 'not_started',
    }));
  }

  return Array.from(grouped.values());
}

export async function getAdminDashboard(year: number, month: number): Promise<AdminDashboardResponse> {
  const weeks = getWeeksForMonth(year, month);
  const weekBindings = weeks.map((week) => week.week_start_date);
  const weekValuesSql = buildWeekValuesSql(weeks.length);

  const matrixSql = `
    WITH requested_weeks(week_start_date) AS (
      VALUES ${weekValuesSql}
    )
    SELECT
      u.id AS user_id,
      u.first_name,
      u.last_name,
      rw.week_start_date,
      CASE
        WHEN ws.status = 'draft'
          AND rw.week_start_date + INTERVAL '7 days' < NOW() AT TIME ZONE 'Asia/Jerusalem'
          THEN 'missing'
        WHEN ws.status IS NULL
          AND rw.week_start_date + INTERVAL '7 days' < NOW() AT TIME ZONE 'Asia/Jerusalem'
          THEN 'missing'
        WHEN ws.status IS NULL THEN 'not_started'
        ELSE ws.status::text
      END AS status
    FROM users u
    CROSS JOIN requested_weeks rw
    LEFT JOIN weekly_submissions ws
      ON ws.user_id = u.id
     AND ws.week_start_date = rw.week_start_date
    WHERE u.role = 'user'
      AND u.is_active = true
    ORDER BY LOWER(u.first_name), LOWER(u.last_name), u.id, rw.week_start_date
  `;

  const matrixResult = await db.raw(matrixSql, weekBindings);
  const matrixRows = matrixResult.rows as DashboardMatrixRow[];

  const currentWeekStart = getWeekStartDate(getIsraelToday());
  const summarySql = `
    SELECT
      COUNT(*)::int AS total_users,
      COUNT(*) FILTER (WHERE effective_status = 'submitted')::int AS submitted_this_week,
      COUNT(*) FILTER (WHERE effective_status = 'missing')::int AS missing,
      COUNT(*) FILTER (WHERE effective_status = 'approved')::int AS approved
    FROM (
      SELECT
        u.id,
        CASE
          WHEN ws.status = 'draft'
            AND ?::date + INTERVAL '7 days' < NOW() AT TIME ZONE 'Asia/Jerusalem'
            THEN 'missing'
          WHEN ws.status IS NULL
            AND ?::date + INTERVAL '7 days' < NOW() AT TIME ZONE 'Asia/Jerusalem'
            THEN 'missing'
          WHEN ws.status IS NULL THEN 'not_started'
          ELSE ws.status::text
        END AS effective_status
      FROM users u
      LEFT JOIN weekly_submissions ws
        ON ws.user_id = u.id
       AND ws.week_start_date = ?::date
      WHERE u.role = 'user'
        AND u.is_active = true
    ) status_matrix
  `;

  const summaryResult = await db.raw(summarySql, [currentWeekStart, currentWeekStart, currentWeekStart]);
  const [summaryRow] = summaryResult.rows as Array<{
    total_users: number | string;
    submitted_this_week: number | string;
    missing: number | string;
    approved: number | string;
  }>;

  return {
    year,
    month,
    weeks,
    rows: groupRows(matrixRows, weeks),
    summary: {
      total_users: Number(summaryRow?.total_users ?? 0),
      submitted_this_week: Number(summaryRow?.submitted_this_week ?? 0),
      missing: Number(summaryRow?.missing ?? 0),
      approved: Number(summaryRow?.approved ?? 0),
      summary_week_start_date: currentWeekStart,
    },
  };
}
