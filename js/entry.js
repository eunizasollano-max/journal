const MOODS = [
  { emoji: '😊', label: 'Happy' },
  { emoji: '😌', label: 'Calm' },
  { emoji: '🥰', label: 'Loved' },
  { emoji: '✨', label: 'Inspired' },
  { emoji: '🙏', label: 'Grateful' },
  { emoji: '😔', label: 'Sad' },
  { emoji: '😤', label: 'Frustrated' },
  { emoji: '😰', label: 'Anxious' },
  { emoji: '😴', label: 'Tired' },
];

let currentSession = 'morning';
let selectedMoods  = [];
let customMoods    = [];
let selectedRating = 0;
let hoveredRating  = 0;
let mediaFiles     = [];
let currentDate    = null;

async function init() {
  currentDate = window._entryDateOverride || App.todayKey();
  window._entryDateOverride = null;
  await renderWidgets();
  renderScripture();
  renderDateHeader();
  renderPastEntryBanner();
  renderSessionToggle();
  renderMoodGrid();
  renderRating();
  renderMediaUpload();
  await loadExistingEntry();
  attachEventListeners();
}

function calcStreak(entries) {
  const keys = new Set(entries.map(e => e.date));
  let streak = 0;
  const d = new Date();
  while (true) {
    const key = App.dateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
    if (!keys.has(key)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

async function renderWidgets() {
  const container = document.getElementById('today-widgets');
  if (!container) return;
  try {
    const allEntries = await JournalDB.getAllEntries();
    const streak = calcStreak(allEntries);
    const total  = allEntries.length;
    const lastMoods = [...allEntries]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(e => e.moods || (e.mood ? [e.mood] : []))
      .find(m => m.length) || [];

    container.innerHTML = `
      <div class="widget-card">
        <div class="widget-icon">🌸</div>
        <div class="widget-value">${streak}</div>
        <div class="widget-label">day streak</div>
      </div>
      <div class="widget-card">
        <div class="widget-icon">📖</div>
        <div class="widget-value">${total}</div>
        <div class="widget-label">entries</div>
      </div>
      <div class="widget-card">
        <div class="widget-icon" style="font-size:1.8rem">${lastMoods[0]?.emoji || '✨'}</div>
        <div class="widget-label" style="margin-top:4px">last mood</div>
      </div>
    `;
  } catch { container.innerHTML = ''; }
}

function renderScripture() {
  const scripture = Scripture.getDailyScripture();
  const container = document.getElementById('entry-scripture');
  if (!container || !scripture) return;
  container.innerHTML = `
    <div class="scripture-card animate-fade-in">
      <div class="scripture-icon">✦</div>
      <p class="scripture-text">"${scripture.text}"</p>
      <span class="scripture-reference">${scripture.reference}</span>
    </div>
  `;
}

function renderDateHeader() {
  const d = App.parseDateKey(currentDate);
  const dayEl    = document.getElementById('entry-day-name');
  const dateEl   = document.getElementById('entry-date-num');
  const monthEl  = document.getElementById('entry-month-year');
  const scriptEl = document.getElementById('entry-script-date');

  if (dayEl)    dayEl.textContent    = App.DAYS[d.getDay()];
  if (dateEl)   dateEl.textContent   = d.getDate();
  if (monthEl)  monthEl.textContent  = `${App.MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  if (scriptEl) scriptEl.textContent = App.MONTHS[d.getMonth()].toLowerCase();

  // Use saved preference, fall back to time-of-day
  const saved = localStorage.getItem('journal_session');
  if (saved === 'morning' || saved === 'evening') {
    currentSession = saved;
  } else {
    currentSession = new Date().getHours() < 12 ? 'morning' : 'evening';
  }
  // Darken the theme for evening entries
  document.documentElement.classList.toggle('night-mode', currentSession === 'evening');
}

function renderPastEntryBanner() {
  const existing = document.getElementById('past-entry-banner');
  if (existing) existing.remove();
  if (currentDate === App.todayKey()) return;

  const d = App.parseDateKey(currentDate);
  const banner = document.createElement('div');
  banner.id = 'past-entry-banner';
  banner.className = 'past-entry-banner';
  banner.innerHTML = `
    <span>Editing entry for ${App.formatDateFull(d)}</span>
    <a href="#calendar" class="past-entry-back">← Back to Calendar</a>
  `;
  const section = document.getElementById('section-today');
  if (section) section.prepend(banner);
}

function renderSessionToggle() {
  const container = document.getElementById('session-toggle');
  if (!container) return;
  container.innerHTML = `
    <div class="session-toggle">
      <button class="session-btn ${currentSession === 'morning' ? 'active' : ''}" data-session="morning">
        🌤 Good morning
      </button>
      <button class="session-btn ${currentSession === 'evening' ? 'active' : ''}" data-session="evening">
        🌙 Good night
      </button>
    </div>
  `;
  container.querySelectorAll('.session-btn').forEach(btn => {
    btn.addEventListener('click', () => setSession(btn.dataset.session));
  });
}

function setSession(session) {
  currentSession = session;
  localStorage.setItem('journal_session', session);
  document.querySelectorAll('.session-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.session === session);
  });
  document.documentElement.classList.toggle('night-mode', session === 'evening');
  updateConditionalPrompts();
}

function updateConditionalPrompts() {
  const lookLabel    = document.getElementById('prompt-look-label');
  const betterLabel  = document.getElementById('prompt-better-label');
  const lookInput    = document.getElementById('prompt-look');
  const betterInput  = document.getElementById('prompt-better');

  if (currentSession === 'morning') {
    if (lookLabel)   lookLabel.textContent   = '🌸 What is one thing you\'re looking forward to today?';
    if (betterLabel) betterLabel.textContent = '💡 How can you make today better?';
    if (lookInput)   lookInput.placeholder   = 'Something that brings you joy or excitement...';
    if (betterInput) betterInput.placeholder = 'A small intention, habit, or act of kindness...';
  } else {
    if (lookLabel)   lookLabel.textContent   = '🌙 How did your day go overall?';
    if (betterLabel) betterLabel.textContent = '🌿 What could have gone better today?';
    if (lookInput)   lookInput.placeholder   = 'Share how your day unfolded...';
    if (betterInput) betterInput.placeholder = 'Gently reflect — no judgment, only growth...';
  }

  // "A kind thing I noticed today" is an evening-only reflection
  const kindCard = document.getElementById('kind-card');
  if (kindCard) {
    kindCard.style.display = currentSession === 'evening' ? '' : 'none';
  }
}

function isMoodSelected(m) {
  return selectedMoods.some(s => s.emoji === m.emoji && s.label === m.label);
}

function toggleMood(m) {
  const idx = selectedMoods.findIndex(s => s.emoji === m.emoji && s.label === m.label);
  if (idx === -1) selectedMoods.push(m);
  else selectedMoods.splice(idx, 1);
}

function renderMoodGrid() {
  const container = document.getElementById('mood-grid');
  if (!container) return;

  const fixedBtns = MOODS.map((m, i) => `
    <button class="mood-btn ${isMoodSelected(m) ? 'selected' : ''}" data-mood-index="${i}" type="button">
      <span class="mood-emoji">${m.emoji}</span>
      <span class="mood-label">${m.label}</span>
    </button>
  `).join('');

  const customBtns = customMoods.map((m, i) => `
    <button class="mood-btn mood-btn-custom ${isMoodSelected(m) ? 'selected' : ''}" data-custom-index="${i}" type="button">
      <span class="mood-remove" data-remove-custom="${i}">✕</span>
      <span class="mood-emoji${graphemes(m.emoji).length > 2 ? ' mood-emoji-text' : ''}">${m.emoji}</span>
      <span class="mood-label">${m.label}</span>
    </button>
  `).join('');

  const addBtn = `
    <button class="mood-btn mood-btn-add" id="mood-add-btn" type="button" aria-label="Add your own emoji">
      <span class="mood-emoji">➕</span>
      <span class="mood-label">Custom</span>
    </button>
  `;

  container.innerHTML = fixedBtns + customBtns + addBtn;

  container.querySelectorAll('.mood-btn[data-mood-index]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.moodIndex);
      toggleMood(MOODS[idx]);
      btn.classList.toggle('selected');
    });
  });

  container.querySelectorAll('.mood-btn[data-custom-index]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (e.target.closest('.mood-remove')) return;
      const idx = parseInt(btn.dataset.customIndex);
      toggleMood(customMoods[idx]);
      btn.classList.toggle('selected');
    });
  });

  container.querySelectorAll('.mood-remove').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(el.dataset.removeCustom);
      const removed = customMoods[idx];
      customMoods.splice(idx, 1);
      selectedMoods = selectedMoods.filter(s => !(s.emoji === removed.emoji && s.label === removed.label));
      renderMoodGrid();
    });
  });

  const addBtnEl = document.getElementById('mood-add-btn');
  if (addBtnEl) addBtnEl.addEventListener('click', () => startCustomMoodInput());
}

const CUSTOM_MOOD_MAX = 10; // visible characters (emoji count as one)

function graphemes(str) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return [...new Intl.Segmenter().segment(str)].map(s => s.segment);
  }
  return [...str];
}

function startCustomMoodInput() {
  const addBtnEl = document.getElementById('mood-add-btn');
  if (!addBtnEl) return;
  addBtnEl.outerHTML = `
    <span class="mood-btn mood-btn-input">
      <input type="text" id="mood-custom-input" class="mood-custom-input" placeholder="emoji or word" autocomplete="off">
    </span>
  `;
  const input = document.getElementById('mood-custom-input');
  input.addEventListener('input', () => {
    const g = graphemes(input.value);
    if (g.length > CUSTOM_MOOD_MAX) input.value = g.slice(0, CUSTOM_MOOD_MAX).join('');
  });
  input.focus();
  let done = false;

  function confirm() {
    if (done) return;
    done = true;
    const val = input.value.trim();
    if (val) {
      const newMood = { emoji: val, label: 'Custom', custom: true };
      customMoods.push(newMood);
      selectedMoods.push(newMood);
    }
    renderMoodGrid();
  }

  function cancel() {
    if (done) return;
    done = true;
    renderMoodGrid();
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); confirm(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  });
  input.addEventListener('blur', confirm);
}

function renderRating() {
  const container = document.getElementById('star-rating');
  if (!container) return;

  function updateClasses(filled, hovered) {
    container.querySelectorAll('.star-btn').forEach(btn => {
      const n = parseInt(btn.dataset.val);
      btn.classList.toggle('filled',  n <= filled);
      btn.classList.toggle('hovered', n <= hovered && n > filled);
    });
    const label = document.getElementById('rating-label');
    if (label) label.textContent = filled > 0 ? filled + '/10' : '';
  }

  // Only rebuild DOM when the button count changes (i.e. first render)
  if (container.querySelectorAll('.star-btn').length !== 10) {
    container.innerHTML = Array.from({ length: 10 }, (_, i) => {
      const n = i + 1;
      return `<button type="button" class="star-btn" data-val="${n}" aria-label="Rate ${n} out of 10">★</button>`;
    }).join('') + `<span class="rating-label" id="rating-label"></span>`;

    container.querySelectorAll('.star-btn').forEach(btn => {
      const val = parseInt(btn.dataset.val);
      btn.addEventListener('click', () => {
        selectedRating = val;
        hoveredRating  = 0;
        updateClasses(selectedRating, 0);
      });
      btn.addEventListener('mouseenter', () => { hoveredRating = val; updateClasses(selectedRating, val); });
      btn.addEventListener('mouseleave', () => { hoveredRating = 0;   updateClasses(selectedRating, 0); });
    });
  }

  updateClasses(selectedRating, 0);
}

function renderMediaUpload() {
  const container = document.getElementById('media-upload');
  if (!container) return;

  container.innerHTML = `
    <div class="media-dropzone" id="media-dropzone">
      <div class="media-dropzone-icon">🌸</div>
      <div class="media-dropzone-text">Tap to add photos or videos</div>
      <div class="media-dropzone-hint">Up to 5 files • Any image or video format</div>
      <input type="file" id="media-file-input" accept="image/*,video/*" multiple style="display:none">
    </div>
    <div class="media-previews" id="media-previews"></div>
  `;

  const dropzone  = document.getElementById('media-dropzone');
  const fileInput = document.getElementById('media-file-input');

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileSelect);

  dropzone.addEventListener('dragover',  (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
  dropzone.addEventListener('dragleave', ()  => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    handleFiles(Array.from(e.dataTransfer.files));
  });

  renderMediaPreviews();
}

function handleFileSelect(e) {
  handleFiles(Array.from(e.target.files));
  e.target.value = '';
}

function handleFiles(files) {
  const remaining = 5 - mediaFiles.length;
  if (remaining <= 0) { App.showToast('Maximum 5 files reached'); return; }

  files.slice(0, remaining).forEach(file => {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      mediaFiles.push({ name: file.name, type: file.type, dataUrl: e.target.result });
      renderMediaPreviews();
    };
    reader.readAsDataURL(file);
  });
}

function renderMediaPreviews() {
  const container = document.getElementById('media-previews');
  if (!container) return;

  container.innerHTML = mediaFiles.map((f, i) => `
    <div class="media-preview-item animate-scale-in">
      ${f.type.startsWith('video/')
        ? `<video src="${f.dataUrl}" muted playsinline></video>`
        : `<img src="${f.dataUrl}" alt="${f.name}">`}
      <button class="media-remove-btn" data-index="${i}" type="button" aria-label="Remove">✕</button>
    </div>
  `).join('');

  container.querySelectorAll('.media-remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      mediaFiles.splice(parseInt(btn.dataset.index), 1);
      renderMediaPreviews();
    });
  });
}

async function loadExistingEntry() {
  const entry = await JournalDB.getEntry(currentDate);
  if (!entry) {
    updateConditionalPrompts();
    return;
  }

  // Restore session
  if (entry.session) {
    currentSession = entry.session;
    setSession(entry.session);
  }
  updateConditionalPrompts();

  // Restore moods
  const moods = entry.moods || (entry.mood ? [entry.mood] : []);
  if (moods.length) {
    selectedMoods = moods.slice();
    customMoods = moods.filter(m => !MOODS.some(fm => fm.emoji === m.emoji && fm.label === m.label));
    renderMoodGrid();
  }

  // Restore prompts
  if (entry.prompts) {
    setValue('prompt-look',      entry.prompts.lookForward);
    setValue('prompt-better',    entry.prompts.howBetter);
    setValue('prompt-gratitude-0', entry.prompts.gratitude?.[0]);
    setValue('prompt-gratitude-1', entry.prompts.gratitude?.[1]);
    setValue('prompt-gratitude-2', entry.prompts.gratitude?.[2]);
    setValue('prompt-kind',      entry.prompts.kindThing);
    setValue('prompt-letgo',     entry.prompts.letGo);
    setValue('prompt-prayer',    entry.prompts.prayer);
  }

  // Restore rating
  if (entry.rating) {
    selectedRating = entry.rating;
    renderRating();
  }

  // Restore media
  if (entry.media?.length) {
    mediaFiles = entry.media;
    renderMediaPreviews();
  }
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el && value) el.value = value;
}

function getValue(id) {
  return document.getElementById(id)?.value?.trim() || '';
}

async function saveEntry() {
  const btn = document.getElementById('save-entry-btn');
  if (btn) { btn.classList.add('saving'); btn.textContent = 'Saving...'; }

  const entry = {
    date:    currentDate,
    session: currentSession,
    moods:   selectedMoods,
    prompts: {
      lookForward: getValue('prompt-look'),
      howBetter:   getValue('prompt-better'),
      gratitude: [
        getValue('prompt-gratitude-0'),
        getValue('prompt-gratitude-1'),
        getValue('prompt-gratitude-2'),
      ],
      kindThing:   getValue('prompt-kind'),
      letGo:       getValue('prompt-letgo'),
      prayer:       getValue('prompt-prayer'),
    },
    rating: selectedRating,
    media:  mediaFiles,
  };

  try {
    await JournalDB.saveEntry(entry);
    App.showToast('Entry saved ✨');
    const msgEl = document.getElementById('save-message');
    if (msgEl) {
      msgEl.textContent = 'Saved just now';
      msgEl.className = 'entry-save-message success';
    }
  } catch (err) {
    App.showToast('Could not save — please try again');
    console.error(err);
  } finally {
    if (btn) { btn.classList.remove('saving'); btn.textContent = 'Save Entry'; }
  }
}

function attachEventListeners() {
  const saveBtn = document.getElementById('save-entry-btn');
  if (saveBtn) saveBtn.addEventListener('click', saveEntry);
}

window.EntryPage = { init, MOODS };
