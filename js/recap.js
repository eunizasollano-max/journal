(function () {

let recapYear  = new Date().getFullYear();
let recapMonth = new Date().getMonth() + 1;

async function init() {
  renderHeader();
  await renderStats();
}

function renderHeader() {
  const monthName = App.MONTHS[recapMonth - 1];
  const titleEl = document.getElementById('recap-month-label');
  if (titleEl) {
    titleEl.innerHTML = `<span class="recap-month-name">${monthName}</span><span class="recap-month-year">${recapYear}</span>`;
  }

  const prevBtn = document.getElementById('recap-prev-btn');
  const nextBtn = document.getElementById('recap-next-btn');

  if (prevBtn) {
    prevBtn.disabled = false;
    prevBtn.onclick = () => {
      recapMonth--;
      if (recapMonth < 1) { recapMonth = 12; recapYear--; }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      init();
    };
  }
  if (nextBtn) {
    nextBtn.disabled = false;
    nextBtn.onclick = () => {
      recapMonth++;
      if (recapMonth > 12) { recapMonth = 1; recapYear++; }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      init();
    };
  }
}

async function renderStats() {
  // A failed load must never block the page — render whatever we have
  let entries = [], saved = null, goalsRec = null;
  try {
    [entries, saved, goalsRec] = await Promise.all([
      JournalDB.getEntriesForMonth(recapYear, recapMonth),
      JournalDB.getRecap(recapYear, recapMonth),
      JournalDB.getGoals(recapYear, recapMonth),
    ]);
  } catch (e) {
    console.error('Recap load failed:', e);
  }

  const statsContainer = document.getElementById('recap-stats');
  const reflectionEl   = document.getElementById('recap-reflection');

  if (reflectionEl) {
    reflectionEl.value = saved?.reflection || '';
  }

  if (!entries.length) {
    if (statsContainer) {
      statsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon"><svg viewBox="0 0 120 112" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g stroke="var(--color-accent-sage)" stroke-width="2" stroke-linecap="round"><path d="M60 104C60 78 59 64 60 52"/><path d="M60 80C48 76 40 68 38 58"/><path d="M60 90C72 87 80 80 83 70"/></g><g stroke="var(--color-accent-deep)" stroke-width="2" stroke-linejoin="round"><ellipse cx="60" cy="22" rx="10" ry="16"/><ellipse cx="60" cy="22" rx="10" ry="16" transform="rotate(72 60 38)"/><ellipse cx="60" cy="22" rx="10" ry="16" transform="rotate(144 60 38)"/><ellipse cx="60" cy="22" rx="10" ry="16" transform="rotate(216 60 38)"/><ellipse cx="60" cy="22" rx="10" ry="16" transform="rotate(288 60 38)"/></g><circle cx="60" cy="38" r="4" fill="var(--color-star-fill)"/></svg></div>
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
          <div class="recap-stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4l2.4 5 5.6.7-4.1 3.8 1.1 5.5L12 16.4 7 19l1.1-5.5L4 9.7 9.6 9 12 4Z"/></svg></div>
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
          <div class="recap-stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 6c-2-1.6-4.5-1.9-7-1.5V19c2.5-.4 5-.1 7 1.5 2-1.6 4.5-1.9 7-1.5V4.5C16.5 4.1 14 4.4 12 6Z"/><path d="M12 6v14.5"/></svg></div>
          <div class="recap-stat-value">${entries.length}</div>
          <div class="recap-stat-label">Days Journaled</div>
        </div>
        <div class="recap-stat-card animate-slide-up">
          <div class="recap-stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.5l2.5 2.5 4.5-5.5"/></svg></div>
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
    const result = await JournalDB.saveRecap(recapYear, recapMonth, textarea.value.trim());
    if (result?.cloudError) {
      App.showToast(`Saved on this device only — cloud sync failed (${result.cloudError})`, 5000);
      console.error('Cloud save error:', result.cloudError);
    } else {
      App.showToast('Reflection saved ✨');
    }
  } catch (err) {
    App.showToast(err?.viewOnlyBlocked ? 'Sign in to save your journal ✨' : 'Could not save reflection');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.getElementById('recap-save-btn');
  if (saveBtn) saveBtn.addEventListener('click', saveReflection);
});

window.RecapPage = { init };

})();
