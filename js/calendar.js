(function () {

let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth() + 1;
let allEntries = {};

async function init() {
  const entries = await JournalDB.getAllEntries();
  allEntries = {};
  entries.forEach(e => { allEntries[e.date] = e; });
  renderCalendar();
}

function renderCalendar() {
  renderHeader();
  renderGrid();
}

function renderHeader() {
  const monthEl = document.getElementById('cal-month-label');
  const yearEl  = document.getElementById('cal-year-label');
  if (monthEl) monthEl.textContent = App.MONTHS[calMonth - 1];
  if (yearEl)  yearEl.textContent  = calYear;
}

function renderGrid() {
  const container = document.getElementById('calendar-grid');
  if (!container) return;

  const today = App.todayKey();
  const firstDay = new Date(calYear, calMonth - 1, 1).getDay();
  const totalDays = App.daysInMonth(calYear, calMonth);

  // Fill grid: start from the first weekday of the month
  const cells = [];

  // Previous month padding
  const prevMonthDays = App.daysInMonth(calYear, calMonth === 1 ? 12 : calMonth - 1);
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, isOtherMonth: true });
  }

  // Current month days
  for (let d = 1; d <= totalDays; d++) {
    cells.push({ day: d, isOtherMonth: false });
  }

  // Fill remainder of last row
  const remainder = cells.length % 7;
  if (remainder > 0) {
    for (let d = 1; d <= 7 - remainder; d++) {
      cells.push({ day: d, isOtherMonth: true });
    }
  }

  container.innerHTML = cells.map(cell => {
    if (cell.isOtherMonth) {
      return `<div class="cal-day other-month"><span class="cal-day-num">${cell.day}</span></div>`;
    }

    const key     = App.dateKey(calYear, calMonth, cell.day);
    const entry   = allEntries[key];
    const isToday = key === today;
    const hasMedia = entry?.media?.length > 0;
    const dayMoods = entry?.moods || (entry?.mood ? [entry.mood] : []);

    return `
      <div class="cal-day ${isToday ? 'today' : ''} ${entry ? 'has-entry' : ''}"
           data-date="${key}" role="button" tabindex="0" aria-label="${key}">
        <span class="cal-day-num">${cell.day}</span>
        ${dayMoods.length ? `<span class="cal-day-mood">${dayMoods.map(m => m.emoji).join('')}</span>` : ''}
        ${entry?.rating ? `<div class="cal-day-dots">${ratingDots(entry.rating)}</div>` : ''}
        ${hasMedia ? `<span style="font-size:0.55rem;opacity:0.6;">🖼</span>` : ''}
      </div>
    `;
  }).join('');

  container.querySelectorAll('.cal-day:not(.other-month)').forEach(cell => {
    cell.addEventListener('click', () => showEntryPreview(cell.dataset.date));
    cell.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') showEntryPreview(cell.dataset.date);
    });
  });
}

function ratingDots(rating) {
  const filled = Math.round(rating / 2);
  return Array.from({ length: 5 }, (_, i) =>
    `<span class="cal-dot" style="opacity:${i < filled ? '0.8' : '0.2'}"></span>`
  ).join('');
}

function showEntryPreview(dateKey) {
  const panel   = document.getElementById('entry-preview-panel');
  const entry   = allEntries[dateKey];
  if (!panel) return;

  const d = App.parseDateKey(dateKey);
  const btnLabel = entry ? '✏️ Edit Entry' : '✏️ Write Entry';

  function openEntry() {
    window._entryDateOverride = dateKey;
    window.location.hash = '#today';
    closePreview();
  }

  if (!entry) {
    panel.innerHTML = `
      <div class="entry-preview-date">${App.formatDateFull(d)}</div>
      <p class="text-muted" style="text-align:center;padding:var(--sp-4)">No entry for this day yet.</p>
      <button class="btn btn-primary" id="preview-open-btn" style="width:100%;margin-top:var(--sp-2)">${btnLabel}</button>
    `;
    panel.classList.add('open');
    panel.querySelector('#preview-open-btn').addEventListener('click', openEntry);
    return;
  }

  const gratitude = (entry.prompts?.gratitude || []).filter(Boolean);
  const previewMoods = entry.moods || (entry.mood ? [entry.mood] : []);

  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-3)">
      <div class="entry-preview-date">${App.formatDateFull(d)}</div>
      <div style="display:flex;gap:var(--sp-2);align-items:center">
        ${previewMoods.length ? `<span style="font-size:1.4rem">${previewMoods.map(m => m.emoji).join(' ')}</span><span class="text-muted">${previewMoods.map(m => m.label).join(', ')}</span>` : ''}
        ${entry.rating ? `<span class="badge badge-rose">${entry.rating}/10</span>` : ''}
      </div>
    </div>
    ${entry.prompts?.lookForward ? `<p class="text-muted" style="font-size:var(--fs-sm);margin-bottom:var(--sp-2)"><strong>${entry.session === 'morning' ? 'Looking forward to' : 'How it went'}:</strong> ${entry.prompts.lookForward}</p>` : ''}
    ${gratitude.length ? `
      <div style="margin-bottom:var(--sp-3)">
        <strong style="font-size:var(--fs-sm);color:var(--color-text-heading)">Grateful for:</strong>
        ${gratitude.map(g => `<div style="font-size:var(--fs-sm);color:var(--color-text-muted);margin-top:4px">✿ ${g}</div>`).join('')}
      </div>
    ` : ''}
    ${entry.freeWrite?.content ? `<p class="text-muted" style="font-size:var(--fs-sm);font-style:italic;border-left:2px solid var(--color-border);padding-left:var(--sp-3);">${entry.freeWrite.content.slice(0, 200)}${entry.freeWrite.content.length > 200 ? '…' : ''}</p>` : ''}
    ${entry.media?.length ? `<div class="media-previews" style="margin-top:var(--sp-3)">${entry.media.map(m => `<div class="media-preview-item">${m.type.startsWith('video/') ? `<video src="${m.dataUrl}" muted></video>` : `<img src="${m.dataUrl}" alt="">`}</div>`).join('')}</div>` : ''}
    <button class="btn btn-primary" id="preview-open-btn" style="width:100%;margin-top:var(--sp-4)">${btnLabel}</button>
  `;

  panel.classList.add('open');
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  panel.querySelector('#preview-open-btn').addEventListener('click', openEntry);
}

function prevMonth() {
  calMonth--;
  if (calMonth < 1) { calMonth = 12; calYear--; }
  renderCalendar();
  closePreview();
}

function nextMonth() {
  calMonth++;
  if (calMonth > 12) { calMonth = 1; calYear++; }
  renderCalendar();
  closePreview();
}

function closePreview() {
  const panel = document.getElementById('entry-preview-panel');
  if (panel) panel.classList.remove('open');
}

// Wire up nav buttons from HTML
document.addEventListener('DOMContentLoaded', () => {
  const prevBtn = document.getElementById('cal-prev-btn');
  const nextBtn = document.getElementById('cal-next-btn');
  if (prevBtn) prevBtn.addEventListener('click', prevMonth);
  if (nextBtn) nextBtn.addEventListener('click', nextMonth);
});

window.CalendarPage = { init };

})();
