import { useEffect, useMemo, useRef, useState } from 'react';
import { createTimeEntry, updateTimeEntry } from '../../api/timeEntries.api';
import styles from './ReportForm.module.css';

const LOCATION_OPTIONS = [
  { value: 'office', label: 'משרד' },
  { value: 'home', label: 'בית' },
  { value: 'client', label: 'אצל לקוח' },
];

const EMPTY_FORM = {
  start_time: '',
  end_time: '',
  client_id: '',
  project_id: '',
  task_id: '',
  location: 'office',
  description: '',
};

function formatDateHebrew(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  const d = new Date(year, month - 1, day);
  const days = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];
  const dayName = days[d.getDay()];
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  const yy = String(year).slice(2);
  return `יום ${dayName} ${dd}/${mm}/${yy}`;
}

function timeToMinutes(timeValue) {
  if (!timeValue) return null;
  const [hours, minutes] = timeValue.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return (hours * 60) + minutes;
}

function calcDuration(startTime, endTime) {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  if (startMinutes == null || endMinutes == null) return null;
  if (endMinutes > startMinutes) return endMinutes - startMinutes;
  if (endMinutes < startMinutes) return (24 * 60) - startMinutes + endMinutes;
  return null;
}

function getMostUsedId(freqMap) {
  if (!freqMap || typeof freqMap !== 'object' || Array.isArray(freqMap)) return null;
  let bestId = null;
  let bestCount = 0;

  Object.entries(freqMap).forEach(([id, count]) => {
    if (Number(count) > bestCount) {
      bestId = id;
      bestCount = Number(count);
    }
  });

  return bestId;
}

function findProjectOption(clients, projectId) {
  if (!projectId) return null;

  for (const client of clients) {
    const project = client.projects.find((item) => String(item.id) === String(projectId));
    if (project) {
      return {
        clientId: String(client.id),
        clientName: client.name,
        projectId: String(project.id),
        projectName: project.name,
        project,
      };
    }
  }

  return null;
}

function findTaskOption(clients, taskId) {
  if (!taskId) return null;

  for (const client of clients) {
    for (const project of client.projects) {
      const task = project.tasks.find((item) => String(item.id) === String(taskId));
      if (task) {
        return {
          clientId: String(client.id),
          projectId: String(project.id),
          taskId: String(task.id),
          taskName: task.name,
          project,
          task,
        };
      }
    }
  }

  return null;
}

function resolveSelection(formLike, clients) {
  const next = { ...formLike };
  const hasClients = Array.isArray(clients) && clients.length > 0;

  if (!hasClients) {
    return next;
  }

  const projectOwner = findProjectOption(clients, next.project_id);
  const taskOwner = findTaskOption(clients, next.task_id);

  if (projectOwner) {
    next.client_id = projectOwner.clientId;
  }

  if (taskOwner) {
    next.client_id = taskOwner.clientId;
    next.project_id = taskOwner.projectId;
  }

  if (!next.client_id && clients.length === 1) {
    next.client_id = String(clients[0].id);
  }

  const selectedClient = clients.find((client) => String(client.id) === String(next.client_id)) ?? null;

  if (!selectedClient) {
    next.client_id = '';
    next.project_id = '';
    next.task_id = '';
    return next;
  }

  if (!next.project_id && selectedClient.projects.length === 1) {
    next.project_id = String(selectedClient.projects[0].id);
  }

  const selectedProject = selectedClient.projects.find((project) => String(project.id) === String(next.project_id)) ?? null;

  if (!selectedProject) {
    next.project_id = '';
    next.task_id = '';
    return next;
  }

  if (!next.task_id && selectedProject.tasks.length === 1) {
    next.task_id = String(selectedProject.tasks[0].id);
  }

  if (next.task_id && !selectedProject.tasks.some((task) => String(task.id) === String(next.task_id))) {
    next.task_id = '';
  }

  return next;
}

function buildInitialForm(entry, dropdownData) {
  const clients = dropdownData?.clients ?? [];

  const base = entry ? {
    start_time: entry.start_time ? String(entry.start_time).slice(0, 5) : '',
    end_time: entry.end_time ? String(entry.end_time).slice(0, 5) : '',
    client_id: String(entry.client_id ?? ''),
    project_id: String(entry.project_id ?? ''),
    task_id: String(entry.task_id ?? ''),
    location: entry.location ?? 'office',
    description: entry.description ?? '',
  } : {
    ...EMPTY_FORM,
    client_id: getMostUsedId(dropdownData?.sort_prefs?.client_id) ?? '',
    project_id: getMostUsedId(dropdownData?.sort_prefs?.project_id) ?? '',
    task_id: getMostUsedId(dropdownData?.sort_prefs?.task_id) ?? '',
  };

  return resolveSelection(base, clients);
}

function getLocationLabel(value) {
  return LOCATION_OPTIONS.find((item) => item.value === value)?.label ?? 'בחר מיקום';
}

function FieldError({ error }) {
  if (!error) return null;
  return <span className={styles.fieldError} role="alert">{error}</span>;
}

export function ReportForm({
  dropdownData,
  entry,
  date,
  standardHours,
  onSave,
  onCancel,
  onEntryCreated,
  onDirtyChange,
  isOnline = true,
}) {
  const isEdit = Boolean(entry?.id);
  const clients = useMemo(() => dropdownData?.clients ?? [], [dropdownData]);

  const [form, setForm] = useState(() => buildInitialForm(entry, dropdownData));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [conflictError, setConflictError] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [reportTab, setReportTab] = useState('work');
  const [picker, setPicker] = useState(null);
  const successTimerRef = useRef(null);
  const initialFormRef = useRef(buildInitialForm(entry, dropdownData));

  useEffect(() => {
    const initial = buildInitialForm(entry, dropdownData);
    initialFormRef.current = initial;
    setForm(initial);
    setErrors({});
    setPicker(null);
    setConflictError(false);
    setServerError(null);
    setIsLocked(false);
    setSuccessMsg(null);
  }, [dropdownData, entry]);

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialFormRef.current);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!isDirty) return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!successMsg) return undefined;
    clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setSuccessMsg(null), 4000);
    return () => clearTimeout(successTimerRef.current);
  }, [successMsg]);

  const projectOptions = useMemo(
    () => clients.flatMap((client) => client.projects.map((project) => ({
      clientId: String(client.id),
      clientName: client.name,
      projectId: String(project.id),
      projectName: project.name,
      project,
    }))),
    [clients],
  );

  const selectedProjectOption = useMemo(
    () => projectOptions.find((item) => item.projectId === String(form.project_id)) ?? null,
    [form.project_id, projectOptions],
  );

  const selectedProject = selectedProjectOption?.project ?? null;
  const taskOptions = selectedProject?.tasks ?? [];
  const selectedTask = taskOptions.find((task) => String(task.id) === String(form.task_id)) ?? null;
  const noAssignments = clients.length === 0 && dropdownData != null;

  const durationMinutes = calcDuration(form.start_time, form.end_time);
  const reportedHours = durationMinutes != null ? Math.round((durationMinutes / 60) * 10) / 10 : 0;
  const standardHoursValue = standardHours ?? 9;
  const standardMinutes = standardHoursValue * 60;
  const missingHours = Math.max(0, Math.round(((standardMinutes - (durationMinutes ?? 0)) / 60) * 10) / 10);
  const progressPct = durationMinutes ? Math.min((durationMinutes / standardMinutes) * 100, 100) : 0;
  const allFieldsDisabled = isLocked || (!isEdit && noAssignments);

  const filteredProjectGroups = useMemo(() => {
    const query = picker?.type === 'project' ? picker.search.trim().toLowerCase() : '';
    return clients
      .map((client) => ({
        clientId: String(client.id),
        clientName: client.name,
        projects: client.projects.filter((project) => {
          if (!query) return true;
          return project.name.toLowerCase().includes(query) || client.name.toLowerCase().includes(query);
        }),
      }))
      .filter((group) => group.projects.length > 0);
  }, [clients, picker]);

  const pickerTitle = picker?.type === 'project'
    ? 'בחירת פרויקט'
    : picker?.type === 'task'
      ? 'בחירת משימה'
      : picker?.type === 'location'
        ? 'בחירת מיקום'
        : '';

  const pickerPrimaryLabel = picker?.type === 'project'
    ? 'המשך ודווח משימות'
    : picker?.type === 'task'
      ? 'המשך ודווח מיקום'
      : 'המשך';

  function handleClose() {
    if (isDirty) {
      setShowUnsavedDialog(true);
      return;
    }
    onCancel();
  }

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }

  function patchForm(nextPartial) {
    setErrors((current) => ({ ...current, client_id: undefined, project_id: undefined, task_id: undefined, location: undefined }));
    setServerError(null);
    setForm((current) => resolveSelection({ ...current, ...nextPartial }, clients));
  }

  function handleTimeChange(field, value) {
    setErrors((current) => ({ ...current, [field]: undefined }));
    setServerError(null);
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleDescriptionChange(value) {
    setServerError(null);
    setForm((current) => ({ ...current, description: value }));
  }

  function openPicker(type) {
    if (type === 'task' && !selectedProjectOption) {
      setPicker({ type: 'project', value: form.project_id, search: '' });
      return;
    }

    setPicker({
      type,
      value: type === 'project' ? form.project_id : type === 'task' ? form.task_id : form.location,
      search: '',
    });
  }

  function handlePickerContinue() {
    if (!picker?.value) return;

    if (picker.type === 'project') {
      const projectChoice = projectOptions.find((item) => item.projectId === String(picker.value));
      if (!projectChoice) return;

      const nextForm = resolveSelection({
        ...form,
        client_id: projectChoice.clientId,
        project_id: projectChoice.projectId,
        task_id: '',
      }, clients);

      setErrors((current) => ({ ...current, client_id: undefined, project_id: undefined, task_id: undefined }));
      setServerError(null);
      setForm(nextForm);
      setPicker({ type: 'task', value: nextForm.task_id, search: '' });
      return;
    }

    if (picker.type === 'task') {
      const nextForm = resolveSelection({ ...form, task_id: String(picker.value) }, clients);
      setErrors((current) => ({ ...current, task_id: undefined }));
      setServerError(null);
      setForm(nextForm);
      setPicker({ type: 'location', value: nextForm.location, search: '' });
      return;
    }

    patchForm({ location: picker.value });
    setPicker(null);
  }

  function clearProjectSelection() {
    if (allFieldsDisabled) return;
    patchForm({
      client_id: '',
      project_id: '',
      task_id: '',
      description: '',
    });
  }

  function validate() {
    const nextErrors = {};

    if (!form.start_time) nextErrors.start_time = 'שדה חובה';
    if (!form.end_time) nextErrors.end_time = 'שדה חובה';
    if (!form.project_id) nextErrors.project_id = 'יש לבחור פרויקט';
    if (!form.task_id) nextErrors.task_id = 'יש לבחור משימה';
    if (!form.location) nextErrors.location = 'יש לבחור מיקום';

    if (form.start_time && form.end_time) {
      const duration = calcDuration(form.start_time, form.end_time);
      if (duration == null || duration === 0) {
        nextErrors.end_time = 'שעת סיום חייבת להיות אחרי שעת ההתחלה';
      }
    }

    return nextErrors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setServerError(null);
    setConflictError(false);

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
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

      if (isEdit) {
        const saved = await updateTimeEntry(entry.id, { ...payload, version: entry.version });
        onSave(saved);
      } else {
        await createTimeEntry(payload);
        const nextInitial = buildInitialForm(null, dropdownData);
        initialFormRef.current = nextInitial;
        setForm(nextInitial);
        setErrors({});
        setPicker(null);
        setSuccessMsg('הדיווח נשמר בהצלחה!');
        onEntryCreated?.();
      }
    } catch (err) {
      const status = err?.response?.status;

      if (status === 409) {
        setConflictError(true);
      } else if (status === 422) {
        setServerError(
          err?.response?.data?.message
            || err?.response?.data?.error
            || 'שגיאת אימות. בדוק את הפרטים ונסה שוב.',
        );
      } else if (status === 423) {
        setIsLocked(true);
      } else {
        setServerError('שגיאת שרת. נסה שוב.');
      }
    } finally {
      setSaving(false);
    }
  }

  function renderPickerBody() {
    if (!picker) return null;

    if (picker.type === 'project') {
      return (
        <>
          <div className={styles.searchWrap}>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="חיפוש..."
              value={picker.search}
              onChange={(event) => setPicker((current) => ({ ...current, search: event.target.value }))}
            />
          </div>
          <div className={styles.pickerScroll}>
            {filteredProjectGroups.length === 0 ? (
              <div className={styles.emptyPicker}>לא נמצאו פרויקטים</div>
            ) : (
              filteredProjectGroups.map((group) => (
                <div key={group.clientId} className={styles.groupBlock}>
                  <div className={styles.groupTitle}>{group.clientName}</div>
                  <div className={styles.optionCard}>
                    {group.projects.map((project) => {
                      const isSelected = String(project.id) === String(picker.value);
                      return (
                        <button
                          key={project.id}
                          type="button"
                          className={styles.optionRow}
                          onClick={() => setPicker((current) => ({ ...current, value: String(project.id) }))}
                        >
                          <span className={isSelected ? styles.optionIndicatorActive : styles.optionIndicator} />
                          <span className={styles.optionText}>{project.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      );
    }

    if (picker.type === 'task') {
      return (
        <div className={styles.pickerScroll}>
          {selectedProjectOption && (
            <div className={styles.groupBlock}>
              <div className={styles.groupTitle}>{selectedProjectOption.projectName}</div>
              <div className={styles.optionCard}>
                {taskOptions.map((task) => {
                  const isSelected = String(task.id) === String(picker.value);
                  return (
                    <button
                      key={task.id}
                      type="button"
                      className={styles.optionRow}
                      onClick={() => setPicker((current) => ({ ...current, value: String(task.id) }))}
                    >
                      <span className={isSelected ? styles.optionIndicatorActive : styles.optionIndicator} />
                      <span className={styles.optionText}>{task.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {!selectedProjectOption && <div className={styles.emptyPicker}>יש לבחור פרויקט לפני בחירת משימה</div>}
        </div>
      );
    }

    return (
      <div className={styles.pickerScroll}>
        <div className={styles.optionCard}>
          {LOCATION_OPTIONS.map((option) => {
            const isSelected = option.value === picker.value;
            return (
              <button
                key={option.value}
                type="button"
                className={styles.optionRow}
                onClick={() => setPicker((current) => ({ ...current, value: option.value }))}
              >
                <span className={isSelected ? styles.optionIndicatorActive : styles.optionIndicator} />
                <span className={styles.optionText}>{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.modalBackdrop} role="presentation" onClick={handleBackdropClick}>
      <aside
        className={styles.mobileShell}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'עריכת דיווח' : 'דיווח ידני'}
        dir="rtl"
        lang="he"
      >
        {picker ? (
          <>
            <header className={styles.pickerHeader}>
              <button type="button" className={styles.iconButton} onClick={handleClose} aria-label="סגירה">
                ×
              </button>
              <div className={styles.pickerTitleWrap}>
                <h2 className={styles.pickerTitle}>{pickerTitle}</h2>
                <button type="button" className={styles.backButton} onClick={() => setPicker(null)} aria-label="חזרה">
                  ‹
                </button>
              </div>
            </header>

            {renderPickerBody()}

            <footer className={styles.pickerFooter}>
              <button
                type="button"
                className={styles.pickerPrimaryButton}
                onClick={handlePickerContinue}
                disabled={!picker.value}
              >
                {pickerPrimaryLabel}
              </button>
              <button type="button" className={styles.pickerSecondaryButton} onClick={() => setPicker(null)}>
                ביטול
              </button>
            </footer>
          </>
        ) : (
          <form className={styles.formShell} onSubmit={handleSubmit} noValidate>
            <div className={styles.formScroll}>
              <header className={styles.modalHeader}>
                <button type="button" className={styles.iconButton} onClick={handleClose} aria-label="סגירה">
                  ×
                </button>
                <h2 className={styles.modalTitle}>דיווח ידני</h2>
              </header>

              <div className={styles.tabSwitch} role="tablist" aria-label="סוג דיווח">
                <button
                  type="button"
                  role="tab"
                  aria-selected={reportTab === 'absence'}
                  className={`${styles.tabButton} ${reportTab === 'absence' ? styles.tabButtonActive : ''}`}
                  onClick={() => setReportTab('absence')}
                >
                  דיווח העדרות
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={reportTab === 'work'}
                  className={`${styles.tabButton} ${reportTab === 'work' ? styles.tabButtonActive : ''}`}
                  onClick={() => setReportTab('work')}
                >
                  דיווח עבודה
                </button>
              </div>

              <div className={styles.metaRow}>
                <span className={styles.standardBadge}>
                  <span className={styles.badgeDot} />
                  תקן יומי {standardHoursValue} שעות
                </span>
                <span className={styles.dateText}>{formatDateHebrew(date)}</span>
              </div>

              {conflictError && (
                <div className={`${styles.banner} ${styles.bannerError}`} role="alertdialog">
                  <strong>הדיווח עודכן על ידי מישהו אחר.</strong>
                  <button type="button" className={styles.bannerAction} onClick={() => window.location.reload()}>
                    רענון
                  </button>
                </div>
              )}
              {serverError && <div className={`${styles.banner} ${styles.bannerWarning}`} role="alert">{serverError}</div>}
              {isLocked && <div className={`${styles.banner} ${styles.bannerWarning}`} role="alert">החודש נעול - קריאה בלבד</div>}
              {!isOnline && <div className={`${styles.banner} ${styles.bannerNeutral}`} role="status">אין חיבור לאינטרנט - לא ניתן לשמור</div>}
              {noAssignments && <div className={`${styles.banner} ${styles.bannerInfo}`} role="status">לא שוייכת עדיין למשימות. פנה למנהל המערכת לקבלת גישה.</div>}
              {successMsg && <div className={`${styles.banner} ${styles.bannerSuccess}`} role="status">{successMsg}</div>}

              {reportTab === 'work' ? (
                <>
                  <section className={styles.sectionBlock}>
                    <div className={styles.sectionTitle}>שעות עבודה</div>
                    <div className={styles.rowCard}>
                      <label className={styles.timeRow}>
                        <span className={styles.timeLabel}>כניסה</span>
                        <input
                          type="time"
                          value={form.start_time}
                          onChange={(event) => handleTimeChange('start_time', event.target.value)}
                          className={`${styles.timeInput} ${errors.start_time ? styles.timeInputError : ''}`}
                          disabled={allFieldsDisabled}
                        />
                      </label>
                      <label className={styles.timeRow}>
                        <span className={styles.timeLabel}>יציאה</span>
                        <input
                          type="time"
                          value={form.end_time}
                          onChange={(event) => handleTimeChange('end_time', event.target.value)}
                          className={`${styles.timeInput} ${errors.end_time ? styles.timeInputError : ''}`}
                          disabled={allFieldsDisabled}
                        />
                      </label>
                    </div>
                    <FieldError error={errors.start_time || errors.end_time} />
                  </section>

                  <section className={styles.sectionBlock}>
                    <div className={styles.sectionTitle}>דיווח פרויקטים</div>

                    <div className={styles.rowCard}>
                      <button
                        type="button"
                        className={styles.selectRow}
                        onClick={() => openPicker('project')}
                        disabled={allFieldsDisabled || noAssignments}
                      >
                        <span className={styles.rowLabel}>פרויקט</span>
                        <span className={selectedProjectOption ? styles.rowValueSelected : styles.rowValue}>
                          {selectedProjectOption?.projectName ?? 'בחירת פרויקט'}
                        </span>
                        <span className={styles.rowChevron}>‹</span>
                      </button>

                      <button
                        type="button"
                        className={styles.selectRow}
                        onClick={() => openPicker('task')}
                        disabled={allFieldsDisabled || noAssignments}
                      >
                        <span className={styles.rowLabel}>משימה</span>
                        <span className={selectedTask ? styles.rowValueSelected : styles.rowValue}>
                          {selectedTask?.name ?? 'בחירת משימה'}
                        </span>
                        <span className={styles.rowChevron}>‹</span>
                      </button>

                      <button
                        type="button"
                        className={styles.selectRow}
                        onClick={() => openPicker('location')}
                        disabled={allFieldsDisabled}
                      >
                        <span className={styles.rowLabel}>מיקום</span>
                        <span className={form.location ? styles.rowValueSelected : styles.rowValue}>
                          {getLocationLabel(form.location)}
                        </span>
                        <span className={styles.rowChevron}>‹</span>
                      </button>

                      <label className={styles.timeRow}>
                        <span className={styles.timeLabel}>שעת התחלה</span>
                        <input
                          type="time"
                          value={form.start_time}
                          onChange={(event) => handleTimeChange('start_time', event.target.value)}
                          className={styles.timeInput}
                          disabled={allFieldsDisabled}
                        />
                      </label>

                      <label className={styles.timeRow}>
                        <span className={styles.timeLabel}>שעת סיום</span>
                        <input
                          type="time"
                          value={form.end_time}
                          onChange={(event) => handleTimeChange('end_time', event.target.value)}
                          className={styles.timeInput}
                          disabled={allFieldsDisabled}
                        />
                      </label>

                      <textarea
                        className={styles.notesInput}
                        placeholder="הוספת פירוט..."
                        value={form.description}
                        onChange={(event) => handleDescriptionChange(event.target.value)}
                        disabled={allFieldsDisabled}
                        rows={3}
                      />

                      <button
                        type="button"
                        className={styles.deleteProjectButton}
                        onClick={clearProjectSelection}
                        disabled={allFieldsDisabled}
                      >
                        מחיקת פרויקט
                      </button>
                    </div>

                    <FieldError error={errors.project_id || errors.task_id || errors.location} />

                    <button
                      type="button"
                      className={styles.addProjectButton}
                      onClick={() => openPicker('project')}
                      disabled={allFieldsDisabled || noAssignments}
                    >
                      <span className={styles.addProjectIcon}>+</span>
                      הוספת פרויקט
                    </button>
                  </section>
                </>
              ) : (
                <section className={styles.sectionBlock}>
                  <div className={styles.sectionTitle}>דיווח העדרות</div>
                  <div className={styles.placeholderCard}>
                    מסך העדרות יותאם בשלב הבא. כרגע שכפלתי את זרימת דיווח העבודה לפי המודל שביקשת.
                  </div>
                </section>
              )}
            </div>

            <footer className={styles.sheetFooter}>
              <div className={styles.footerSummary}>
                <span className={styles.footerLabel}>{reportedHours} מתוך {standardHoursValue} שעות</span>
                <span className={styles.footerHint}>חסרות {missingHours} שעות לדיווח</span>
              </div>
              <div className={styles.progressTrack} aria-hidden="true">
                <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
                {progressPct > 0 && progressPct < 100 && (
                  <span className={styles.progressThumb} style={{ insetInlineStart: `${progressPct}%` }} />
                )}
              </div>
              <div className={styles.footerButtons}>
                <button type="submit" className={styles.saveButton} disabled={saving || allFieldsDisabled || !isOnline}>
                  {saving ? 'שומר...' : 'שמירה'}
                </button>
                <button type="button" className={styles.cancelButton} onClick={handleClose} disabled={saving}>
                  ביטול
                </button>
              </div>
            </footer>
          </form>
        )}

        {showUnsavedDialog && (
          <div className={styles.unsavedBackdrop} role="presentation">
            <div className={styles.unsavedDialog} role="alertdialog" aria-modal="true">
              <h3 className={styles.unsavedTitle}>יש שינויים שלא נשמרו</h3>
              <p className={styles.unsavedBody}>יש לך שינויים שלא נשמרו. לצאת בכל זאת?</p>
              <div className={styles.unsavedActions}>
                <button type="button" className={styles.unsavedStay} onClick={() => setShowUnsavedDialog(false)}>
                  המשך עריכה
                </button>
                <button type="button" className={styles.unsavedLeave} onClick={onCancel}>
                  יציאה ללא שמירה
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
