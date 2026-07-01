let recapYear  = new Date().getFullYear();
let recapMonth = new Date().getMonth() + 1;
let recapLoading = false;

async function init() {
  renderHeader();
  await renderStats();
}

function setNavLoading(loading) {
  const prevBtn = document.getElementById('recap-prev-btn');
  const nextBtn = document.getElementById('recap-next-btn');
  if (prevBtn) prevBtn.disabled = loading;
  if (nextBtn) nextBtn.disabled = loading;
}

function renderHeader() {
  const titleEl = document.getElementById('recap-month-label');
  if (titleEl) titleEl.textContent = `${App.MONTHS[recapMonth - 1]} ${recapYear}`;

  const prevBtn = document.getElementById('recap-prev-btn');
  const nextBtn = document.getElementById('recap-next-btn');

  if (prevBtn) {
    prevBtn.onclick = () => {
      if (recapLoading) return;
      recapMonth--;
      if (recapMonth < 1) { recapMonth = 12; recapYear--; }
      init();
    };
  }
  if (nextBtn) {
    nextBtn.onclick = () => {
      if (recapLoading) return;
      recapMonth++;
      if (recapMonth > 12) { recapMonth = 1; recapYear++; }
      init();
    };
  }
}

async function renderStats() {
  recapLoading = true;
  setNavLoading(true);

  const [entries, saved, goalsRec] = await Promise.all([
    JournalDB.getEntriesForMonth(recapYear, recapMonth),
    JournalDB.getRecap(recapYear, recapMonth),
    JournalDB.getGoals(recapYear, recapMonth),
  ]);

  recapLoading = false;
  setNavLoading(false);

  const statsContainer = document.getElementById('recap-stats');
  const reflectionEl   = document.getElementById('recap-reflection');

  if (reflectionEl && saved?.reflection) {
    reflectionEl.value = saved.reflection;
  }

  if (!entries.length) {
    if (statsContainer) {
      statsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🌸</div>
          <div class="empty-state-title">No entries yet</div>
          <p class="empty-state-desc">Start journaling this month to see your recap here.</p>
        </div>
      `;
    }
    return;
  }

  // ── Compute stats ──
  const ratings  = entries.filter(e => e.rating > 0).map(e => e.rating);
  const avgRating = ratings.length ? (ratings.reduce((a,b) => a+b, 0) / ratings.length).toFixed(1) : '–';

  // Most used mood
  const moodCounts = {};
  entries.forEach(e => {
    const moods = e.moods || (e.mood ? [e.mood] : []);
    moods.forEach(m => {
      if (m?.emoji) {
        const key = m.emoji + '|' + m.label;
        moodCounts[key] = (moodCounts[key] || 0) + 1;
      }
    });
  });
  const topMoodKey = Object.entries(moodCounts).sort((a,b) => b[1]-a[1])[0]?.[0] || null;
  const [topMoodEmoji, topMoodLabel] = topMoodKey ? topMoodKey.split('|') : ['–', ''];

  // Goals progress
  let goalsSet = 0, goalsDone = 0;
  if (goalsRec?.data) {
    Object.values(goalsRec.data).forEach(catGoals => {
      catGoals.forEach(g => {
        if (g.text) {
          goalsSet++;
          if (g.completed) goalsDone++;
        }
      });
    });
  }

  // Gratitude highlights (unique non-empty entries)
  const allGratitude = [];
  entries.forEach(e => {
    (e.prompts?.gratitude || []).forEach(g => {
      if (g && g.trim()) allGratitude.push(g.trim());
    });
  });
  const uniqueGratitude = [...new Set(allGratitude)].slice(0, 8);

  // ── Render ──
  const starRow = avgRating === '–' ? '' : (() => {
    const filled = Math.round(parseFloat(avgRating));
    return Array.from({ length: 10 }, (_, i) =>
      `<span class="recap-star${i < filled ? ' filled' : ''}">★</span>`
    ).join('');
  })();

  if (statsContainer) {
    statsContainer.innerHTML = `
      <div class="recap-stats-grid stagger">
        <div class="recap-stat-card animate-slide-up">
          <div class="recap-stat-icon">⭐</div>
          <div class="recap-star-row">${starRow || '–'}</div>
          <div class="recap-stat-value" style="font-size:var(--fs-lg);margin-top:var(--sp-2)">${avgRating}<span style="font-size:var(--fs-xs);color:var(--color-text-light);font-weight:400"> /10</span></div>
          <div class="recap-stat-label">Average Day Rating</div>
        </div>
        <div class="recap-stat-card animate-slide-up">
          <span class="recap-mood-display">${topMoodEmoji}</span>
          <div class="recap-stat-value" style="font-size:var(--fs-lg)">${topMoodLabel || '–'}</div>
          <div class="recap-stat-label">Most Common Mood</div>
        </div>
        <div class="recap-stat-card animate-slide-up">
          <div class="recap-stat-icon">📖</div>
          <div class="recap-stat-value">${entries.length}</div>
          <div class="recap-stat-label">Days Journaled</div>
        </div>
        <div class="recap-stat-card animate-slide-up">
          <div class="recap-stat-icon">🌸</div>
          <div class="recap-stat-value">${goalsSet > 0 ? goalsDone + '/' + goalsSet : '–'}</div>
          <div class="recap-stat-label">Goals Completed</div>
        </div>
      </div>

      ${goalsSet > 0 ? `
        <div class="card card-rose mt-4 mb-4">
          <div class="card-label">Monthly Goals Progress</div>
          <div class="progress-bar mt-2">
            <div class="progress-fill" style="width:${Math.round(goalsDone/goalsSet*100)}%"></div>
          </div>
          <p class="text-muted mt-2" style="font-size:var(--fs-sm)">${goalsDone} of ${goalsSet} goals completed — ${Math.round(goalsDone/goalsSet*100)}%</p>
        </div>
      ` : ''}

      ${uniqueGratitude.length ? `
        <div class="card mt-4">
          <div class="card-label">Things You Were Grateful For</div>
          <div class="recap-gratitude-list">
            ${uniqueGratitude.map(g => `<div class="recap-gratitude-item">${g}</div>`).join('')}
          </div>
        </div>
      ` : ''}
    `;
  }
}

async function saveReflection() {
  const textarea = document.getElementById('recap-reflection');
  if (!textarea) return;

  try {
    await JournalDB.saveRecap(recapYear, recapMonth, textarea.value.trim());
    App.showToast('Reflection saved ✨');
  } catch {
    App.showToast('Could not save reflection');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.getElementById('recap-save-btn');
  if (saveBtn) saveBtn.addEventListener('click', saveReflection);
});

window.RecapPage = { init };
