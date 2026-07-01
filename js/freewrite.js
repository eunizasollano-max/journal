let autoSaveTimer = null;
let currentPaperStyle = 'lined';
let isUnsaved = false;
let freeWriteDate = null;

async function init() {
  freeWriteDate = App.todayKey();
  renderPaperToggle();
  await loadFreeWrite();
  attachAutoSave();
  updateCounts();
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

async function loadFreeWrite() {
  const entry = await JournalDB.getEntry(freeWriteDate);
  const textarea = document.getElementById('freewrite-textarea');
  if (!textarea) return;

  if (entry?.freeWrite?.content) {
    textarea.value = entry.freeWrite.content;
    if (entry.freeWrite.paperStyle) {
      currentPaperStyle = entry.freeWrite.paperStyle;
      setPaperStyle(currentPaperStyle);
      renderPaperToggle();
    }
  }

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

async function autoSave() {
  const textarea = document.getElementById('freewrite-textarea');
  if (!textarea) return;

  const saveIndicator = document.getElementById('freewrite-autosave');

  try {
    // Load existing entry to merge freewrite data without overwriting guided prompts
    const existing = await JournalDB.getEntry(freeWriteDate) || { date: freeWriteDate };
    existing.freeWrite = {
      content: textarea.value,
      paperStyle: currentPaperStyle,
    };
    await JournalDB.saveEntry(existing);

    isUnsaved = false;
    if (saveIndicator) {
      saveIndicator.className = 'freewrite-autosave saved';
      saveIndicator.innerHTML = '<span class="freewrite-autosave-dot"></span> Saved';
      setTimeout(() => {
        if (saveIndicator) {
          saveIndicator.className = 'freewrite-autosave';
          saveIndicator.innerHTML = '<span class="freewrite-autosave-dot"></span> Auto-saves';
        }
      }, 2000);
    }
  } catch (err) {
    console.error('Auto-save failed:', err);
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
  if (!textarea) return;

  textarea.addEventListener('input', () => {
    updateCounts();
    scheduleAutoSave();
  });

  // Save on page unload
  window.addEventListener('beforeunload', () => {
    if (isUnsaved) autoSave();
  });
}

window.FreeWritePage = { init };
