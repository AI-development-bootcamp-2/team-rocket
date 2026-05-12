import axiosClient from './axiosClient';

export async function getTimerStatus() {
  const response = await axiosClient.get('/timer/status');
  return response.data;
}

export async function startTimer() {
  const response = await axiosClient.post('/timer/start');
  return response.data;
}

export async function quickStopTimer() {
  const response = await axiosClient.post('/timer/stop');
  return response.data;
}
