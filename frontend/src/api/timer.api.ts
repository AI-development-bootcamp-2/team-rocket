import axiosClient from './axiosClient';
import type { TimerActionResponse, TimerStatus } from './contracts';

export async function getTimerStatus(): Promise<TimerStatus> {
  const response = await axiosClient.get<TimerStatus>('/timer/status');
  return response.data;
}

export async function startTimer(): Promise<TimerActionResponse> {
  const response = await axiosClient.post<TimerActionResponse>('/timer/start');
  return response.data;
}

export async function quickStopTimer(): Promise<TimerActionResponse> {
  const response = await axiosClient.post<TimerActionResponse>('/timer/stop');
  return response.data;
}
