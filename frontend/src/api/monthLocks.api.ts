import axiosClient from './axiosClient';
import type { MonthLockListItem, MonthLockStatus } from './contracts';

export async function listMonths(): Promise<MonthLockListItem[]> {
  const response = await axiosClient.get<MonthLockListItem[]>('/admin/months');
  return response.data;
}

export async function getMonthStatus(year: number, month: number): Promise<MonthLockStatus> {
  const response = await axiosClient.get<MonthLockStatus>(`/admin/months/${year}/${month}/status`);
  return response.data;
}

export async function lockMonth(year: number, month: number): Promise<MonthLockListItem> {
  const response = await axiosClient.post<MonthLockListItem>(`/admin/months/${year}/${month}/lock`);
  return response.data;
}

export async function unlockMonth(year: number, month: number, reason: string): Promise<MonthLockListItem> {
  const response = await axiosClient.post<MonthLockListItem>(`/admin/months/${year}/${month}/unlock`, { reason });
  return response.data;
}
