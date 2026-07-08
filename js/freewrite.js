let autoSaveTimer = null;
let currentPaperStyle = 'lined';
let isUnsaved = false;
let freeWriteDate = null;

async function init() {
  // Honor a date handed in from the Calendar / history list, else today
  freeWriteDate = window._entryDateOverride || App.todayKey();
  window._entryDateOverride = null;
  renderPaperToggle();
  renderDateNav();
  await loadFreeWrite();
  attachAutoSave();
  updateCounts();
  await renderHistory();
}

function renderPaperToggle() {
  const container = document.getElementById('paper-style-toggle');
  if (!container) return;

  container.innerHTML = `
    <div class="paper-style-toggle">
      <button class="paper-style-btn ${currentPaperStyle === 'lined' ? 'active' : ''}" data-style="lined">Lined</button>
      <button class="paper-style-btn ${currentPaperStyle === 'dot' ? 'active' : ''}" data-style="dot">Dot Grid</button>
      <button class="paper-style-btn ${currentPaperStyle === 'blank' ? 'active' : ''}" data-style="blank">Blank</button>
    </div>
  `;

  container.querySelectorAll('.paper-style-btn').forEach(btn => {
    btn.addEventListener('click', () => setPaperStyle(btn.dataset.style));
  });
}

function setPaperStyle(style) {
  currentPaperStyle = style;

  const paper = document.getElementById('freewrite-paper');
  if (paper) {
    paper.className = `freewrite-paper paper-${style}`;
  }

  document.querySelectorAll('.paper-style-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.style === style);
  });
}

/* ── Date navigation ── */
function renderDateNav() {
  const label = document.getElementById('freewrite-date-label');
  if (label) {
    const d = App.parseDateKey(freeWriteDate);
    label.textContent = freeWriteDate === App.todayKey()
      ? `Today · ${App.formatDate(d)}`
      : App.formatDateFull(d);
  }

  const isToday = freeWriteDate === App.todayKey();
  const prevBtn  = document.getElementById('freewrite-prev-btn');
  const nextBtn  = document.getElementById('freewrite-next-btn');
  const todayBtn = document.getElementById('freewrite-today-btn');

  if (prevBtn)  prevBtn.onclick  = () => goToDay(-1);
  if (nextBtn) {
    // Free writing is for looking back, not ahead — cap at today
    nextBtn.disabled = isToday;
    nextBtn.style.visibility = isToday ? 'hidden' : '';
    nextBtn.onclick = () => goToDay(1);
  }
  if (todayBtn) {
    todayBtn.style.display = isToday ? 'none' : '';
    todayBtn.onclick = () => goToToday();
  }
}

async function goToDay(offset) {
  // Persist any unsaved text for the day we're leaving
  clearTimeout(autoSaveTimer);
  if (isUnsaved) { try { await persist(); } catch { /* keep navigating */ } }

  const d = App.parseDateKey(freeWriteDate);
  d.setDate(d.getDate() + offset);
  const next = App.dateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
  if (next > App.todayKey()) return; // never past today
  freeWriteDate = next;

  renderDateNav();
  await loadFreeWrite();
  await renderHistory();
}

async function goToToday() {
  clearTimeout(autoSaveTimer);
  if (isUnsaved) { try { await persist(); } catch { /* keep navigating */ } }
  freeWriteDate = App.todayKey();
  renderDateNav();
  await loadFreeWrite();
  await renderHistory();
}

async function loadFreeWrite() {
  const entry = await JournalDB.getEntry(freeWriteDate);
  const textarea = document.getElementById('freewrite-textarea');
  if (!textarea) return;

  // Always reset first, so switching to an empty day clears the last one's text
  textarea.value = entry?.freeWrite?.content || '';
  currentPaperStyle = entry?.freeWrite?.paperStyle || 'lined';
  setPaperStyle(currentPaperStyle);
  renderPaperToggle();

  isUnsaved = false;
  updateCounts();
}

function updateCounts() {
  const textarea = document.getElementById('freewrite-textarea');
  const countEl  = document.getElementById('freewrite-counts');
  if (!textarea || !countEl) return;

  const text   = textarea.value;
  const chars  = text.length;
  const words  = text.trim() ? text.trim().split(/\s+/).length : 0;
  countEl.textContent = `${words} words · ${chars} chars`;
}

/* ── Past free writes ── */
async function renderHistory() {
  const container = document.getElementById('freewrite-history');
  if (!container) return;

  let entries = [];
  try { entries = await JournalDB.getAllEntries(); } catch { entries = []; }

  const past = entries
    .filter(e => e.freeWrite?.content?.trim())
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);

  if (!past.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="freewrite-history-title">Past free writes</div>
    <div class="freewrite-history-list">
      ${past.map(e => {
        const d = App.parseDateKey(e.date);
        const snippet = e.freeWrite.content.trim().replace(/\s+/g, ' ').slice(0, 90);
        const isCurrent = e.date === freeWriteDate;
        return `
          <button type="button" class="freewrite-history-item ${isCurrent ? 'current' : ''}" data-date="${e.date}">
            <span class="freewrite-history-date">${App.formatDate(d)}</span>
            <span class="freewrite-history-snippet">${App.escapeHtml(snippet)}${e.freeWrite.content.trim().length > 90 ? '…' : ''}</span>
          </button>
        `;
      }).join('')}
    </div>
  `;

  container.querySelectorAll('.freewrite-history-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.dataset.date === freeWriteDate) return;
      clearTimeout(autoSaveTimer);
      if (isUnsaved) { try { await persist(); } catch { /* keep navigating */ } }
      freeWriteDate = btn.dataset.date;
      renderDateNav();
      await loadFreeWrite();
      await renderHistory();
      document.getElementById('freewrite-textarea')?.focus();
    });
  });
}

/* Merge the free-write text into the day's entry without touching the
   guided prompts, then save. Throws on failure so callers can react
   (autoSave swallows it; the Save Entry button surfaces it). */
async function persist() {
  const textarea = document.getElementById('freewrite-textarea');
  if (!textarea) return;
  const existing = await JournalDB.getEntry(freeWriteDate) || { date: freeWriteDate };
  existing.freeWrite = {
    content: textarea.value,
    paperStyle: currentPaperStyle,
  };
  await JournalDB.saveEntry(existing);
  isUnsaved = false;
}

function flashSavedIndicator() {
  const saveIndicator = document.getElementById('freewrite-autosave');
  if (!saveIndicator) return;
  saveIndicator.className = 'freewrite-autosave saved';
  saveIndicator.innerHTML = '<span class="freewrite-autosave-dot"></span> Saved';
  setTimeout(() => {
    if (saveIndicator) {
      saveIndicator.className = 'freewrite-autosave';
      saveIndicator.innerHTML = '<span class="freewrite-autosave-dot"></span> Auto-saves';
    }
  }, 2000);
}

async function autoSave() {
  try {
    await persist();
    flashSavedIndicator();
  } catch (err) {
    console.error('Auto-save failed:', err);
  }
}

// Explicit "Save Entry" button — same save as autosave, but with a warm
// confirmation. Reuses the guided entry's affirmations when available
// (no rating in Free Write, so it's always a celebration).
async function saveNow() {
  const btn = document.getElementById('freewrite-save-btn');
  clearTimeout(autoSaveTimer);
  if (btn) { btn.classList.add('saving'); btn.textContent = 'Saving…'; }
  try {
    await persist();
    flashSavedIndicator();
    await renderHistory();
    const msg = (typeof saveMessage === 'function') ? saveMessage(0) : 'Entry saved 🌸';
    App.showToast(msg, 4000);
  } catch (err) {
    App.showToast(err?.viewOnlyBlocked
      ? 'Sign in to save your journal ✨'
      : 'Could not save — please try again');
    console.error('Free Write save failed:', err);
  } finally {
    if (btn) { btn.classList.remove('saving'); btn.textContent = 'Save Entry'; }
  }
}

function scheduleAutoSave() {
  isUnsaved = true;
  const saveIndicator = document.getElementById('freewrite-autosave');
  if (saveIndicator) {
    saveIndicator.className = 'freewrite-autosave';
    saveIndicator.innerHTML = '<span class="freewrite-autosave-dot"></span> Saving...';
  }
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(autoSave, 2500);
}

function attachAutoSave() {
  const textarea = document.getElementById('freewrite-textarea');
  if (!textarea || textarea._wired) return;
  textarea._wired = true;

  textarea.addEventListener('input', () => {
    updateCounts();
    scheduleAutoSave();
  });

  const saveBtn = document.getElementById('freewrite-save-btn');
  if (saveBtn && !saveBtn._wired) {
    saveBtn._wired = true;
    saveBtn.addEventListener('click', saveNow);
  }

  // Save on page unload
  window.addEventListener('beforeunload', () => {
    if (isUnsaved) autoSave();
  });
}

window.FreeWritePage = { init };
