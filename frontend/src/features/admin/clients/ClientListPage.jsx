import { useState } from 'react';
import { AdminShell } from '../../../components/layout/AdminShell.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Toast } from '../../../components/ui/Toast.jsx';
import { createClient } from '../../../api/clients.api.js';
import { ClientFormDialog } from './ClientFormDialog.jsx';

function makeToast(message, tone = 'info') {
  return { id: `${Date.now()}-${Math.random()}`, message, tone };
}

export function ClientListPage() {
  const [dialog, setDialog] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  async function handleCreate(form) {
    setSaving(true);
    try {
      await createClient(form);
      setToast(makeToast('הלקוח נוצר בהצלחה.', 'success'));
      setDialog(null);
    } catch (error) {
      const status = error?.response?.status;
      const message =
        status === 404
          ? 'נקודת הקצה ליצירת לקוח עדיין לא זמינה בשרת.'
          : 'אירעה שגיאה בעת יצירת הלקוח.';
      setToast(makeToast(message, 'error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-page">
      <AdminShell
        title="ניהול לקוחות"
        subtitle="ניהול לקוחות פעילים ופרטי קשר."
        actions={
          <Button onClick={() => setDialog({ mode: 'create' })}>יצירת לקוח</Button>
        }
      >
        {toast ? (
          <Toast
            message={toast.message}
            tone={toast.tone}
            onClose={() => setToast(null)}
          />
        ) : null}

        {/* TODO: Clients table is intentionally missing for now; another teammate is implementing it. */}
      </AdminShell>

      {dialog ? (
        <ClientFormDialog
          mode={dialog.mode}
          client={dialog.client}
          saving={saving}
          onClose={() => (saving ? null : setDialog(null))}
          onSubmit={handleCreate}
        />
      ) : null}
    </div>
  );
}
