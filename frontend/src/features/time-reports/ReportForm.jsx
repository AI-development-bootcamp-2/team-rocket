import { useEffect, useRef, useState } from 'react';
import { createTimeEntry, updateTimeEntry } from '../../api/timeEntries.api';
import { useAuth } from '../../contexts/AuthContext';
import styles from './ReportForm.module.css';

const LOCATION_OPTIONS = [
  { value: 'office', label: 'משרד' },
  { value: 'home', label: 'בית' },
  { value: 'client', label: 'לקוח' },
];

/** Parse "HH:MM" → total minutes from midnight */
function timeToMinutes(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

/** Total minutes → "H:MM" display */
function minutesToDisplay(minutes) {
  if (minutes == null || minutes < 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** Calculate duration handling cross-midnight */
function calcDuration(startTime, endTime) {
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  if (startMin == null || endMin == null) return null;
  if (endMin > startMin) return endMin - startMin;
  if (endMin < startMin) return 24 * 60 - startMin + endMin; // cross-midnight
  return null;
}

const EMPTY_FORM = {
  start_time: '',
  end_time: '',
  client_id: '',
  project_id: '',
  task_id: '',
  location: 'office',
  description: '',
};

/** Return the ID (as string) with the highest usage count in a sort_prefs freq map, or null */
function getMostUsedId(freqMap) {
  if (!freqMap || typeof freqMap !== 'object' || Array.isArray(freqMap)) return null;
  let bestId = null;
  let bestCount = 0;
  for (const [id, count] of Object.entries(freqMap)) {
    if (Number(count) > bestCount) {
      bestCount = Number(count);
      bestId = id;
    }
  }
  return bestId;
}

function buildInitialForm(entry, dropdownData) {
  if (entry) {
    return {
      start_time: entry.start_time ? String(entry.start_time).slice(0, 5) : '',
      end_time: entry.end_time ? String(entry.end_time).slice(0, 5) : '',
      client_id: String(entry.client_id ?? ''),
      project_id: String(entry.project_id ?? ''),
      task_id: String(entry.task_id ?? ''),
      location: entry.location ?? 'office',
      description: entry.description ?? '',
    };
  }
  // New entry: pre-select most-used values from sort_prefs
  const prefs = dropdownData?.sort_prefs ?? null;
  return {
    ...EMPTY_FORM,
    client_id: getMostUsedId(prefs?.client_id) ?? '',
    project_id: getMostUsedId(prefs?.project_id) ?? '',
    task_id: getMostUsedId(prefs?.task_id) ?? '',
  };
}

function FieldError({ error }) {
  if (!error) return null;
  return <span className={styles.fieldError} role="alert">{error}</span>;
}

export function ReportForm({ dropdownData, entry, date, standardHours, onSave, onCancel, onEntryCreated, onDirtyChange, isOnline = true }) {
  const isEdit = Boolean(entry);
  const { user } = useAuth();

  const [form, setForm] = useState(() => buildInitialForm(entry, dropdownData));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [conflictError, setConflictError] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [reportTab, setReportTab] = useState('work'); // 'work' or 'absence'
  const successTimerRef = useRef(null);

  // Snapshot of initial form — used to compute isDirty
  const initialFormRef = useRef(buildInitialForm(entry, dropdownData));
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialFormRef.current);

  // Notify parent when dirty state changes
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Block browser-level navigation (back/refresh) when dirty
  useEffect(() => {
    if (!isDirty) return;
    function handleBeforeUnload(e) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  /** Close with dirty-guard */
  function handleClose() {
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      onCancel();
    }
  }

  // Auto-dismiss success toast after 4 s
  useEffect(() => {
    if (!successMsg) return;
    clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setSuccessMsg(null), 4000);
    return () => clearTimeout(successTimerRef.current);
  }, [successMsg]);

  // Sort mode: 'freq' (by usage frequency, default) or 'alpha' (alphabetical)
  const storageKey = `sort_mode_${user?.id ?? 'guest'}`;
  const [sortMode, setSortMode] = useState(() => {
    try { return localStorage.getItem(storageKey) ?? 'freq'; } catch { return 'freq'; }
  });

  function toggleSort() {
    const next = sortMode === 'freq' ? 'alpha' : 'freq';
    setSortMode(next);
    try { localStorage.setItem(storageKey, next); } catch { /* ignore */ }
  }

  const firstInputRef = useRef(null);

  // Auto-focus first field on mount
  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  // Comprehensive auto-select: runs once when dropdownData loads.
  // Handles all three levels (client → project → task) in a single pass
  // so that sort_prefs pre-selections cascade correctly.
  useEffect(() => {
    if (!dropdownData?.clients) return;
    setForm((current) => {
      const allClients = dropdownData.clients;
      let { client_id, project_id, task_id } = current;

      // Level 1: auto-select client if only one and none selected
      if (!client_id && allClients.length === 1) {
        client_id = String(allClients[0].id);
      }

      // Level 2: auto-select project if selected client has exactly one project
      const clientObj = allClients.find((c) => String(c.id) === client_id);
      if (clientObj && !project_id && clientObj.projects.length === 1) {
        project_id = String(clientObj.projects[0].id);
      }

      // Level 3: auto-select task if selected project has exactly one task
      const projectObj = clientObj?.projects.find((p) => String(p.id) === project_id);
      if (projectObj && !task_id && projectObj.tasks.length === 1) {
        task_id = String(projectObj.tasks[0].id);
      }

      // Skip re-render if nothing changed
      if (client_id === current.client_id &&
          project_id === current.project_id &&
          task_id === current.task_id) {
        return current;
      }
      return { ...current, client_id, project_id, task_id };
    });
  }, [dropdownData]);

  // --- Sort dropdown data according to current sortMode ---
  const rawClients = dropdownData?.clients ?? [];
  const clients = sortMode === 'alpha'
    ? [...rawClients]
        .sort((a, b) => a.name.localeCompare(b.name, 'he'))
        .map((c) => ({
          ...c,
          projects: [...c.projects]
            .sort((a, b) => a.name.localeCompare(b.name, 'he'))
            .map((p) => ({
              ...p,
              tasks: [...p.tasks].sort((a, b) => a.name.localeCompare(b.name, 'he')),
            })),
        }))
    : rawClients;

  const selectedClient = clients.find((c) => String(c.id) === form.client_id) ?? null;
  const projects = selectedClient?.projects ?? [];

  const selectedProject = projects.find((p) => String(p.id) === form.project_id) ?? null;
  const tasks = selectedProject?.tasks ?? [];

  const noAssignments = clients.length === 0 && dropdownData != null;

  // --- Duration auto-calc ---
  const durationMinutes = calcDuration(form.start_time, form.end_time);

  // --- Field change handlers ---
  function handleChange(field, value) {
    setErrors((e) => ({ ...e, [field]: undefined }));
    setServerError(null);

    setForm((f) => {
      const next = { ...f, [field]: value };

      // Cascade: clear downstream when parent changes
      if (field === 'client_id') {
        next.project_id = '';
        next.task_id = '';

        // Auto-select if only one project
        const client = clients.find((c) => String(c.id) === value);
        if (client?.projects.length === 1) {
          next.project_id = String(client.projects[0].id);
          if (client.projects[0].tasks.length === 1) {
            next.task_id = String(client.projects[0].tasks[0].id);
          }
        }
      }

      if (field === 'project_id') {
        next.task_id = '';

        // Auto-select if only one task
        const project = selectedClient?.projects.find((p) => String(p.id) === value);
        if (project?.tasks.length === 1) {
          next.task_id = String(project.tasks[0].id);
        }
      }

      return next;
    });
  }

  // --- Validation ---
  function validate() {
    const errs = {};
    if (!form.start_time) errs.start_time = 'שדה חובה';
    if (!form.end_time) errs.end_time = 'שדה חובה';
    if (!form.client_id) errs.client_id = 'שדה חובה';
    if (!form.project_id) errs.project_id = 'שדה חובה';
    if (!form.task_id) errs.task_id = 'שדה חובה';
    if (!form.location) errs.location = 'שדה חובה';

    if (form.start_time && form.end_time) {
      const dur = calcDuration(form.start_time, form.end_time);
      if (dur == null || dur === 0) {
        errs.end_time = 'שעת סיום חייבת להיות אחרי שעת התחלה';
      }
    }

    return errs;
  }

  // --- Submit ---
  async function handleSubmit(e) {
    e.preventDefault();
    setServerError(null);
    setConflictError(false);

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        date,
        start_time: form.start_time,
        end_time: form.end_time,
        client_id: Number(form.client_id),
        project_id: Number(form.project_id),
        task_id: Number(form.task_id),
        location: form.location,
        description: form.description || null,
      };

      let saved;
      if (isEdit) {
        saved = await updateTimeEntry(entry.id, { ...payload, version: entry.version });
        onSave(saved);
      } else {
        saved = await createTimeEntry(payload);
        // Stay open: show toast, reset form for next entry
        setSuccessMsg('הדיווח נשמר בהצלחה!');
        const nextInitial = buildInitialForm(null, dropdownData);
        initialFormRef.current = nextInitial;
        setForm(nextInitial);
        setErrors({});
        onEntryCreated?.();
      }
    } catch (err) {
      const status = err?.response?.status;
      if (status === 409) {
        setConflictError(true);
      } else if (status === 422) {
        const msg = err?.response?.data?.message || err?.response?.data?.error || 'שגיאת אימות. בדוק את הפרטים ונסה שוב.';
        setServerError(msg);
      } else if (status === 423) {
        setIsLocked(true);
        setServerError(null);
      } else {
        setServerError('שגיאת שרת. נסה שוב.');
      }
    } finally {
      setSaving(false);
    }
  }

  const submitLabel = saving
    ? 'שומר…'
    : isEdit
    ? 'עדכן דיווח'
    : 'שמור דיווח';

  const allFieldsDisabled = isLocked || (!isEdit && noAssignments);

  return (
    <div
      className={styles.drawerBackdrop}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'עריכת דיווח' : 'הוספת דיווח'}
        dir="rtl"
        lang="he"
      >
        {/* ── Drawer header ── */}
        <header className={styles.drawerHeader}>
          <div className={styles.drawerHeaderRight}>
            <span className={styles.headerDateIcon} aria-hidden="true">📅</span>
            <div className={styles.headerDateSection}>
              <span className={styles.headerDate}>{date}</span>
              {isEdit && (
                <span className={`${styles.statusBadge} ${entry.status === 'rejected' ? styles.statusRejected : styles.statusDraft}`}>
                  {entry.status === 'rejected' ? 'נדחה' : 'טיוטה'}
                </span>
              )}
            </div>
          </div>
          {isEdit && (
            <button
              className={styles.deleteBtn}
              onClick={() => {
                // TODO: implement delete with confirmation
              }}
              aria-label="מחיקה"
              type="button"
              title="מחיקת דיווח"
            >
              🗑️
            </button>
          )}
          <button
            className={styles.closeBtn}
            onClick={handleClose}
            aria-label="סגירה"
            type="button"
          >
            ×
          </button>
        </header>

        {/* Conflict error */}
        {conflictError && (
          <div className={styles.conflictBanner} role="alertdialog" aria-label="ניגוד גרסאות">
            <strong>הדיווח עודכן על ידי מישהו אחר.</strong>
            <br />
            רענן את הדף כדי לראות את הגרסה העדכנית.
            <button
              className={styles.conflictReloadBtn}
              onClick={() => window.location.reload()}
              type="button"
            >
              רענן
            </button>
          </div>
        )}

        {/* Server error */}
        {serverError && (
          <div className={styles.serverError} role="alert">{serverError}</div>
        )}

        {/* Locked month banner */}
        {isLocked && (
          <div className={styles.lockedBanner} role="alert">
            🔒 החודש נעול — קריאה בלבד
          </div>
        )}

        {/* Offline banner */}
        {!isOnline && (
          <div className={styles.offlineBanner} role="status">
            📵 אין חיבור לאינטרנט — לא ניתן לשמור
          </div>
        )}

        {/* No assignments banner */}
        {noAssignments && (
          <div className={styles.noAssignmentsBanner} role="status">
            לא שוייכת עדיין למשימות. פנה למנהל המערכת לקבלת גישה.
          </div>
        )}

        {/* Success toast */}
        {successMsg && (
          <div className={styles.successToast} role="status" aria-live="polite">
            <span className={styles.successIcon} aria-hidden="true">✓</span>
            {successMsg}
          </div>
        )}

        {/* ── Tab bar ── */}
        <div className={styles.tabBar}>
          <button
            type="button"
            className={`${styles.tab} ${reportTab === 'work' ? styles.tabActive : ''}`}
            onClick={() => setReportTab('work')}
          >
            דיווח ידני
          </button>
          <button
            type="button"
            className={`${styles.tab} ${reportTab === 'absence' ? styles.tabActive : ''}`}
            onClick={() => setReportTab('absence')}
          >
            דיווח העדרות
          </button>
        </div>

        {/* ── Form ── */}
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {/* Show work tab content or absence content based on reportTab */}
          {reportTab === 'work' && (
            <>
              {/* ── Work hours section ── */}
              <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>שעות עבודה</span>
              <span className={styles.standardBadge}>תקן יומי {standardHours ?? 9} שע'</span>
            </div>

            <div className={styles.timeGrid}>
              {/* Start time */}
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="rf-start-time">
                  שעת כניסה
                </label>
                <input
                  ref={firstInputRef}
                  id="rf-start-time"
                  type="time"
                  value={form.start_time}
                  onChange={(e) => handleChange('start_time', e.target.value)}
                  className={`${styles.timeInput} ${errors.start_time ? styles.inputError : ''}`}
                  aria-describedby={errors.start_time ? 'rf-start-time-err' : undefined}
                  disabled={allFieldsDisabled}
                />
                <FieldError error={errors.start_time} />
              </div>

              {/* End time */}
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="rf-end-time">
                  שעת יציאה
                </label>
                <input
                  id="rf-end-time"
                  type="time"
                  value={form.end_time}
                  onChange={(e) => handleChange('end_time', e.target.value)}
                  className={`${styles.timeInput} ${errors.end_time ? styles.inputError : ''}`}
                  aria-describedby={errors.end_time ? 'rf-end-time-err' : undefined}
                  disabled={allFieldsDisabled}
                />
                <FieldError error={errors.end_time} />
              </div>

              {/* Duration (read-only calculated) */}
              <div className={styles.field}>
                <label className={styles.fieldLabel}>סה"כ שעות</label>
                <div
                  className={styles.durationDisplay}
                  aria-live="polite"
                  aria-label={durationMinutes != null ? `משך: ${minutesToDisplay(durationMinutes)} שעות` : 'משך לא מחושב'}
                >
                  {durationMinutes != null ? minutesToDisplay(durationMinutes) : '—'}
                </div>
              </div>
            </div>
          </section>

          {/* ── Project section ── */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>פרויקט</span>
              <button
                type="button"
                className={styles.sortToggle}
                onClick={toggleSort}
                aria-label={sortMode === 'freq' ? 'עבור לסידור אלפביתי' : 'עבור לסידור לפי שימוש'}
                title={sortMode === 'freq' ? 'ממוין לפי שימוש — לחץ לסידור אלפביתי' : 'ממוין אלפביתי — לחץ לסידור לפי שימוש'}
              >
                <span className={`${styles.sortOption} ${sortMode === 'freq' ? styles.sortActive : ''}`}>לפי שימוש</span>
                <span className={styles.sortDivider}>|</span>
                <span className={`${styles.sortOption} ${sortMode === 'alpha' ? styles.sortActive : ''}`}>א–ת</span>
              </button>
            </div>

            <div className={styles.dropdownGrid}>
              {/* Client */}
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="rf-client">לקוח</label>
                <select
                  id="rf-client"
                  value={form.client_id}
                  onChange={(e) => handleChange('client_id', e.target.value)}
                  className={`${styles.select} ${errors.client_id ? styles.inputError : ''}`}
                  disabled={allFieldsDisabled || noAssignments}
                  aria-describedby={errors.client_id ? 'rf-client-err' : undefined}
                >
                  <option value="">בחר לקוח</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <FieldError error={errors.client_id} />
              </div>

              {/* Project */}
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="rf-project">פרויקט</label>
                <select
                  id="rf-project"
                  value={form.project_id}
                  onChange={(e) => handleChange('project_id', e.target.value)}
                  className={`${styles.select} ${errors.project_id ? styles.inputError : ''}`}
                  disabled={allFieldsDisabled || !form.client_id || noAssignments}
                  aria-describedby={errors.project_id ? 'rf-project-err' : undefined}
                >
                  <option value="">בחר פרויקט</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <FieldError error={errors.project_id} />
              </div>

              {/* Task */}
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="rf-task">משימה</label>
                <select
                  id="rf-task"
                  value={form.task_id}
                  onChange={(e) => handleChange('task_id', e.target.value)}
                  className={`${styles.select} ${errors.task_id ? styles.inputError : ''}`}
                  disabled={allFieldsDisabled || !form.project_id || noAssignments}
                  aria-describedby={errors.task_id ? 'rf-task-err' : undefined}
                >
                  <option value="">בחר משימה</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <FieldError error={errors.task_id} />
              </div>

              {/* Location */}
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="rf-location">מיקום</label>
                <select
                  id="rf-location"
                  value={form.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                  className={`${styles.select} ${errors.location ? styles.inputError : ''}`}
                  disabled={allFieldsDisabled}
                >
                  {LOCATION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <FieldError error={errors.location} />
              </div>
            </div>

            {/* Description */}
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="rf-description">
                הערות
                <span className={styles.optionalMark}>(אופציונלי)</span>
              </label>
              <textarea
                id="rf-description"
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
                className={styles.textarea}
                placeholder="הוסף הערה לדיווח…"
                rows={3}
                disabled={allFieldsDisabled}
              />
            </div>
              </section>
            </>
          )}
          {reportTab === 'absence' && (
            <>
              {/* ── Absence tab ── */}
              <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>סוג ההעדרות</span>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="rf-absence-type">
                  סוג ההעדרות
                </label>
                <select
                  id="rf-absence-type"
                  className={`${styles.select} ${errors.absence_type ? styles.inputError : ''}`}
                  disabled={allFieldsDisabled}
                >
                  <option value="">בחר סוג</option>
                  <option value="vacation">חופשה - יום מלא 🏖️</option>
                  <option value="half_vacation">חופשה - חצי יום 🏖️</option>
                  <option value="sick">מחלה 😷</option>
                  <option value="military">מילואים 🪖</option>
                </select>
                <FieldError error={errors.absence_type} />
              </div>
              <p className={styles.absenceNote}>
                הערה: דיווחי העדרות לפי טווח תאריכים יעודכנו בקרוב.
              </p>
              </section>
            </>
          )}

          {/* ── Footer with summary and progress ── */}
          <footer className={styles.footer}>
            <div className={styles.footerSummary}>
              <div className={styles.footerLeft}>
                <span className={styles.footerLabel}>
                  {durationMinutes != null ? `${minutesToDisplay(durationMinutes)} מתוך ${standardHours} שעות` : '—'}
                </span>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{
                      width: durationMinutes
                        ? `${Math.min((durationMinutes / (standardHours * 60)) * 100, 100)}%`
                        : '0%',
                      background: durationMinutes
                        ? durationMinutes >= (standardHours * 60)
                          ? 'var(--color-success, #16a34a)'
                          : 'var(--color-brand-orange, #f59e0b)'
                        : 'var(--color-brand-orange, #f59e0b)',
                    }}
                  />
                </div>
                {durationMinutes && durationMinutes < (standardHours * 60) && (
                  <span className={styles.footerRemaining}>
                    חסרות {((standardHours * 60 - durationMinutes) / 60).toFixed(1)} שעות
                  </span>
                )}
              </div>
            </div>
            <button
              type="submit"
              className={styles.saveBtn}
              disabled={saving || allFieldsDisabled || !isOnline}
            >
              {submitLabel}
            </button>
          </footer>
        </form>
      </aside>

      {/* ── Unsaved changes guard dialog ── */}
      {showUnsavedDialog && (
        <div className={styles.unsavedBackdrop} role="presentation">
          <div
            className={styles.unsavedDialog}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="unsaved-dialog-title"
            dir="rtl"
            lang="he"
          >
            <h3 id="unsaved-dialog-title" className={styles.unsavedTitle}>
              יש שינויים שלא נשמרו
            </h3>
            <p className={styles.unsavedBody}>
              יש לך שינויים שלא נשמרו. לצאת בכל זאת?
            </p>
            <div className={styles.unsavedActions}>
              <button
                type="button"
                className={styles.unsavedStay}
                onClick={() => setShowUnsavedDialog(false)}
                autoFocus
              >
                המשך עריכה
              </button>
              <button
                type="button"
                className={styles.unsavedLeave}
                onClick={onCancel}
              >
                יציאה ללא שמירה
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
