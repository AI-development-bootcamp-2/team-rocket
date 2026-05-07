import { useCallback, useDeferredValue, useEffect, useState } from 'react'
import { startTransition } from 'react'
import {
  createUser,
  createPermissionFlag,
  deletePermissionFlag,
  deactivateUser,
  getCurrentUser,
  listPermissionFlags,
  listProjects,
  listUsers,
  resetUserPassword,
  updateUser,
} from '../../../api/users.api.js'
import { AdminShell } from '../../../components/layout/AdminShell.jsx'
import { Button } from '../../../components/ui/Button.jsx'
import { EmptyState } from '../../../components/ui/EmptyState.jsx'
import { ErrorState } from '../../../components/ui/ErrorState.jsx'
import { Spinner } from '../../../components/ui/Spinner.jsx'
import { Toast } from '../../../components/ui/Toast.jsx'
import { DeactivateUserDialog } from './DeactivateUserDialog.jsx'
import { ResetPasswordDialog } from './ResetPasswordDialog.jsx'
import { UserCardsMobile } from './UserCardsMobile.jsx'
import { UserFilters } from './UserFilters.jsx'
import { UserFormDialog } from './UserFormDialog.jsx'
import { UsersTable } from './UsersTable.jsx'

function mapErrorMessage(error) {
  if (error.status === 401) {
    return 'כדי לצפות במסך הזה יש להתחבר ולהגדיר accessToken ב-localStorage.'
  }

  if (error.status === 403) {
    return 'אין לך הרשאה לצפות במסך ניהול המשתמשים.'
  }

  return error.payload?.message ?? error.payload?.error ?? 'אירעה שגיאה בטעינת המשתמשים.'
}

function createToast(message, tone = 'info') {
  return { id: `${Date.now()}-${Math.random()}`, message, tone }
}

export function UserListPage() {
  const [users, setUsers] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('all')
  const [status, setStatus] = useState('all')
  const [dialog, setDialog] = useState(null)
  const [dialogLoading, setDialogLoading] = useState(false)
  const [projects, setProjects] = useState([])
  const [dialogMetaLoading, setDialogMetaLoading] = useState(false)

  const deferredSearch = useDeferredValue(search)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await listUsers({
        search: deferredSearch,
        role,
        isActive: status,
      })
      setUsers(response.data ?? [])
    } catch (loadError) {
      setError(mapErrorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [deferredSearch, role, status])

  useEffect(() => {
    async function run() {
      try {
        const user = await getCurrentUser()
        setCurrentUser(user)
      } catch (loadError) {
        setError(mapErrorMessage(loadError))
      }
    }

    void run()
  }, [])

  useEffect(() => {
    startTransition(() => {
      void loadUsers()
    })
  }, [deferredSearch, role, status, loadUsers])

  useEffect(() => {
    if (!dialog || dialog.type !== 'form') return

    async function run() {
      setDialogMetaLoading(true)

      try {
        const [projectsResponse, permissionsResponse] = await Promise.all([
          listProjects({ isActive: true }),
          dialog.user?.id ? listPermissionFlags(dialog.user.id) : Promise.resolve({ data: [] }),
        ])

        setProjects(projectsResponse.data ?? [])
        const permissionFlag =
          permissionsResponse.data?.find((flag) => flag.flagName === 'canAssignProjectTasks') ?? null

        setDialog((current) => {
          if (!current || current.type !== 'form') return current
          return {
            ...current,
            permissionFlag,
          }
        })
      } catch (metaError) {
        setToast(createToast(mapErrorMessage(metaError), 'error'))
      } finally {
        setDialogMetaLoading(false)
      }
    }

    void run()
  }, [dialog])

  useEffect(() => {
    if (!toast) return undefined

    const timeoutId = window.setTimeout(() => {
      setToast(null)
    }, 4000)

    return () => window.clearTimeout(timeoutId)
  }, [toast])

  async function syncPermissionFlag(userId, form, existingPermissionFlag) {
    if (existingPermissionFlag) {
      await deletePermissionFlag(userId, existingPermissionFlag.id)
    }

    if (form.can_assign_project_tasks) {
      await createPermissionFlag(userId, {
        flag_name: 'canAssignProjectTasks',
        scoped_project_ids: form.scoped_project_ids,
      })
    }
  }

  async function handleSaveUser(form) {
    setDialogLoading(true)

    try {
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        role: form.role,
        is_active: form.is_active,
        employee_number: form.employee_number || '',
        employment_type: form.employment_type || '',
        employment_percentage: form.employment_percentage,
        department: form.department || '',
        daily_hours_override: form.daily_hours_override,
      }

      if (dialog.mode === 'create') {
        const createdUser = await createUser({ ...payload, password: form.password })
        await syncPermissionFlag(createdUser.id, form, null)
        setToast(createToast('המשתמש נוצר בהצלחה', 'success'))
      } else {
        await updateUser(dialog.user.id, payload)
        await syncPermissionFlag(dialog.user.id, form, dialog.permissionFlag ?? null)
        setToast(createToast('המשתמש עודכן בהצלחה', 'success'))
      }

      setDialog(null)
      await loadUsers()
    } catch (saveError) {
      setToast(createToast(mapErrorMessage(saveError), 'error'))
    } finally {
      setDialogLoading(false)
    }
  }

  async function handleDeactivateConfirmed() {
    setDialogLoading(true)

    try {
      if (dialog.user.isActive) {
        await deactivateUser(dialog.user.id)
        setToast(createToast('המשתמש הושבת בהצלחה', 'success'))
      } else {
        await updateUser(dialog.user.id, {
          first_name: dialog.user.firstName,
          last_name: dialog.user.lastName,
          email: dialog.user.email,
          role: dialog.user.role,
          is_active: true,
        })
        setToast(createToast('המשתמש הופעל מחדש בהצלחה', 'success'))
      }

      setDialog(null)
      await loadUsers()
    } catch (actionError) {
      setToast(createToast(mapErrorMessage(actionError), 'error'))
    } finally {
      setDialogLoading(false)
    }
  }

  async function handleResetPasswordConfirmed(temporaryPassword) {
    setDialogLoading(true)

    try {
      await resetUserPassword(dialog.user.id, {
        temporary_password: temporaryPassword,
      })
      setToast(createToast('הסיסמה הזמנית נשמרה והמשתמש יידרש להחליף אותה בכניסה הבאה', 'success'))
      setDialog(null)
    } catch (actionError) {
      setToast(createToast(mapErrorMessage(actionError), 'error'))
      setDialog(null)
    } finally {
      setDialogLoading(false)
    }
  }

  const pageActions = (
    <Button onClick={() => setDialog({ type: 'form', mode: 'create', user: null })}>יצירה</Button>
  )

  return (
    <div className="app-page">
      <AdminShell
        title="ניהול משתמשים"
        subtitle="ניהול חשבונות, הרשאות וסטטוס פעילות של עובדי המערכת"
        actions={pageActions}
      >
        <section className="users-page">
          <UserFilters
            search={search}
            role={role}
            status={status}
            onSearchChange={setSearch}
            onRoleChange={setRole}
            onStatusChange={setStatus}
          />

          {toast ? (
            <Toast
              message={toast.message}
              tone={toast.tone}
              onClose={() => setToast(null)}
            />
          ) : null}

          {loading && users.length === 0 ? (
            <div className="users-page__loading">
              <Spinner label="טוען משתמשים..." />
            </div>
          ) : null}

          {!loading && error ? (
            error.includes('הרשאה') || error.includes('accessToken') ? (
              <ErrorState title="אין גישה למסך" description={error} onAction={loadUsers} />
            ) : (
              <ErrorState title="שגיאה בטעינת משתמשים" description={error} onAction={loadUsers} />
            )
          ) : null}

          {!loading && !error && users.length === 0 ? (
            <EmptyState
              title="לא נמצאו משתמשים"
              description="נסו לעדכן את החיפוש או ליצור משתמש חדש."
              actionLabel="יצירת משתמש"
              onAction={() => setDialog({ type: 'form', mode: 'create', user: null })}
            />
          ) : null}

          {!error ? (
            <>
              <div className="users-page__desktop">
                <UsersTable
                  users={users}
                  currentUserId={currentUser?.id}
                  onEdit={(user) => setDialog({ type: 'form', mode: 'edit', user })}
                  onToggleActive={(user) => setDialog({ type: 'deactivate', user })}
                  onResetPassword={(user) =>
                    setDialog({ type: 'reset-password', user, temporaryPassword: '' })
                  }
                  loading={loading}
                />
              </div>

              <div className="users-page__mobile">
                <UserCardsMobile
                  users={users}
                  currentUserId={currentUser?.id}
                  onEdit={(user) => setDialog({ type: 'form', mode: 'edit', user })}
                  onToggleActive={(user) => setDialog({ type: 'deactivate', user })}
                  onResetPassword={(user) =>
                    setDialog({ type: 'reset-password', user, temporaryPassword: '' })
                  }
                  loading={loading}
                />
              </div>
            </>
          ) : null}
        </section>
      </AdminShell>

      {dialog?.type === 'form' ? (
        <UserFormDialog
          mode={dialog.mode}
          user={dialog.user}
          permissionFlag={dialog.permissionFlag}
          projects={projects}
          loadingMeta={dialogMetaLoading}
          saving={dialogLoading}
          onClose={() => setDialog(null)}
          onSubmit={handleSaveUser}
        />
      ) : null}

      {dialog?.type === 'deactivate' ? (
        <DeactivateUserDialog
          user={dialog.user}
          loading={dialogLoading}
          onClose={() => setDialog(null)}
          onConfirm={handleDeactivateConfirmed}
        />
      ) : null}

      {dialog?.type === 'reset-password' ? (
        <ResetPasswordDialog
          user={dialog.user}
          loading={dialogLoading}
          onClose={() => setDialog(null)}
          onConfirm={handleResetPasswordConfirmed}
        />
      ) : null}
    </div>
  )
}
