(function () {

const DEFAULT_CATEGORIES = [
  { key: 'cat1', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8L12 4Z"/></svg>', color: '#f3e7e4' },
  { key: 'cat2', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 12h4l2-5 4.5 10 2-5h4.5"/></svg>', color: '#edf0e9' },
  { key: 'cat3', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19s-6.7-4.3-8.4-8.1A4.7 4.7 0 0 1 12 7.2a4.7 4.7 0 0 1 8.4 3.7C18.7 14.7 12 19 12 19Z"/></svg>', color: '#f5efdf' },
  { key: 'cat4', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 6c-2-1.6-4.5-1.9-7-1.5V19c2.5-.4 5-.1 7 1.5 2-1.6 4.5-1.9 7-1.5V4.5C16.5 4.1 14 4.4 12 6Z"/><path d="M12 6v14.5"/></svg>', color: '#e9eef4' },
  { key: 'cat5', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="7.5" rx="7" ry="3"/><path d="M5 7.5v9c0 1.7 3.1 3 7 3s7-1.3 7-3v-9"/><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/></svg>', color: '#efe9f4' },
];

const DEFAULT_NAMES = {
  cat1: 'Personal',
  cat2: 'Health & Wellness',
  cat3: 'Relationships',
  cat4: 'Growth & Learning',
  cat5: 'Finances',
};

let goalsYear  = new Date().getFullYear();
let goalsMonth = new Date().getMonth() + 1;
let goalsData  = {};
let categoryNames = { ...DEFAULT_NAMES };

async function init() {
  renderHeader();
  await loadGoals();
  renderCategories();
}

function renderHeader() {
  const monthName = App.MONTHS[goalsMonth - 1];
  const titleEl = document.getElementById('goals-month-label');
  if (titleEl) {
    titleEl.innerHTML = `<span class="goals-month-name">${monthName}</span><span class="goals-month-year">${goalsYear}</span>`;
  }

  const prevBtn = document.getElementById('goals-prev-btn');
  const nextBtn = document.getElementById('goals-next-btn');

  if (prevBtn) {
    prevBtn.onclick = () => {
      goalsMonth--;
      if (goalsMonth < 1) { goalsMonth = 12; goalsYear--; }
      reinit();
    };
  }
  if (nextBtn) {
    nextBtn.onclick = () => {
      goalsMonth++;
      if (goalsMonth > 12) { goalsMonth = 1; goalsYear++; }
      reinit();
    };
  }
}

async function reinit() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  renderHeader();
  await loadGoals();
  renderCategories();
}

async function loadGoals() {
  let saved = null;
  try {
    saved = await JournalDB.getGoals(goalsYear, goalsMonth);
  } catch (e) {
    console.error('Goals load failed:', e);
  }
  if (saved?.data) {
    goalsData = saved.data;
    categoryNames = saved.categoryNames ? { ...DEFAULT_NAMES, ...saved.categoryNames } : { ...DEFAULT_NAMES };
  } else {
    goalsData = {};
    categoryNames = { ...DEFAULT_NAMES };
  }
  // Every category starts with at least one row
  DEFAULT_CATEGORIES.forEach(cat => {
    if (!Array.isArray(goalsData[cat.key]) || goalsData[cat.key].length === 0) {
      goalsData[cat.key] = [
        { text: '', completed: false },
        { text: '', completed: false },
        { text: '', completed: false },
      ];
    }
  });
}

function renderCategories() {
  const container = document.getElementById('goals-categories');
  if (!container) return;

  container.innerHTML = DEFAULT_CATEGORIES.map(cat => {
    const goals     = goalsData[cat.key] || [];
    const completed = goals.filter(g => g.completed && g.text).length;
    const total     = goals.filter(g => g.text).length;
    const name      = categoryNames[cat.key] || DEFAULT_NAMES[cat.key];

    return `
      <div class="goal-category-card" data-cat="${cat.key}">
        <div class="goal-category-header">
          <div class="goal-category-icon" style="background:${cat.color}">${cat.icon}</div>
          <div style="flex:1">
            <input type="text"
              class="goal-category-name-input"
              id="goal-cat-name-${cat.key}"
              value="${escapeAttr(name)}"
              placeholder="Category name..."
              data-cat="${cat.key}">
          </div>
          <div class="goal-category-progress" id="goal-prog-${cat.key}">${total > 0 ? `${completed}/${total} done` : ''}</div>
        </div>
        ${goals.map((goal, i) => `
          <div class="goal-input-row">
            <input type="checkbox" class="checkbox-input" id="goal-check-${cat.key}-${i}"
              ${goal.completed ? 'checked' : ''}
              data-cat="${cat.key}" data-idx="${i}">
            <input type="text" class="input goal-input"
              id="goal-text-${cat.key}-${i}"
              placeholder="Add a goal..."
              value="${escapeAttr(goal.text || '')}"
              data-cat="${cat.key}" data-idx="${i}">
            <button type="button" class="goal-remove-btn" data-cat="${cat.key}" data-idx="${i}"
              aria-label="Remove this goal" title="Remove this goal">✕</button>
          </div>
        `).join('')}
        <button type="button" class="goal-add-btn" data-cat="${cat.key}">＋ Add another goal</button>
      </div>
    `;
  }).join('');

  // Category name listeners
  container.querySelectorAll('.goal-category-name-input').forEach(input => {
    input.addEventListener('input', () => {
      categoryNames[input.dataset.cat] = input.value.trim() || DEFAULT_NAMES[input.dataset.cat];
      saveGoals();
    });
  });

  // Goal checkbox + text listeners
  container.querySelectorAll('.checkbox-input').forEach(cb => {
    cb.addEventListener('change', () => handleGoalChange(cb.dataset.cat, parseInt(cb.dataset.idx)));
  });
  container.querySelectorAll('.goal-input').forEach(input => {
    input.addEventListener('input',  () => scheduleGoalSave(input.dataset.cat, parseInt(input.dataset.idx)));
    input.addEventListener('change', () => handleGoalChange(input.dataset.cat, parseInt(input.dataset.idx)));
  });

  // Add another goal row
  container.querySelectorAll('.goal-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      if (!goalsData[cat]) goalsData[cat] = [];
      goalsData[cat].push({ text: '', completed: false });
      renderCategories();
      document.getElementById(`goal-text-${cat}-${goalsData[cat].length - 1}`)?.focus();
      saveGoals();
    });
  });

  // Remove a goal row
  container.querySelectorAll('.goal-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      const idx = parseInt(btn.dataset.idx);
      if (!goalsData[cat]) return;
      goalsData[cat].splice(idx, 1);
      if (goalsData[cat].length === 0) goalsData[cat] = [{ text: '', completed: false }];
      renderCategories();
      saveGoals();
    });
  });
}

function handleGoalChange(catKey, idx) {
  const textInput = document.getElementById(`goal-text-${catKey}-${idx}`);
  const checkbox  = document.getElementById(`goal-check-${catKey}-${idx}`);
  if (!goalsData[catKey]) return;

  goalsData[catKey][idx] = {
    text:      textInput?.value?.trim() || '',
    completed: checkbox?.checked || false,
  };

  const goals     = goalsData[catKey];
  const completed = goals.filter(g => g.completed && g.text).length;
  const total     = goals.filter(g => g.text).length;
  const progEl    = document.getElementById(`goal-prog-${catKey}`);
  if (progEl) progEl.textContent = total > 0 ? `${completed}/${total} done` : '';

  saveGoals();
}

let saveGoalsTimer = null;
let _goalsCloudErrorShown = false;
function scheduleGoalSave(catKey, idx) {
  handleGoalChange(catKey, idx);
  clearTimeout(saveGoalsTimer);
  saveGoalsTimer = setTimeout(saveGoals, 1500);
}

async function saveGoals() {
  DEFAULT_CATEGORIES.forEach(cat => {
    const goals = goalsData[cat.key] || [];
    goals.forEach((_, i) => {
      const textInput = document.getElementById(`goal-text-${cat.key}-${i}`);
      const checkbox  = document.getElementById(`goal-check-${cat.key}-${i}`);
      if (textInput) {
        goalsData[cat.key][i] = {
          text:      textInput.value.trim() || '',
          completed: checkbox?.checked || false,
        };
      }
    });
  });

  try {
    const result = await JournalDB.saveGoals(goalsYear, goalsMonth, goalsData, categoryNames);
    if (result?.cloudError && !_goalsCloudErrorShown) {
      _goalsCloudErrorShown = true;
      App.showToast(`Saved on this device only — cloud sync failed (${result.cloudError})`, 5000);
      console.error('Cloud save error:', result.cloudError);
    } else if (!result?.cloudError) {
      _goalsCloudErrorShown = false;
    }
  } catch (err) {
    if (err?.viewOnlyBlocked) {
      App.showToast('Sign in to save your journal ✨');
    } else {
      console.error('Failed to save goals:', err);
    }
  }
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.GoalsPage = { init };

})();
