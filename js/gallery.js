let allMedia = [];
let activeFilter = 'all';

async function init() {
  await loadAllMedia();
  renderFilters();
  renderGallery();
}

async function loadAllMedia() {
  const entries = await JournalDB.getAllEntries();
  allMedia = [];
  entries.forEach(entry => {
    if (entry.media?.length) {
      entry.media.forEach(m => {
        const moods = entry.moods || (entry.mood ? [entry.mood] : []);
        allMedia.push({
          ...m,
          date: entry.date,
          mood: moods[0] || null,
        });
      });
    }
  });
  // Sort newest first
  allMedia.sort((a, b) => b.date.localeCompare(a.date));
}

function getMonthKeys() {
  const seen = new Set();
  allMedia.forEach(m => {
    const [y, mo] = m.date.split('-');
    seen.add(`${y}-${mo}`);
  });
  return [...seen].sort().reverse();
}

function renderFilters() {
  const container = document.getElementById('gallery-filters');
  if (!container) return;

  const months = getMonthKeys();
  if (!months.length) { container.innerHTML = ''; return; }

  container.innerHTML = [
    `<button class="gallery-filter-btn ${activeFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>`,
    ...months.map(key => {
      const [y, m] = key.split('-');
      const label = `${App.MONTHS_SHORT[parseInt(m) - 1]} ${y}`;
      return `<button class="gallery-filter-btn ${activeFilter === key ? 'active' : ''}" data-filter="${key}">${label}</button>`;
    })
  ].join('');

  container.querySelectorAll('.gallery-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      container.querySelectorAll('.gallery-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderGallery();
    });
  });
}

function renderGallery() {
  const container = document.getElementById('gallery-grid');
  if (!container) return;

  const filtered = activeFilter === 'all'
    ? allMedia
    : allMedia.filter(m => {
        const [y, mo] = m.date.split('-');
        return `${y}-${mo}` === activeFilter;
      });

  if (!filtered.length) {
    container.innerHTML = `
      <div class="gallery-empty">
        <div class="gallery-empty-icon">🖼️</div>
        <p class="text-muted">No photos or videos yet.<br>Add media to your journal entries to see them here.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map((m, i) => {
    const d = App.parseDateKey(m.date);
    const dateLabel = App.formatDateFull(d);
    return `
      <div class="gallery-item animate-fade-in" data-index="${i}" style="animation-delay:${i * 0.04}s">
        ${m.type.startsWith('video/')
          ? `<video src="${m.dataUrl}" muted playsinline></video>`
          : `<img src="${m.dataUrl}" alt="Photo from ${dateLabel}" loading="lazy">`}
        <div class="gallery-item-overlay">
          <span class="gallery-item-date">${dateLabel}${m.mood ? ' · ' + m.mood.emoji : ''}</span>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.gallery-item').forEach((item, i) => {
    item.addEventListener('click', () => openLightbox(filtered[i]));
  });
}

function openLightbox(media) {
  const existing = document.getElementById('lightbox-overlay');
  if (existing) existing.remove();

  const d = App.parseDateKey(media.date);
  const overlay = document.createElement('div');
  overlay.id = 'lightbox-overlay';
  overlay.className = 'lightbox-overlay';
  overlay.innerHTML = `
    <div class="lightbox-content">
      <button class="lightbox-close" aria-label="Close">✕</button>
      ${media.type.startsWith('video/')
        ? `<video src="${media.dataUrl}" controls autoplay muted style="max-width:90vw;max-height:80vh;border-radius:var(--radius-md)"></video>`
        : `<img src="${media.dataUrl}" alt="Journal photo" style="max-width:90vw;max-height:80vh;border-radius:var(--radius-md)">`}
      <div class="lightbox-caption">${App.formatDateFull(d)}${media.mood ? ' — ' + media.mood.emoji + ' ' + media.mood.label : ''}</div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('.lightbox-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); }
  });
}

window.GalleryPage = { init };
