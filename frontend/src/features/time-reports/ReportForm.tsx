// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react';
import { createAbsence, uploadAbsenceDocument } from '../../api/absences.api';
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

const ABSENCE_DURATION_OPTIONS = [
  { value: 'single', label: 'יום אחד' },
  { value: 'range', label: 'מספר ימים' },
];

const ABSENCE_TYPE_OPTIONS = [
  { value: 'sick', label: 'מחלה', requiresDocument: true, isPartial: false },
  { value: 'vacation_full', label: 'חופשה ללא תשלום', requiresDocument: false, isPartial: false },
  { value: 'vacation_half', label: 'חצי יום חופש', requiresDocument: false, isPartial: true },
  { value: 'reserve', label: 'מילואים', requiresDocument: true, isPartial: false },
];

const ALLOWED_ABSENCE_FILE_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
const MAX_ABSENCE_FILE_SIZE = 10 * 1024 * 1024;

const EMPTY_ABSENCE_FORM = {
  duration: 'single',
  start_date: '',
  end_date: '',
  type: '',
  notes: '',
  file: null,
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

function formatDatePill(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${String(year).slice(2)}`;
}

function toLocalDateParts(dateStr) {
  const [year, month, day] = String(dateStr).split('-').map(Number);
  return { year, month, day };
}

function isFridayOrSaturday(dateStr) {
  const { year, month, day } = toLocalDateParts(dateStr);
  const date = new Date(year, month - 1, day);
  const dayIndex = date.getDay();
  return dayIndex === 5 || dayIndex === 6;
}

function countAbsenceWorkingDays(startDate, endDate) {
  if (!startDate || !endDate || startDate > endDate) return 0;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  let total = 0;

  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    if (!isFridayOrSaturday(dateStr)) {
      total += 1;
    }
  }

  return total;
}

function buildInitialAbsenceForm(date) {
  return {
    ...EMPTY_ABSENCE_FORM,
    start_date: date,
    end_date: date,
  };
}

function getPickerTitle(picker) {
  switch (picker?.type) {
    case 'project':
      return 'בחירת פרויקט';
    case 'task':
      return 'בחירת משימה';
    case 'location':
      return 'בחירת מיקום';
    case 'absence-duration':
      return 'בחירת משך';
    case 'absence-type':
      return 'בחירת סוג דיווח';
    default:
      return '';
  }
}

function getPickerPrimaryLabel(picker) {
  switch (picker?.type) {
    case 'project':
      return 'המשך ודיווח משימות';
    case 'task':
      return 'המשך ודיווח מיקום';
    default:
      return 'המשך';
  }
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
  const [absenceForm, setAbsenceForm] = useState(() => buildInitialAbsenceForm(date));
  const successTimerRef = useRef(null);
  const initialFormRef = useRef(buildInitialForm(entry, dropdownData));
  const absenceDateInputRef = useRef(null);
  const absenceEndDateInputRef = useRef(null);
  const absenceFileInputRef = useRef(null);

  useEffect(() => {
    const initial = buildInitialForm(entry, dropdownData);
    initialFormRef.current = initial;
    setForm(initial);
    setAbsenceForm(buildInitialAbsenceForm(date));
    setErrors({});
    setPicker(null);
    setConflictError(false);
    setServerError(null);
    setIsLocked(false);
    setSuccessMsg(null);
  }, [date, dropdownData, entry]);

  const isWorkDirty = JSON.stringify(form) !== JSON.stringify(initialFormRef.current);
  const isAbsenceDirty = JSON.stringify(absenceForm) !== JSON.stringify(buildInitialAbsenceForm(date));
  const isDirty = reportTab === 'absence' ? isAbsenceDirty : isWorkDirty;

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
  const submitDisabled = saving || !isOnline || (reportTab === 'work' ? allFieldsDisabled : isLocked);
  const selectedAbsenceType = ABSENCE_TYPE_OPTIONS.find((option) => option.value === absenceForm.type) ?? null;
  const selectedAbsenceDuration = ABSENCE_DURATION_OPTIONS.find((option) => option.value === absenceForm.duration) ?? ABSENCE_DURATION_OPTIONS[0];
  const absenceWorkingDays = countAbsenceWorkingDays(
    absenceForm.start_date,
    absenceForm.duration === 'range' ? absenceForm.end_date : absenceForm.start_date,
  );
  const absenceRequiresDocument = selectedAbsenceType?.requiresDocument ?? false;

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

  function patchAbsence(nextPartial) {
    setErrors((current) => ({
      ...current,
      absence_start_date: undefined,
      absence_end_date: undefined,
      absence_type: undefined,
      absence_file: undefined,
    }));
    setServerError(null);
    setAbsenceForm((current) => ({ ...current, ...nextPartial }));
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
    if (type === 'absence-duration') {
      setPicker({ type, value: absenceForm.duration, search: '' });
      return;
    }

    if (type === 'absence-type') {
      setPicker({ type, value: absenceForm.type, search: '' });
      return;
    }

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

    if (picker.type === 'absence-duration') {
      patchAbsence({
        duration: picker.value,
        end_date: picker.value === 'single'
          ? (absenceForm.start_date || date)
          : (absenceForm.end_date || absenceForm.start_date || date),
      });
      setPicker(null);
      return;
    }

    if (picker.type === 'absence-type') {
      const selectedOption = ABSENCE_TYPE_OPTIONS.find((option) => option.value === picker.value);
      patchAbsence({
        type: picker.value,
        duration: selectedOption?.isPartial ? 'single' : absenceForm.duration,
        end_date: selectedOption?.isPartial ? (absenceForm.start_date || date) : absenceForm.end_date,
      });
      setPicker(null);
      return;
    }

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

  function openDateInput(ref) {
    ref?.current?.showPicker?.();
    ref?.current?.click?.();
  }

  function handleAbsenceDateChange(field, value) {
    if (!value) return;

    setErrors((current) => ({
      ...current,
      absence_start_date: undefined,
      absence_end_date: undefined,
    }));
    setServerError(null);

    setAbsenceForm((current) => {
      const next = { ...current, [field]: value };

      if (field === 'start_date') {
        if (current.duration === 'single' || !current.end_date || current.end_date < value) {
          next.end_date = value;
        }
      }

      if (field === 'end_date' && value < current.start_date) {
        next.start_date = value;
      }

      return next;
    });
  }

  function handleAbsenceFileChange(event) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
    if (!ALLOWED_ABSENCE_FILE_EXTENSIONS.includes(extension)) {
      setErrors((current) => ({ ...current, absence_file: 'ניתן להעלות רק PDF, JPG, JPEG, PNG, DOC או DOCX' }));
      return;
    }

    if (file.size > MAX_ABSENCE_FILE_SIZE) {
      setErrors((current) => ({ ...current, absence_file: 'גודל הקובץ המקסימלי הוא 10MB' }));
      return;
    }

    patchAbsence({ file });
  }

  function clearAbsenceFile() {
    patchAbsence({ file: null });
    if (absenceFileInputRef.current) {
      absenceFileInputRef.current.value = '';
    }
  }

  function validate() {
    const nextErrors = {};
    if (reportTab === 'absence') {
      if (!absenceForm.start_date) nextErrors.absence_start_date = 'יש לבחור תאריך';
      if (absenceForm.duration === 'range' && !absenceForm.end_date) nextErrors.absence_end_date = 'יש לבחור טווח תאריכים';
      if (absenceForm.start_date && absenceForm.end_date && absenceForm.start_date > absenceForm.end_date) {
        nextErrors.absence_end_date = 'תאריך הסיום חייב להיות אחרי תאריך ההתחלה';
      }
      if (!absenceForm.type) nextErrors.absence_type = 'יש לבחור סוג דיווח';
      return nextErrors;
    }

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
      if (reportTab === 'absence') {
        const response = await createAbsence({
          type: absenceForm.type,
          start_date: absenceForm.start_date,
          end_date: absenceForm.duration === 'range' ? absenceForm.end_date : absenceForm.start_date,
          is_partial: selectedAbsenceType?.isPartial ?? false,
          notes: absenceForm.notes || null,
        });

        const savedAbsence = response?.data ?? response;

        if (absenceForm.file && savedAbsence?.id) {
          try {
            await uploadAbsenceDocument(savedAbsence.id, absenceForm.file);
          } catch {
            setSuccessMsg('ההיעדרות נשמרה, אך העלאת הקובץ נכשלה.');
            return;
          }
        }

        setAbsenceForm(buildInitialAbsenceForm(date));
        setErrors({});
        setPicker(null);
        setSuccessMsg(
          response?.warning
            ? `דיווח ההיעדרות נשמר. ${response.warning}`
            : 'דיווח ההיעדרות נשמר בהצלחה!',
        );
        onEntryCreated?.();
        return;
      }

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

    if (picker.type === 'absence-duration') {
      return (
        <div className={styles.pickerScroll}>
          <div className={styles.optionCard}>
            {ABSENCE_DURATION_OPTIONS.map((option) => {
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

    if (picker.type === 'absence-type') {
      return (
        <div className={styles.pickerScroll}>
          <div className={styles.optionCard}>
            {ABSENCE_TYPE_OPTIONS.map((option) => {
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
                <h2 className={styles.pickerTitle}>{getPickerTitle(picker)}</h2>
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
                {getPickerPrimaryLabel(picker)}
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
                  <div className={styles.absenceCard}>
                    <button type="button" className={styles.absenceRow} onClick={() => openPicker('absence-duration')}>
                      <span className={styles.absenceRowLabel}>משך</span>
                      <span className={styles.absenceRowMeta}>
                        <span className={styles.absenceRowValuePill}>{selectedAbsenceDuration.label}</span>
                        <span className={styles.absenceRowChevron}>‹</span>
                      </span>
                    </button>

                    <button
                      type="button"
                      className={styles.absenceRow}
                      onClick={() => openDateInput(absenceDateInputRef)}
                    >
                      <span className={styles.absenceRowLabel}>
                        {absenceForm.duration === 'range' ? 'תאריך התחלה' : 'תאריך'}
                      </span>
                      <span className={styles.absenceRowMeta}>
                        <span className={styles.absenceRowValuePill}>{formatDatePill(absenceForm.start_date)}</span>
                        <span className={styles.absenceRowChevron}>‹</span>
                      </span>
                    </button>

                    {absenceForm.duration === 'range' && (
                      <button
                        type="button"
                        className={styles.absenceRow}
                        onClick={() => openDateInput(absenceEndDateInputRef)}
                      >
                        <span className={styles.absenceRowLabel}>טווח תאריכים</span>
                        <span className={styles.absenceRowMeta}>
                          <span className={styles.absenceRowValuePill}>{formatDatePill(absenceForm.end_date)}</span>
                          <span className={styles.absenceRowChevron}>‹</span>
                        </span>
                      </button>
                    )}

                    <button type="button" className={styles.absenceRow} onClick={() => openPicker('absence-type')}>
                      <span className={styles.absenceRowLabel}>סוג דיווח</span>
                      <span className={styles.absenceRowMeta}>
                        <span className={selectedAbsenceType ? styles.absenceRowValuePill : styles.absenceRowValueEmpty}>
                          {selectedAbsenceType?.label ?? 'בחירת סוג דיווח'}
                        </span>
                        <span className={styles.absenceRowChevron}>‹</span>
                      </span>
                    </button>
                  </div>
                  <input
                    ref={absenceDateInputRef}
                    type="date"
                    className={styles.hiddenNativeInput}
                    value={absenceForm.start_date}
                    onChange={(event) => handleAbsenceDateChange('start_date', event.target.value)}
                  />
                  <input
                    ref={absenceEndDateInputRef}
                    type="date"
                    className={styles.hiddenNativeInput}
                    value={absenceForm.end_date}
                    onChange={(event) => handleAbsenceDateChange('end_date', event.target.value)}
                  />
                  <input
                    ref={absenceFileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    className={styles.hiddenNativeInput}
                    onChange={handleAbsenceFileChange}
                  />

                  <FieldError error={errors.absence_start_date || errors.absence_end_date || errors.absence_type} />

                  {absenceForm.duration === 'range' && absenceWorkingDays > 0 && (
                    <div className={styles.absenceDaysSummary}>
                      סה"כ ימי דיווח: <strong>{absenceWorkingDays} ימים</strong>
                    </div>
                  )}

                  <div className={styles.absenceUploadLabel}>צריך קבצים רלוונטיים</div>

                  {absenceForm.file ? (
                    <div className={styles.uploadedFileCard}>
                      <button type="button" className={styles.uploadedFileDelete} onClick={clearAbsenceFile} aria-label="מחיקת קובץ">
                        ×
                      </button>
                      <div className={styles.uploadedFileMeta}>
                        <span className={styles.uploadedFileName}>{absenceForm.file.name}</span>
                        {absenceRequiresDocument && <span className={styles.uploadedFileBadge}>הועלה בהצלחה</span>}
                      </div>
                      <span className={styles.uploadedFileType}>{absenceForm.file.name.split('.').pop()?.toUpperCase() ?? 'FILE'}</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles.uploadDropzone}
                      onClick={() => absenceFileInputRef.current?.click()}
                    >
                      <span className={styles.uploadIcon}>↑</span>
                      <span className={styles.uploadPrimary}>לחץ כאן להעלאת הקובץ</span>
                      <span className={styles.uploadSecondary}>JPG / PNG / PDF / DOC / DOCX</span>
                    </button>
                  )}

                  {absenceRequiresDocument && !absenceForm.file && (
                    <div className={styles.documentRequirementHint}>חובה לצרף מסמך עד להגשה</div>
                  )}

                  <FieldError error={errors.absence_file} />
                </section>
              )}
            </div>

            <footer className={styles.sheetFooter}>
              {reportTab === 'work' && (
                <>
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
                </>
              )}
              <div className={`${styles.footerButtons} ${reportTab === 'absence' ? styles.footerButtonsAbsence : ''}`}>
                <button type="submit" className={styles.saveButton} disabled={submitDisabled}>
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

