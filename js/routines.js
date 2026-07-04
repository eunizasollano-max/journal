(function () {
const PALETTE = ['#e08e9d', '#dfa15e', '#e3bd55', '#8fbf9f', '#89b3dc', '#a99ad9', '#c97b93', '#d9917f'];

const DEFAULT_SECTIONS = [
  { key: 'spiritual', name: 'Spiritual Life', color: '#e08e9d' },
  { key: 'family',    name: 'Family Life',    color: '#dfa15e' },
  { key: 'personal',  name: 'Personal Life',  color: '#a99ad9' },
  { key: 'work',      name: 'Work',           color: '#c97b93' },
];

const WEEKDAY_SHORT  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

let viewDate    = new Date();
let sections    = [];
let allRoutines = [];
let dayLog      = {};   // completion map for the viewed day
let nextDayLog  = {};   // completion map for the "Tomorrow" preview
let filterKey   = null; // section key currently filtering the list, or null
let formState   = null; // null | { mode: 'add' } | { mode: 'edit', id }
let renamingKey = null; // section key being renamed | '__new__' | null

async function init() {
  viewDate    = new Date();
  formState   = null;
  renamingKey = null;
  renderHeader();
  await loadData();
  render();
}

async function reinit() {
  renderHeader();
  await loadData();
  render();
}

async function loadData() {
  allRoutines = await JournalDB.getRoutines();
  dayLog      = await JournalDB.getRoutineLog(currentDateKey());
  sections    = loadSections();
  if (isToday()) {
    const t = new Date(viewDate);
    t.setDate(t.getDate() + 1);
    nextDayLog = await JournalDB.getRoutineLog(dateKeyFor(t));
  } else {
    nextDayLog = {};
  }
}

function dateKeyFor(d) {
  return App.dateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function currentDateKey() {
  return dateKeyFor(viewDate);
}

function isToday() {
  return currentDateKey() === App.todayKey();
}

/* Sections live in localStorage. Older builds stored a plain
   { key: name } object — migrate that shape onto the defaults. */
function loadSections() {
  try {
    const raw = localStorage.getItem('journal_routine_sections');
    if (!raw) return DEFAULT_SECTIONS.map(s => ({ ...s }));
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((s, i) => ({
        key:   s.key,
        name:  s.name || 'Untitled',
        color: s.color || PALETTE[i % PALETTE.length],
      }));
    }
    return DEFAULT_SECTIONS.map(s => ({ ...s, name: parsed[s.key] || s.name }));
  } catch {
    return DEFAULT_SECTIONS.map(s => ({ ...s }));
  }
}

function saveSections() {
  localStorage.setItem('journal_routine_sections', JSON.stringify(sections));
}

function nextFreeColor() {
  const used = new Set(sections.map(s => s.color));
  return PALETTE.find(c => !used.has(c)) || PALETTE[sections.length % PALETTE.length];
}

/* Pill text needs to stay readable on every section color */
function textColorFor(hex) {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 168 ? '#6b5140' : '#ffffff';
}

function visibleOn(routine, date, log) {
  const rec = routine.recurrence || { type: 'daily' };
  // One-time items stay visible (checked) on the day they were completed
  if (rec.type === 'once') return !routine.archived || !!log[routine.id];
  // Recurring items with an end date stop appearing after it
  if (rec.until && dateKeyFor(date) > rec.until) return false;
  if (rec.type === 'weekly') return (rec.days || []).includes(date.getDay());
  return !routine.archived;
}

function untilLabel(until) {
  if (!until) return '';
  const [, m, d] = until.split('-').map(Number);
  return `until ${App.MONTHS_SHORT[m - 1]} ${d}`;
}

function renderHeader() {
  const label = document.getElementById('routines-date-label');
  if (label) {
    const today   = isToday();
    const dayName = today ? 'Today' : App.DAYS[viewDate.getDay()];
    const sub     = `${App.MONTHS[viewDate.getMonth()]} ${viewDate.getDate()}${today ? '' : ', ' + viewDate.getFullYear()}`;
    label.innerHTML = `<span class="goals-month-name">${dayName}</span><span class="goals-month-year">${sub}</span>`;
  }

  const todayBtn = document.getElementById('routines-today-btn');
  if (todayBtn) {
    todayBtn.style.display = isToday() ? 'none' : '';
    todayBtn.onclick = () => { viewDate = new Date(); formState = null; reinit(); };
  }

  const prevBtn = document.getElementById('routines-prev-btn');
  const nextBtn = document.getElementById('routines-next-btn');
  if (prevBtn) prevBtn.onclick = () => goToDay(-1);
  if (nextBtn) nextBtn.onclick = () => goToDay(1);
}

function goToDay(offset) {
  viewDate.setDate(viewDate.getDate() + offset);
  formState   = null;
  renamingKey = null;
  reinit();
}

/* ── Rendering ── */

function render() {
  const body = document.getElementById('routines-body');
  if (!body) return;
  body.innerHTML = catsHtml() + listHtml() + tomorrowHtml();
  attach(body);
}

function catsHtml() {
  const cards = sections.map(sec => renamingKey === sec.key ? catFormHtml(sec) : catCardHtml(sec)).join('');
  const add = renamingKey === '__new__'
    ? catFormHtml(null)
    : `<button type="button" class="routine-cat-add" aria-label="Add a section" title="Add a section">＋</button>`;
  return `<div class="routine-cats">${cards}${add}</div>`;
}

function catCardHtml(sec) {
  const oneTime   = allRoutines.filter(r => r.section === sec.key && r.recurrence?.type === 'once' && !r.archived).length;
  const recurring = allRoutines.filter(r => r.section === sec.key && r.recurrence?.type !== 'once').length;
  const counts    = `${oneTime} task${oneTime === 1 ? '' : 's'} • ${recurring} routine${recurring === 1 ? '' : 's'}`;
  const state     = filterKey ? (filterKey === sec.key ? 'active' : 'dimmed') : '';
  return `
    <button type="button" class="routine-cat-card ${state}" data-key="${sec.key}"
      style="background:${sec.color};color:${textColorFor(sec.color)}">
      <span class="routine-cat-name">${escapeHtml(sec.name)}</span>
      <span class="routine-cat-counts">${counts}</span>
      <span class="routine-cat-edit" title="Edit section">✎</span>
    </button>
  `;
}

function catFormHtml(sec) {
  const color = sec?.color || nextFreeColor();
  return `
    <div class="routine-cat-form" data-key="${sec ? sec.key : '__new__'}">
      <input type="text" class="input" id="routine-cat-name-input"
        value="${sec ? escapeAttr(sec.name) : ''}" placeholder="Section name..." maxlength="30">
      <div class="routine-color-dots">
        ${PALETTE.map(c => `<button type="button" class="routine-color-dot ${c === color ? 'selected' : ''}" data-color="${c}" style="background:${c}" aria-label="Pick color"></button>`).join('')}
      </div>
      <div class="routine-form-actions">
        ${sec ? `<button type="button" class="btn-ghost btn-sm routine-cat-delete-btn">Delete</button>` : ''}
        <button type="button" class="btn-ghost btn-sm routine-cat-cancel-btn">Cancel</button>
        <button type="button" class="btn btn-primary btn-sm routine-cat-save-btn">Save</button>
      </div>
    </div>
  `;
}

function sortedVisible(date, log) {
  return allRoutines
    .filter(r => visibleOn(r, date, log) && (!filterKey || r.section === filterKey))
    .sort((a, b) =>
      ((log[a.id] ? 1 : 0) - (log[b.id] ? 1 : 0)) ||
      ((a.createdAt || 0) - (b.createdAt || 0)));
}

function listHtml() {
  const items = sortedVisible(viewDate, dayLog);
  const rows  = items.map(r =>
    (formState?.mode === 'edit' && formState.id === r.id) ? formHtml(r) : pillHtml(r, dayLog, false)
  ).join('');
  const empty = items.length === 0
    ? `<p class="text-muted routine-empty">Nothing here for this day — add something below 🌸</p>` : '';
  const addArea = formState?.mode === 'add'
    ? formHtml(null)
    : `<button type="button" class="routine-add-launch">＋ Add a task or routine</button>`;
  return `<div class="routine-list">${rows}${empty}</div>${addArea}`;
}

function pillHtml(r, log, preview) {
  const sec   = sections.find(s => s.key === r.section);
  const color = sec?.color || '#c9b0b6';
  const done  = !!log[r.id];
  const rec   = r.recurrence || { type: 'daily' };
  const daysPart = rec.type === 'weekly'
    ? (rec.days || []).slice().sort((a, b) => a - b).map(d => WEEKDAY_SHORT[d]).join(', ')
    : '';
  const daysLabel = [daysPart, rec.type !== 'once' ? untilLabel(rec.until) : ''].filter(Boolean).join(' · ');
  return `
    <div class="routine-pill ${done ? 'done' : ''} ${preview ? 'preview' : ''}"
      style="background:${color};color:${textColorFor(color)}">
      <button type="button" class="routine-pill-check ${done ? 'checked' : ''}" data-id="${r.id}"
        aria-label="${done ? 'Mark not done' : 'Mark done'}">${done ? '✓' : ''}</button>
      <span class="routine-pill-text">${escapeHtml(r.text)}</span>
      ${daysLabel ? `<span class="routine-pill-days">${daysLabel}</span>` : ''}
      ${preview ? '' : `
        <button type="button" class="routine-pill-action routine-pill-edit" data-id="${r.id}" aria-label="Edit" title="Edit">✎</button>
        <button type="button" class="routine-pill-action routine-pill-delete" data-id="${r.id}" aria-label="Delete" title="Delete">✕</button>`}
      ${rec.type !== 'once' ? `<span class="routine-recur-icon" title="Repeats">⟳</span>` : ''}
    </div>
  `;
}

function formHtml(r) {
  const rec        = r?.recurrence || { type: 'daily', days: [] };
  const selSection = r?.section || filterKey || sections[0]?.key;
  return `
    <div class="routine-form">
      <input type="text" class="input" id="routine-form-text"
        placeholder="What do you need to do?" value="${r ? escapeAttr(r.text) : ''}">
      <div class="routine-form-row">
        <select class="input routine-form-select" id="routine-form-cat">
          ${sections.map(s => `<option value="${s.key}" ${s.key === selSection ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}
        </select>
        <select class="input routine-form-select" id="routine-form-recur">
          <option value="daily"  ${rec.type === 'daily'  ? 'selected' : ''}>Every day</option>
          <option value="weekly" ${rec.type === 'weekly' ? 'selected' : ''}>Specific days</option>
          <option value="once"   ${rec.type === 'once'   ? 'selected' : ''}>One-time</option>
        </select>
        <div class="routine-day-chips ${rec.type === 'weekly' ? '' : 'hidden'}" id="routine-form-chips">
          ${WEEKDAY_LETTER.map((l, i) => `<button type="button" class="routine-day-chip ${(rec.days || []).includes(i) ? 'active' : ''}" data-day="${i}">${l}</button>`).join('')}
        </div>
        <label class="routine-form-until ${rec.type === 'once' ? 'hidden' : ''}" id="routine-form-until-wrap">
          <span>until</span>
          <input type="date" class="input" id="routine-form-until" value="${rec.until || ''}" title="Optional — leave empty to repeat forever">
        </label>
      </div>
      <div class="routine-form-actions">
        ${r ? `<button type="button" class="btn-ghost btn-sm routine-form-delete-btn" data-id="${r.id}">Delete</button>` : ''}
        <button type="button" class="btn-ghost btn-sm routine-form-cancel-btn">Cancel</button>
        <button type="button" class="btn btn-primary btn-sm routine-form-save-btn">${r ? 'Save' : 'Add'}</button>
      </div>
    </div>
  `;
}

function tomorrowHtml() {
  if (!isToday()) return '';
  const t = new Date(viewDate);
  t.setDate(t.getDate() + 1);
  const items = sortedVisible(t, nextDayLog);
  if (!items.length) return '';
  return `
    <div class="routine-tomorrow">
      <div class="routine-tomorrow-title">Tomorrow</div>
      <div class="routine-tomorrow-sub">${App.MONTHS[t.getMonth()]} ${t.getDate()}</div>
      <div class="routine-list">${items.map(r => pillHtml(r, nextDayLog, true)).join('')}</div>
    </div>
  `;
}

/* ── Listeners ── */

function attach(body) {
  body.querySelectorAll('.routine-cat-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.routine-cat-edit')) {
        renamingKey = card.dataset.key;
        formState = null;
        render();
        document.getElementById('routine-cat-name-input')?.focus();
        return;
      }
      filterKey = filterKey === card.dataset.key ? null : card.dataset.key;
      render();
    });
  });

  body.querySelector('.routine-cat-add')?.addEventListener('click', () => {
    renamingKey = '__new__';
    formState = null;
    render();
    document.getElementById('routine-cat-name-input')?.focus();
  });

  const catForm = body.querySelector('.routine-cat-form');
  if (catForm) {
    catForm.querySelectorAll('.routine-color-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        catForm.querySelectorAll('.routine-color-dot').forEach(d => d.classList.remove('selected'));
        dot.classList.add('selected');
      });
    });
    catForm.querySelector('.routine-cat-save-btn')?.addEventListener('click', () => saveCatForm(catForm));
    catForm.querySelector('.routine-cat-cancel-btn')?.addEventListener('click', () => { renamingKey = null; render(); });
    catForm.querySelector('.routine-cat-delete-btn')?.addEventListener('click', () => deleteSection(catForm.dataset.key));
    catForm.querySelector('#routine-cat-name-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); saveCatForm(catForm); }
      if (e.key === 'Escape') { renamingKey = null; render(); }
    });
  }

  body.querySelectorAll('.routine-pill-check').forEach(btn => {
    btn.addEventListener('click', () => handleCheckToggle(btn.dataset.id));
  });

  body.querySelectorAll('.routine-pill-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      formState = { mode: 'edit', id: btn.dataset.id };
      renamingKey = null;
      render();
      document.getElementById('routine-form-text')?.focus();
    });
  });

  body.querySelectorAll('.routine-pill-delete, .routine-form-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => handleDelete(btn.dataset.id));
  });

  body.querySelector('.routine-add-launch')?.addEventListener('click', () => {
    formState = { mode: 'add' };
    renamingKey = null;
    render();
    document.getElementById('routine-form-text')?.focus();
  });

  const form = body.querySelector('.routine-form');
  if (form) {
    form.querySelector('#routine-form-recur')?.addEventListener('change', (e) => {
      document.getElementById('routine-form-chips')?.classList.toggle('hidden', e.target.value !== 'weekly');
      document.getElementById('routine-form-until-wrap')?.classList.toggle('hidden', e.target.value === 'once');
    });
    form.querySelectorAll('.routine-day-chip').forEach(chip => {
      chip.addEventListener('click', () => chip.classList.toggle('active'));
    });
    form.querySelector('.routine-form-save-btn')?.addEventListener('click', saveForm);
    form.querySelector('.routine-form-cancel-btn')?.addEventListener('click', () => { formState = null; render(); });
    form.querySelector('#routine-form-text')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); saveForm(); }
      if (e.key === 'Escape') { formState = null; render(); }
    });
  }
}

/* ── Actions ── */

async function saveCatForm(catForm) {
  const name  = document.getElementById('routine-cat-name-input')?.value.trim();
  const color = catForm.querySelector('.routine-color-dot.selected')?.dataset.color || nextFreeColor();
  if (!name) return;
  if (catForm.dataset.key === '__new__') {
    sections.push({ key: 'cat-' + Date.now().toString(36), name, color });
  } else {
    const sec = sections.find(s => s.key === catForm.dataset.key);
    if (sec) { sec.name = name; sec.color = color; }
  }
  saveSections();
  renamingKey = null;
  render();
}

async function deleteSection(key) {
  const sec = sections.find(s => s.key === key);
  if (!sec) return;
  const items = allRoutines.filter(r => r.section === key);
  const suffix = items.length ? ` and its ${items.length} item${items.length === 1 ? '' : 's'}` : '';
  if (!confirm(`Delete "${sec.name}"${suffix}?`)) return;
  for (const r of items) await JournalDB.deleteRoutine(r.id);
  allRoutines = allRoutines.filter(r => r.section !== key);
  sections = sections.filter(s => s.key !== key);
  saveSections();
  if (filterKey === key) filterKey = null;
  renamingKey = null;
  render();
}

async function handleCheckToggle(id) {
  const done = !dayLog[id];
  dayLog = { ...dayLog, [id]: done };
  await JournalDB.setRoutineDone(currentDateKey(), id, done);

  const routine = allRoutines.find(r => r.id === id);
  if (routine?.recurrence?.type === 'once') {
    routine.archived = done;
    routine.archivedAt = done ? new Date().toISOString() : null;
    await JournalDB.saveRoutine(routine);
  }
  render();
}

async function handleDelete(id) {
  if (!confirm('Delete this item?')) return;
  await JournalDB.deleteRoutine(id);
  allRoutines = allRoutines.filter(r => r.id !== id);
  formState = null;
  render();
}

async function saveForm() {
  const text = document.getElementById('routine-form-text')?.value.trim();
  if (!text) return;
  const section = document.getElementById('routine-form-cat')?.value;
  const type    = document.getElementById('routine-form-recur')?.value || 'daily';
  const days    = type === 'weekly'
    ? Array.from(document.querySelectorAll('#routine-form-chips .routine-day-chip.active')).map(b => parseInt(b.dataset.day, 10))
    : [];
  const until   = type === 'once' ? null : (document.getElementById('routine-form-until')?.value || null);

  if (formState?.mode === 'edit') {
    const routine = allRoutines.find(r => r.id === formState.id);
    if (routine) {
      routine.text       = text;
      routine.section    = section;
      routine.recurrence = { type, days, until };
      if (type !== 'once') routine.archived = false;
      await JournalDB.saveRoutine(routine);
    }
  } else {
    const routine = {
      id:         (crypto.randomUUID ? crypto.randomUUID() : `r-${Date.now()}-${Math.random().toString(36).slice(2)}`),
      section,
      text,
      recurrence: { type, days, until },
      archived:   false,
      createdAt:  Date.now(),
    };
    await JournalDB.saveRoutine(routine);
    allRoutines.push(routine);
  }
  formState = null;
  render();
}

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.RoutinesPage = { init };
})();
