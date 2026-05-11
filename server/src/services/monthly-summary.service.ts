import type { AuthenticatedUser } from '../middleware/auth.middleware';

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
