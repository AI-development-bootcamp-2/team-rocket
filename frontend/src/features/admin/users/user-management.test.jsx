/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { UserStatusBadge } from './UserStatusBadge.jsx';
import { UserRowActions } from './UserRowActions.jsx';
import { UserFilters } from './UserFilters.jsx';
import { UserForm } from './UserForm.jsx';
import { DeactivateUserDialog } from './DeactivateUserDialog.jsx';
import { ResetPasswordDialog } from './ResetPasswordDialog.jsx';
import { UserListPage } from './UserListPage.jsx';

jest.mock('../../../api/users.api.js', () => ({
  createPermissionFlag: jest.fn(),
  createUser: jest.fn(),
  deactivateUser: jest.fn(),
  deletePermissionFlag: jest.fn(),
  listPermissionFlags: jest.fn(),
  listProjects: jest.fn(),
  listUsers: jest.fn(),
  resetUserPassword: jest.fn(),
  updateUser: jest.fn(),
}));
jest.mock(
  'react-router-dom',
  () => ({
    NavLink: ({ children, className }) => (
      <a className={typeof className === 'function' ? className({ isActive: true }) : className} href="/admin/users">
        {children}
      </a>
    ),
  }),
  { virtual: true },
);
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, role: 'admin' },
    logout: jest.fn(),
  }),
}));

const mockApi = require('../../../api/users.api.js');

function setInputValue(input, value) {
  fireEvent.change(input, { target: { value } });
}

describe('user management UI', () => {
  const baseUser = {
    id: 2,
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@test.com',
    role: 'user',
    isActive: true,
    employeeNumber: 'EMP-1',
    employmentType: 'full_time',
    employmentPercentage: 100,
    department: 'Engineering',
    dailyHoursOverride: 8,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.listUsers.mockResolvedValue({ data: [baseUser] });
    mockApi.listProjects.mockResolvedValue({ data: [{ id: 11, name: 'Apollo' }] });
    mockApi.listPermissionFlags.mockResolvedValue({ data: [] });
    mockApi.createUser.mockResolvedValue({ id: 9 });
    mockApi.updateUser.mockResolvedValue({});
    mockApi.deactivateUser.mockResolvedValue(null);
    mockApi.resetUserPassword.mockResolvedValue({});
    mockApi.createPermissionFlag.mockResolvedValue({});
    mockApi.deletePermissionFlag.mockResolvedValue(null);
  });

  it('renders status badges, row actions, filters, and validation in UserForm', async () => {
    const onEdit = jest.fn();
    const onToggleActive = jest.fn();
    const onResetPassword = jest.fn();
    const onSearchChange = jest.fn();
    const onRoleChange = jest.fn();
    const onStatusChange = jest.fn();
    const onSubmit = jest.fn();

    const { container } = render(
      <div>
        <UserStatusBadge isActive />
        <UserStatusBadge isActive={false} />
        <UserRowActions
          user={baseUser}
          currentUserId={1}
          onEdit={onEdit}
          onToggleActive={onToggleActive}
          onResetPassword={onResetPassword}
        />
        <UserFilters
          search=""
          role="all"
          status="all"
          onSearchChange={onSearchChange}
          onRoleChange={onRoleChange}
          onStatusChange={onStatusChange}
        />
        <UserForm
          mode="create"
          user={null}
          permissionFlag={null}
          onSubmit={onSubmit}
        />
      </div>,
    );

    expect(container.querySelectorAll('.user-status-badge')).toHaveLength(2);

    const actionButtons = screen.getAllByRole('button');
    fireEvent.click(actionButtons[0]);
    fireEvent.click(actionButtons[1]);
    fireEvent.click(actionButtons[2]);
    expect(onEdit).toHaveBeenCalledWith(baseUser);
    expect(onResetPassword).toHaveBeenCalledWith(baseUser);
    expect(onToggleActive).toHaveBeenCalledWith(baseUser);

    setInputValue(screen.getAllByRole('textbox')[0], 'ada');
    const selectBoxes = screen.getAllByRole('combobox');
    fireEvent.change(selectBoxes[0], { target: { value: 'admin' } });
    fireEvent.change(selectBoxes[1], { target: { value: 'inactive' } });
    expect(onSearchChange).toHaveBeenCalledWith('ada');
    expect(onRoleChange).toHaveBeenCalledWith('admin');
    expect(onStatusChange).toHaveBeenCalledWith('inactive');

    const userForm = document.getElementById('user-form');
    fireEvent.submit(userForm);
    expect(container.querySelectorAll('.ui-field__error').length).toBeGreaterThan(0);

    const formInputs = userForm.querySelectorAll('input');
    setInputValue(formInputs[0], 'Grace');
    setInputValue(formInputs[1], 'Hopper');
    setInputValue(formInputs[2], 'grace@test.com');
    setInputValue(formInputs[3], 'StrongPass1!');
    fireEvent.submit(userForm);

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: 'Grace',
          last_name: 'Hopper',
          email: 'grace@test.com',
        }),
      ),
    );
  });

  it('renders deactivate and reset-password dialogs', () => {
    const onClose = jest.fn();
    const onConfirm = jest.fn();

    render(
      <div>
        <DeactivateUserDialog user={baseUser} onClose={onClose} onConfirm={onConfirm} loading={false} />
        <ResetPasswordDialog user={baseUser} onClose={onClose} onConfirm={onConfirm} loading={false} />
      </div>,
    );

    const dialogs = screen.getAllByRole('dialog');

    // X button closes the deactivate dialog
    fireEvent.click(within(dialogs[0]).getByRole('button', { name: 'סגירה' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    // Confirm button triggers onConfirm on the deactivate dialog
    fireEvent.click(within(dialogs[0]).getByRole('button', { name: 'השבתה' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    // Reset password: fill form and submit → onConfirm called with password
    const resetPasswordForm = document.getElementById('reset-password-form');
    setInputValue(resetPasswordForm.querySelector('input'), 'TempPass1!');
    fireEvent.click(document.querySelector('button[form="reset-password-form"]'));
    expect(onConfirm).toHaveBeenCalledWith('TempPass1!');
  });

  it('loads users, filters them, creates a user, updates a user, deactivates, and resets password', async () => {
    render(<UserListPage />);

    expect((await screen.findAllByText('ada@test.com')).length).toBeGreaterThan(0);
    expect(mockApi.listUsers).toHaveBeenCalledWith({ search: '', role: 'all', isActive: 'all' });

    setInputValue(screen.getByRole('textbox'), 'ada');
    await waitFor(() =>
      expect(mockApi.listUsers).toHaveBeenLastCalledWith({
        search: 'ada',
        role: 'all',
        isActive: 'all',
      }),
    );

    fireEvent.click(screen.getAllByRole('button', { name: /יצירת משתמש/i })[0]);

    let userForm = document.getElementById('user-form');
    let formInputs = userForm.querySelectorAll('input');
    setInputValue(formInputs[0], 'New');
    setInputValue(formInputs[1], 'User');
    setInputValue(formInputs[2], 'new@test.com');
    setInputValue(formInputs[3], 'SecurePass1!');
    await waitFor(() => expect(document.querySelector('button[form="user-form"]')).not.toBeDisabled());
    fireEvent.click(document.querySelector('button[form="user-form"]'));
    await waitFor(() => expect(mockApi.createUser).toHaveBeenCalled());

    fireEvent.click(screen.getAllByRole('button', { name: /עריכת Ada Lovelace/i })[0]);
    userForm = document.getElementById('user-form');
    formInputs = userForm.querySelectorAll('input');
    setInputValue(formInputs[0], 'Updated');
    await waitFor(() => expect(document.querySelector('button[form="user-form"]')).not.toBeDisabled());
    fireEvent.click(document.querySelector('button[form="user-form"]'));
    await waitFor(() => expect(mockApi.updateUser).toHaveBeenCalled());

    fireEvent.click(screen.getAllByRole('button', { name: /השבתה Ada Lovelace/i })[0]);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'השבתה' }));
    await waitFor(() => expect(mockApi.deactivateUser).toHaveBeenCalledWith(2));

    fireEvent.click(screen.getAllByRole('button', { name: /איפוס סיסמה עבור Ada Lovelace/i })[0]);
    const resetPasswordForm = document.getElementById('reset-password-form');
    setInputValue(resetPasswordForm.querySelector('input'), 'ResetPass1!');
    fireEvent.click(document.querySelector('button[form="reset-password-form"]'));
    await waitFor(() =>
      expect(mockApi.resetUserPassword).toHaveBeenCalledWith(2, {
        temporary_password: 'ResetPass1!',
      }),
    );
  }, 15000);

  it('renders empty and permission-error states', async () => {
    mockApi.listUsers.mockReset();
    mockApi.listUsers.mockResolvedValue({ data: [] });

    const { unmount } = render(<UserListPage />);
    expect(await screen.findByText(/לא נמצאו משתמשים/i)).toBeInTheDocument();

    unmount();
    mockApi.listUsers.mockReset();
    mockApi.listUsers.mockRejectedValue({ response: { status: 403 } });
    render(<UserListPage />);
    expect(await screen.findByText(/אין לך הרשאה/i)).toBeInTheDocument();
  });
});
