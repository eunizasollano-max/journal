/* ── Date utilities ── */
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function dateKey(year, month, day) {
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(date) {
  return `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

function formatDateFull(date) {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function isFirstDayOfMonth(date = new Date()) {
  return date.getDate() === 1;
}

function isLastDayOfMonth(date = new Date()) {
  const d = new Date(date);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return d.getDate() === lastDay;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function showToast(message, duration = 2500) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
}

/* ── Theme management ── */
const THEMES = [
  { key: 'blush',    label: 'Blush',    dot: '#f0c4c4' },
  { key: 'lavender', label: 'Lavender', dot: '#c4b8e8' },
  { key: 'mint',     label: 'Mint',     dot: '#a8d8b8' },
  { key: 'peach',    label: 'Peach',    dot: '#e8c098' },
  { key: 'sky',      label: 'Sky',      dot: '#a8c4e8' },
  { key: 'midnight', label: 'Midnight', dot: '#2a1545' },
];

function initTheme() {
  const saved = localStorage.getItem('journal_theme') || 'blush';
  applyTheme(saved);
}

function applyTheme(key) {
  document.documentElement.dataset.theme = key;
  localStorage.setItem('journal_theme', key);
  document.querySelectorAll('.theme-swatch-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === key);
  });
}

function initThemePicker() {
  const toggleBtn = document.getElementById('theme-toggle-btn');
  const picker    = document.getElementById('theme-picker');
  if (!toggleBtn || !picker) return;

  // Populate swatches
  const container = picker.querySelector('.theme-swatches');
  if (container) {
    const current = localStorage.getItem('journal_theme') || 'blush';
    container.innerHTML = THEMES.map(t => `
      <button class="theme-swatch-btn ${t.key === current ? 'active' : ''}" data-theme="${t.key}" type="button">
        <span class="theme-swatch-dot" style="background:${t.dot}"></span>
        <span class="theme-swatch-label">${t.label}</span>
      </button>
    `).join('');

    container.querySelectorAll('.theme-swatch-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        applyTheme(btn.dataset.theme);
      });
    });
  }

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    picker.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!picker.contains(e.target) && e.target !== toggleBtn) {
      picker.classList.remove('open');
    }
  });
}

/* ── Cursor glow ── */
function initCursorGlow() {
  const glow = document.createElement('div');
  glow.id = 'cursor-glow';
  document.body.appendChild(glow);

  document.addEventListener('mousemove', (e) => {
    glow.style.left = e.clientX + 'px';
    glow.style.top  = e.clientY + 'px';
    glow.style.opacity = '1';
  });

  document.addEventListener('mouseleave', () => {
    glow.style.opacity = '0';
  });
}

/* ── Font picker ── */
const ANSWER_FONTS = [
  { key: 'nunito',    label: 'Nunito',             family: "'Nunito', sans-serif",         sample: 'Dear journal...' },
  { key: 'lora',      label: 'Lora',               family: "'Lora', serif",                sample: 'Dear journal...' },
  { key: 'cormorant', label: 'Cormorant Garamond', family: "'Cormorant Garamond', serif",  sample: 'Dear journal...' },
  { key: 'quicksand', label: 'Quicksand',           family: "'Quicksand', sans-serif",     sample: 'Dear journal...' },
  { key: 'josefin',   label: 'Josefin Sans',        family: "'Josefin Sans', sans-serif",  sample: 'Dear journal...' },
  { key: 'dancing',   label: 'Cursive',             family: "'Dancing Script', cursive",   sample: 'Dear journal...' },
];

function applyAnswerFont(key) {
  const font = ANSWER_FONTS.find(f => f.key === key) || ANSWER_FONTS[0];
  document.documentElement.style.setProperty('--font-answer', font.family);
  localStorage.setItem('journal_answer_font', key);
  document.querySelectorAll('.font-option-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.font === key);
  });
}

function initFontPicker() {
  const toggleBtn = document.getElementById('font-toggle-btn');
  const picker    = document.getElementById('font-picker');
  if (!toggleBtn || !picker) return;

  const saved = localStorage.getItem('journal_answer_font') || 'nunito';
  applyAnswerFont(saved);

  const container = picker.querySelector('.font-options');
  if (container) {
    container.innerHTML = ANSWER_FONTS.map(f => `
      <button class="font-option-btn ${f.key === saved ? 'active' : ''}" data-font="${f.key}" type="button">
        <span class="font-option-sample" style="font-family:${f.family}">${f.sample}</span>
        <span class="font-option-label">${f.label}</span>
      </button>
    `).join('');

    container.querySelectorAll('.font-option-btn').forEach(btn => {
      btn.addEventListener('click', () => applyAnswerFont(btn.dataset.font));
    });
  }

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    picker.classList.toggle('open');
    document.getElementById('theme-picker')?.classList.remove('open');
  });

  document.addEventListener('click', (e) => {
    if (!picker.contains(e.target) && e.target !== toggleBtn) {
      picker.classList.remove('open');
    }
  });
}

/* ── Onboarding (nickname, shown after first login) ── */
function initOnboarding() {
  const displayName = Auth.getUserDisplayName?.();
  if (displayName) { applyUserName(displayName); return; }

  const name = localStorage.getItem('journal_user_name');
  if (name) { applyUserName(name); return; }

  const overlay = document.getElementById('onboarding-overlay');
  if (overlay) overlay.classList.remove('hidden');

  // Step 1 → Step 2
  const form = document.getElementById('onboarding-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('onboarding-name');
      const n = (input?.value || '').trim() || 'My love';
      localStorage.setItem('journal_user_name', n);
      applyUserName(n);
      // Transition to guide step
      document.getElementById('onboard-step-1').classList.add('hidden');
      document.getElementById('onboard-step-2').classList.remove('hidden');
    });
  }

  // Step 2: mode selection
  let chosenMode = null;
  document.querySelectorAll('.onboard-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.onboard-mode-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      chosenMode = btn.dataset.mode;
      document.getElementById('onboard-begin-btn').disabled = false;
    });
  });

  // Step 2: begin
  const beginBtn = document.getElementById('onboard-begin-btn');
  if (beginBtn) {
    beginBtn.addEventListener('click', () => {
      if (chosenMode) localStorage.setItem('journal_session', chosenMode);
      overlay.style.animation = 'fadeOut 0.3s ease forwards';
      setTimeout(() => overlay.classList.add('hidden'), 300);
    });
  }
}

function applyUserName(name) {
  document.querySelectorAll('.js-user-name').forEach(el => {
    el.textContent = name;
  });
  const brandUser = document.querySelector('.brand-user');
  if (brandUser) brandUser.textContent = name + "'s Journal";
}

/* ── Auth state UI ── */
function updateAuthUI(user) {
  const signOutBtn = document.getElementById('signout-btn');
  const authStatus = document.getElementById('auth-status');
  const userAvatar = document.getElementById('user-avatar');

  if (user) {
    const name  = Auth.getUserDisplayName?.() || user.email || 'Friend';
    const photo = Auth.getUserPhotoURL?.();
    if (authStatus) authStatus.textContent = name;
    if (userAvatar) {
      if (photo) {
        userAvatar.innerHTML = `<img src="${photo}" alt="${name}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">`;
      } else {
        userAvatar.innerHTML = `<div style="width:28px;height:28px;border-radius:50%;background:var(--color-accent-rose);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700;">${name[0].toUpperCase()}</div>`;
      }
    }
    if (signOutBtn) signOutBtn.style.display = '';
  } else {
    if (authStatus) authStatus.textContent = 'Not signed in';
    if (userAvatar) userAvatar.innerHTML = '';
    if (signOutBtn) signOutBtn.style.display = 'none';
  }
}

function wireSignOutButton() {
  const btn = document.getElementById('signout-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (confirm('Sign out? Your local entries will remain on this device.')) {
      await Auth.signOut?.();
    }
  });
}

/* ── Sidebar date ── */
function updateSidebarDate() {
  const el = document.querySelector('.footer-date');
  if (!el) return;
  const d = new Date();
  el.textContent = formatDate(d);
}

/* ── Passphrase modal (Google users + returning email users with no session key) ── */
async function ensureCryptoKey(user) {
  if (JournalCrypto.getCryptoKey()) return;
  if (await JournalCrypto.restoreKeyFromSession()) return;
  return new Promise((resolve) => showPassphraseModal(user, resolve));
}

async function showPassphraseModal(user, onComplete) {
  const isEmailUser  = user.app_metadata?.provider === 'email';
  const isFirstTime  = !(await JournalCrypto.hasUserKey(user.id));

  const title    = isFirstTime ? 'Protect your journal' : 'Unlock your journal';
  const subtitle = isFirstTime
    ? (isEmailUser ? 'Your entries will be encrypted with your account password — only you can read them.' : 'Create a passphrase to encrypt your journal. Only you will be able to read it.')
    : (isEmailUser ? 'Enter your account password to unlock your journal.' : 'Enter your journal passphrase to continue.');
  const placeholder = isEmailUser ? 'Your account password' : (isFirstTime ? 'Create a passphrase' : 'Your passphrase');
  const btnLabel = isFirstTime ? 'Set encryption & continue' : 'Unlock';

  const overlay = document.createElement('div');
  overlay.id = 'passphrase-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:360px;text-align:center">
      <div style="font-size:2rem;margin-bottom:var(--sp-3)">🔒</div>
      <h2 class="modal-title">${title}</h2>
      <p class="modal-desc" style="margin-bottom:var(--sp-4)">${subtitle}</p>
      <input type="password" id="pp-input" class="input" placeholder="${placeholder}"
        style="margin-bottom:var(--sp-3)" autocomplete="${isFirstTime ? 'new-password' : 'current-password'}">
      ${isFirstTime && !isEmailUser ? `<input type="password" id="pp-confirm" class="input" placeholder="Confirm passphrase"
        style="margin-bottom:var(--sp-3)" autocomplete="new-password">` : ''}
      ${isFirstTime && !isEmailUser ? `<p style="font-size:var(--fs-xs);color:var(--color-text-muted);margin-bottom:var(--sp-4)">Remember this — it cannot be recovered if lost.</p>` : ''}
      <div id="pp-error" class="login-error hidden"></div>
      <button id="pp-btn" class="btn btn-primary" style="width:100%" type="button">${btnLabel}</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const input   = document.getElementById('pp-input');
  const confirm = document.getElementById('pp-confirm');
  const errEl   = document.getElementById('pp-error');
  const btn     = document.getElementById('pp-btn');

  setTimeout(() => input?.focus(), 80);

  const submit = async () => {
    const pass = input.value;
    if (!pass) { errEl.textContent = 'Please enter a passphrase.'; errEl.classList.remove('hidden'); return; }
    if (isFirstTime && !isEmailUser && confirm && pass !== confirm.value) {
      errEl.textContent = 'Passphrases do not match.'; errEl.classList.remove('hidden'); return;
    }
    btn.textContent = 'Unlocking…'; btn.disabled = true; errEl.classList.add('hidden');
    try {
      await JournalCrypto.initCrypto(pass, user.id);
      overlay.remove();
      onComplete?.();
    } catch (e) {
      btn.textContent = btnLabel; btn.disabled = false;
      errEl.textContent = e.message === 'wrong_passphrase' ? 'Incorrect passphrase. Try again.' : 'Something went wrong. Try again.';
      errEl.classList.remove('hidden');
    }
  };

  btn.addEventListener('click', submit);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  confirm?.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
}

/* ── App init ── */
async function initApp() {
  initTheme();
  await Scripture.loadScriptures();

  Auth.onAuthReady(async (user) => {
    updateAuthUI(user);

    if (!user && !window._guestMode) {
      Auth.showLoginScreen();
      return;
    }

    await JournalDB.openDB();

    if (window._guestMode) {
      hideLoginAndLaunch(null);
      return;
    }

    await ensureCryptoKey(user);

    await Payment.handlePostPaymentReturn();

    const access = await Payment.checkAccess();
    if (!access.allowed) {
      Payment.showPaymentWall();
      return;
    }

    hideLoginAndLaunch(user);
    if (access.status === 'trial') {
      Payment.showTrialBanner(access.daysLeft);
    }
  });

  await Auth.initAuth();
}

function hideLoginAndLaunch(user) {
  Auth.hideLoginScreen?.();
  launchJournal(user);
}

function launchJournal(user) {
  updateSidebarDate();
  initOnboarding();
  initThemePicker();
  initFontPicker();
  initCursorGlow();
  wireSignOutButton();

  Router.register('#home',      () => HomePage.init());
  Router.register('#today',     () => EntryPage.init());
  Router.register('#freewrite', () => FreeWritePage.init());
  Router.register('#calendar',  () => CalendarPage.init());
  Router.register('#goals',     () => GoalsPage.init());
  Router.register('#recap',     () => RecapPage.init());
  Router.register('#gallery',   () => GalleryPage.init());

  Router.handleRoute();
}

document.addEventListener('DOMContentLoaded', initApp);

window.App = { todayKey, dateKey, parseDateKey, formatDate, formatDateFull, isFirstDayOfMonth, isLastDayOfMonth, daysInMonth, showToast, MONTHS, MONTHS_SHORT, DAYS };
