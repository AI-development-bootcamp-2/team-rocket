import { Modal } from '../../../components/ui/Modal.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { UserForm } from './UserForm.jsx';
import { getInitialUserFormState } from './userFormState.js';

export function UserFormDialog({
  mode,
  user,
  permissionFlag,
  onClose,
  onSubmit,
  saving,
}) {
  const formKey = JSON.stringify(getInitialUserFormState(user, permissionFlag));

  return (
    <Modal
      title={mode === 'create' ? 'יצירת משתמש' : 'עריכת משתמש'}
      icon="U"
      size="form"
      onClose={onClose}
      footer={
        <Button type="submit" form="user-form" disabled={saving}>
          {saving ? 'שומר...' : 'שמירה'}
        </Button>
      }
    >
      <UserForm
        key={formKey}
        mode={mode}
        user={user}
        permissionFlag={permissionFlag}
        onSubmit={onSubmit}
      />
    </Modal>
  );
}
