export type Role = 'admin' | 'user';

export type TimeEntryLocation = 'office' | 'home' | 'client';
export type TimeEntryStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface TimeEntry {
  id: number;
  user_id: number;
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  client_id: number;
  project_id: number;
  task_id: number;
  location: TimeEntryLocation;
  description: string | null;
  status: TimeEntryStatus;
  version: number;
  last_modified_by: number | null;
  last_modified_by_role: Role | null;
  rejection_reason: string | null;
  approved_by: number | null;
  approved_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailySummary {
  date: string;
  total_hours: number;
  standard_hours: number;
  remaining_hours: number;
  entry_count: number;
  status: 'full' | 'partial' | 'missing' | 'day_off';
}

export interface DropdownTask {
  id: number;
  name: string;
}

export interface DropdownProject {
  id: number;
  name: string;
  tasks: DropdownTask[];
}

export interface DropdownClient {
  id: number;
  name: string;
  projects: DropdownProject[];
}

export interface DropdownData {
  clients: DropdownClient[];
  sort_prefs: Record<string, unknown> | null;
}

export interface CreateTimeEntryPayload {
  date: string;
  start_time: string;
  end_time: string;
  client_id: number;
  project_id: number;
  task_id: number;
  location: TimeEntryLocation;
  description?: string | null;
  duration_override_minutes?: number;
}

export interface UpdateTimeEntryPayload {
  version: number;
  start_time?: string;
  end_time?: string;
  client_id?: number;
  project_id?: number;
  task_id?: number;
  location?: TimeEntryLocation;
  description?: string | null;
  duration_override_minutes?: number;
}

export interface TimeEntryMutationResponse extends TimeEntry {
  warning?: boolean;
}

export type AbsenceType = 'sick' | 'vacation_full' | 'vacation_half' | 'reserve';
export type AbsenceStatus = 'draft' | 'submitted';

export interface AbsenceDocument {
  id: number;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface AbsenceRecord {
  id: number;
  user_id: number;
  type: AbsenceType;
  start_date: string;
  end_date: string;
  is_partial: boolean;
  notes: string | null;
  status: AbsenceStatus;
  version: number;
  days_count: number;
  hours_impact: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  documents?: AbsenceDocument[];
}

export interface CreateAbsencePayload {
  type: AbsenceType;
  start_date: string;
  end_date: string;
  is_partial?: boolean;
  notes?: string | null;
}

export interface UpdateAbsencePayload {
  version: number;
  type?: AbsenceType;
  start_date?: string;
  end_date?: string;
  is_partial?: boolean;
  notes?: string | null;
}

export interface AbsenceMutationEnvelope {
  data: AbsenceRecord;
  warning: string;
}

export type AbsenceMutationResponse = AbsenceRecord | AbsenceMutationEnvelope;

export type DashboardCellStatus =
  | 'not_started'
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'missing';

export interface DashboardCell {
  week_start_date: string;
  status: DashboardCellStatus;
}

export interface DashboardWeekColumn {
  week_start_date: string;
  week_end_date: string;
  in_requested_month: boolean;
}

export interface DashboardUserRow {
  user_id: number;
  first_name: string;
  last_name: string;
  cells: DashboardCell[];
}

export interface AdminDashboardSummary {
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
  summary: AdminDashboardSummary;
}

export interface MonthlySummaryProjectBreakdown {
  projectId: number;
  projectName: string;
  hours: number;
}

export interface MonthlySummary {
  year: number;
  month: number;
  reportedHours: number;
  quotaHours: number;
  completionPercentage: number;
  missingHoursToDate: number;
  absenceHours: number;
  daysWithoutReport: number;
  projectBreakdown: MonthlySummaryProjectBreakdown[];
}

export interface MonthLockStatus {
  year: number;
  month: number;
  is_locked: boolean;
  locked_by?: number | null;
  locked_at?: string | null;
  reason?: string | null;
  unapproved_week_count?: number;
}

export interface MonthLockListItem extends MonthLockStatus {
  id: number;
  unlocked_by?: number | null;
  unlocked_at?: string | null;
  unlock_reason?: string | null;
  locked_by_name?: string | null;
}

export interface UserListItem {
  id: number;
  firstName: string;
  lastName: string;
  email?: string;
  role?: Role;
  isActive?: boolean;
  mustChangePassword?: boolean;
  employeeNumber?: string | null;
  employmentType?: 'full_time' | 'part_time' | 'contractor' | null;
  employmentPercentage?: number | string;
  department?: string | null;
  dailyHoursOverride?: number | string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserListResponse {
  data: UserListItem[];
}

export interface PermissionFlag {
  id: number;
  userId?: number;
  flagName?: string;
  scopedProjectIds?: number[];
  grantedBy?: number | null;
  createdAt?: string;
  [key: string]: unknown;
}

export interface CreateUserPayload {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  role: Role;
  is_active?: boolean;
  employee_number?: string;
  employment_type?: 'full_time' | 'part_time' | 'contractor' | '';
  employment_percentage?: number | '';
  department?: string;
  daily_hours_override?: number | '';
}

export interface UpdateUserPayload {
  first_name: string;
  last_name: string;
  email: string;
  role: Role;
  is_active?: boolean;
  employee_number?: string;
  employment_type?: 'full_time' | 'part_time' | 'contractor' | '';
  employment_percentage?: number | '';
  department?: string;
  daily_hours_override?: number | '';
}

export interface ResetPasswordPayload {
  temporary_password: string;
}

export interface CreatePermissionFlagPayload {
  flag_name: string;
  scoped_project_ids?: string[] | number[];
}

export interface AssignmentRecord {
  id: number;
  userId: number;
  taskId: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  user: {
    firstName: string;
    lastName: string;
    email?: string | null;
  };
  task: {
    name: string;
    status?: string;
  };
  projectId: number;
  projectName: string;
  clientId: number;
  clientName: string;
  [key: string]: unknown;
}

export interface AssignmentListResponse {
  data: AssignmentRecord[];
}

export interface AssignmentMutationResponse {
  data: AssignmentRecord;
}

export interface PermissionFlagListResponse {
  data: PermissionFlag[];
}

export interface ClientRecord {
  id: number;
  clientNumber?: string | null;
  name: string;
  contact_info?: string | null;
  contactInfo?: string | null;
  is_active: boolean;
  isActive?: boolean;
  activeProjectsCount?: number | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ClientListResponse {
  data: ClientRecord[];
}

export interface ClientMutationWarningResponse {
  data: ClientRecord;
  warning: string;
}

export type ClientMutationResponse = ClientRecord | ClientMutationWarningResponse;

export interface ClientWritePayload {
  name: string;
  contact_info?: string | null;
  is_active?: boolean;
}

export interface ProjectRecord {
  id: number;
  name: string;
  client_id?: number;
  clientId?: number;
  is_active?: boolean;
  isActive?: boolean;
  manager_user_id?: number | null;
  managerUserId?: number | null;
  start_date?: string | null;
  startDate?: string | null;
  end_date?: string | null;
  endDate?: string | null;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
  tasks?: TaskRecord[];
  [key: string]: unknown;
}

export interface ProjectListResponse {
  data: ProjectRecord[];
}

export interface ProjectEnvelopeResponse {
  data: ProjectRecord;
}

export interface ProjectMutationWarningResponse {
  data: ProjectRecord;
  warning: string;
}

export type ProjectMutationResponse = ProjectRecord | ProjectEnvelopeResponse | ProjectMutationWarningResponse;

export interface ProjectWritePayload {
  name?: string;
  client_id?: number;
  manager_user_id?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  description?: string | null;
  is_active?: boolean;
}

export interface TaskRecord {
  id: number;
  name: string;
  project_id?: number;
  projectId?: number;
  status?: string;
  clientId?: number;
  clientName?: string;
  projectName?: string;
  start_date?: string | null;
  startDate?: string | null;
  end_date?: string | null;
  endDate?: string | null;
  description?: string | null;
  assignedUsersCount?: number;
  [key: string]: unknown;
}

export interface TimerStoppedEntry {
  id?: number;
  start_time?: string;
  end_time?: string;
  version?: number;
}

export type TimerStatus =
  | {
      running: false;
    }
  | {
      running: true;
      timeEntryId: number;
      startTime: string;
      elapsedSeconds: number;
    };

export interface TimerActionResponse {
  timeEntryId: number;
  startTime: string;
  stopTime?: string;
  durationMinutes?: number;
  version?: number;
}
