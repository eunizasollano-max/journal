const DEFAULT_CATEGORIES = [
  { key: 'cat1', icon: '💫', color: '#fde8e8' },
  { key: 'cat2', icon: '💪', color: '#e8f5e8' },
  { key: 'cat3', icon: '💛', color: '#fff8e8' },
  { key: 'cat4', icon: '📚', color: '#e8f0f8' },
  { key: 'cat5', icon: '✨', color: '#f0e8f8' },
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
  const titleEl = document.getElementById('goals-month-label');
  if (titleEl) titleEl.textContent = `${App.MONTHS[goalsMonth - 1]} ${goalsYear}`;

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
  renderHeader();
  await loadGoals();
  renderCategories();
}

async function loadGoals() {
  const saved = await JournalDB.getGoals(goalsYear, goalsMonth);
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
    await JournalDB.saveGoals(goalsYear, goalsMonth, goalsData, categoryNames);
  } catch (err) {
    console.error('Failed to save goals:', err);
  }
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.GoalsPage = { init };
