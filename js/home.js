/*
  Home dashboard — greeting by time of day, today's verse, streak widgets,
  and a 7-day strip showing which days have entries. Everything renders
  from local data, so it opens instantly.
*/
(function () {

  function greetingForHour(h) {
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
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

  function renderGreeting() {
    const now = new Date();
    const greetEl = document.getElementById('home-greeting');
    const dateEl  = document.getElementById('home-date');
    if (greetEl) greetEl.textContent = greetingForHour(now.getHours());
    if (dateEl)  dateEl.textContent  = App.formatDate(now);
  }

  function renderScripture() {
    const container = document.getElementById('home-scripture');
    const scripture = Scripture.getDailyScripture();
    if (!container || !scripture) return;
    container.innerHTML = `
      <div class="scripture-card">
        <div class="scripture-icon">✦</div>
        <p class="scripture-text">"${scripture.text}"</p>
        <span class="scripture-reference">${scripture.reference}</span>
      </div>
    `;
  }

  function renderWidgets(entries) {
    const container = document.getElementById('home-widgets');
    if (!container) return;
    const streak = calcStreak(entries);
    const total  = entries.length;
    const lastMood = [...entries]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(e => (e.moods || (e.mood ? [e.mood] : []))[0])
      .find(Boolean);

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
        <div class="widget-icon" style="font-size:1.8rem">${lastMood?.emoji || '✨'}</div>
        <div class="widget-label" style="margin-top:4px">last mood</div>
      </div>
    `;
  }

  function renderWeekStrip(entries) {
    const container = document.getElementById('home-week-strip');
    if (!container) return;
    const have = new Set(entries.map(e => e.date));
    const todayKey = App.todayKey();

    const cells = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = App.dateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
      const isToday = key === todayKey;
      const written = have.has(key);
      cells.push(`
        <button type="button" class="home-week-day ${isToday ? 'today' : ''} ${written ? 'written' : ''}"
          data-date="${key}" aria-label="${key}${written ? ' — entry written' : ''}">
          <span class="home-week-dayname">${App.DAYS[d.getDay()].slice(0, 1)}</span>
          <span class="home-week-dot">${written ? '✿' : ''}</span>
          <span class="home-week-num">${d.getDate()}</span>
        </button>
      `);
    }
    container.innerHTML = cells.join('');

    container.querySelectorAll('.home-week-day').forEach(btn => {
      btn.addEventListener('click', () => {
        window._entryDateOverride = btn.dataset.date === todayKey ? null : btn.dataset.date;
        Router.navigate('#today');
      });
    });
  }

  async function init() {
    renderGreeting();
    renderScripture();
    let entries = [];
    try { entries = await JournalDB.getAllEntries(); } catch { /* fresh install */ }
    renderWidgets(entries);
    renderWeekStrip(entries);
  }

  window.HomePage = { init };
})();
