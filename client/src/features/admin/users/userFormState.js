export function getInitialUserFormState(user, permissionFlag) {
  return {
    first_name: user?.firstName ?? '',
    last_name: user?.lastName ?? '',
    email: user?.email ?? '',
    password: '',
    role: user?.role ?? 'user',
    is_active: user?.isActive ?? true,
    employee_number: user?.employeeNumber ?? '',
    employment_type: user?.employmentType ?? '',
    employment_percentage: user?.employmentPercentage ?? '100',
    department: user?.department ?? '',
    daily_hours_override: user?.dailyHoursOverride ?? '',
    can_assign_project_tasks: Boolean(permissionFlag),
    scoped_project_ids: permissionFlag?.scopedProjectIds?.map(String) ?? [],
  }
}
