import { Modal } from '../../../components/ui/Modal.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { UserForm } from './UserForm.jsx';
import { getInitialUserFormState } from './userFormState.js';

export function UserFormDialog({
  mode,
  user,
  permissionFlag,
  projects,
  loadingMeta,
  onClose,
  onSubmit,
  saving,
}) {
  const formKey = JSON.stringify(getInitialUserFormState(user, permissionFlag));

  return (
    <Modal
      title={mode === 'create' ? 'יצירת משתמש' : 'עריכת משתמש'}
      icon="U"
      onClose={onClose}
      footer={
        <Button type="submit" form="user-form" disabled={saving || loadingMeta}>
          {saving ? 'שומר...' : 'שמירה'}
        </Button>
      }
    >
      <UserForm
        key={formKey}
        mode={mode}
        user={user}
        permissionFlag={permissionFlag}
        projects={projects}
        loadingMeta={loadingMeta}
        onSubmit={onSubmit}
      />
    </Modal>
  );
}
