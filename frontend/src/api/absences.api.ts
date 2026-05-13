import axiosClient from './axiosClient';
import type {
  AbsenceDocument,
  AbsenceMutationResponse,
  AbsenceRecord,
  AbsenceType,
  CreateAbsencePayload,
} from './contracts';

interface ListAbsencesParams {
  userId?: number;
  month?: string;
  dateFrom?: string;
  dateTo?: string;
  type?: AbsenceType;
}

export async function listAbsences({ userId, month, dateFrom, dateTo, type }: ListAbsencesParams = {}): Promise<AbsenceRecord[]> {
  const params = new URLSearchParams();

  if (userId) params.set('user_id', String(userId));
  if (month) params.set('month', month);
  if (dateFrom) params.set('date_from', dateFrom);
  if (dateTo) params.set('date_to', dateTo);
  if (type) params.set('type', type);

  const query = params.toString();
  const response = await axiosClient.get<AbsenceRecord[]>(`/absences${query ? `?${query}` : ''}`);
  return response.data;
}

export async function createAbsence(payload: CreateAbsencePayload): Promise<AbsenceMutationResponse> {
  const response = await axiosClient.post<AbsenceMutationResponse>('/absences', payload);
  return response.data;
}

export async function uploadAbsenceDocument(absenceId: number, file: File): Promise<AbsenceDocument> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axiosClient.post<AbsenceDocument>(`/absences/${absenceId}/documents`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}
