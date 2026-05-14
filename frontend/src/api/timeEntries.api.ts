import axiosClient from './axiosClient';
import type {
  CreateTimeEntryPayload,
  DailySummary,
  DropdownData,
  MonthlySummary,
  TimeEntry,
  TimeEntryMutationResponse,
  UpdateTimeEntryPayload,
} from './contracts';

interface GetDailySummaryParams {
  date?: string;
  userId?: number;
}

interface ListTimeEntriesParams {
  date?: string;
  userId?: number;
  week?: string;
  month?: string;
}

export async function getDailySummary({ date, userId }: GetDailySummaryParams = {}): Promise<DailySummary> {
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  if (userId) params.set('user_id', String(userId));
  const query = params.toString();
  const response = await axiosClient.get<DailySummary>(`/time-entries/daily-summary${query ? `?${query}` : ''}`);
  return response.data;
}

export async function getDropdownData(): Promise<DropdownData> {
  const response = await axiosClient.get<DropdownData>('/time-entries/dropdown-data');
  return response.data;
}

export async function listTimeEntries({ date, userId, week, month }: ListTimeEntriesParams = {}): Promise<TimeEntry[]> {
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  if (userId) params.set('user_id', String(userId));
  if (week) params.set('week', week);
  if (month) params.set('month', month);
  const query = params.toString();
  const response = await axiosClient.get<TimeEntry[]>(`/time-entries${query ? `?${query}` : ''}`);
  return response.data;
}

export async function getMonthlySummary({
  year,
  month,
}: {
  year: number;
  month: number;
}): Promise<MonthlySummary> {
  const response = await axiosClient.get<MonthlySummary>(
    `/monthly-summary?year=${year}&month=${month}`,
  );
  return response.data;
}

export async function createTimeEntry(payload: CreateTimeEntryPayload): Promise<TimeEntryMutationResponse> {
  const response = await axiosClient.post<TimeEntryMutationResponse>('/time-entries', payload);
  return response.data;
}

export async function updateTimeEntry(id: number, payload: UpdateTimeEntryPayload): Promise<TimeEntryMutationResponse> {
  const response = await axiosClient.put<TimeEntryMutationResponse>(`/time-entries/${id}`, payload);
  return response.data;
}

export async function deleteTimeEntry(id: number): Promise<null> {
  await axiosClient.delete(`/time-entries/${id}`);
  return null;
}
