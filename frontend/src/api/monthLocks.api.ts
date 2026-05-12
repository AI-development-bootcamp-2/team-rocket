// @ts-nocheck
import axiosClient from './axiosClient';

export async function listMonths() {
  const response = await axiosClient.get('/admin/months');
  return response.data;
}

export async function getMonthStatus(year, month) {
  const response = await axiosClient.get(`/admin/months/${year}/${month}/status`);
  return response.data;
}

export async function lockMonth(year, month) {
  const response = await axiosClient.post(`/admin/months/${year}/${month}/lock`);
  return response.data;
}

export async function unlockMonth(year, month, reason) {
  const response = await axiosClient.post(`/admin/months/${year}/${month}/unlock`, { reason });
  return response.data;
}

