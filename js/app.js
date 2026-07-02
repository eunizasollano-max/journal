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
  if (document.getElementById('cursor-glow')) return;
  const glow = document.createElement('div');
  glow.id = 'cursor-glow';
  document.body.appendChild(glow);

  let _rafId = null;
  document.addEventListener('mousemove', (e) => {
    if (_rafId) return;
    _rafId = requestAnimationFrame(() => {
      glow.style.transform = `translate(calc(${e.clientX}px - 50%), calc(${e.clientY}px - 50%))`;
      glow.style.opacity = '1';
      _rafId = null;
    });
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
  const mobileNick = document.getElementById('more-nickname-btn');
  if (mobileNick) mobileNick.textContent = name;
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
    const syncBtn = document.getElementById('sync-btn');
    if (syncBtn) syncBtn.style.display = '';
  } else {
    if (authStatus) authStatus.textContent = 'Not signed in';
    if (userAvatar) userAvatar.innerHTML = '';
    if (signOutBtn) signOutBtn.style.display = 'none';
    const syncBtn = document.getElementById('sync-btn');
    if (syncBtn) syncBtn.style.display = 'none';
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

function wireSyncButton() {
  const btn = document.getElementById('sync-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    btn.textContent = '⟳';
    btn.disabled = true;
    btn.style.opacity = '0.5';
    try {
      const counts = await JournalDB.syncFromCloud();
      showToast(`Synced ${counts.entries} entries, ${counts.goals} goals, ${counts.recap} recaps ✓`);
      Router.handleRoute?.();
    } catch (e) {
      showToast('Sync failed — check your connection.');
    } finally {
      btn.textContent = '⟳';
      btn.disabled = false;
      btn.style.opacity = '';
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

/* ── View-only / preview mode ── */
function showViewOnlyBanner() {
  if (document.getElementById('view-only-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'view-only-banner';
  banner.className = 'trial-banner';
  banner.innerHTML = `
    <span>👀 You're previewing — entries won't be saved</span>
    <button class="trial-banner-btn" id="view-only-signin-btn" type="button">Sign In to Save</button>
  `;
  document.body.prepend(banner);
  document.getElementById('view-only-signin-btn')?.addEventListener('click', () => {
    window._viewOnly  = false;
    window._guestMode = false;
    banner.remove();
    Auth.showLoginScreen();
  });
}

function wrapSavesForViewOnly() {
  const block = (name) => async () => {
    showToast('Sign in to save your journal ✨');
    Auth.showLoginScreen();
  };
  JournalDB.saveEntry = block('saveEntry');
  JournalDB.saveGoals = block('saveGoals');
  JournalDB.saveRecap = block('saveRecap');
}

/* ── Mobile More Drawer ── */
function wireMobileMore() {
  const drawer  = document.getElementById('mobile-more-drawer');
  const overlay = document.getElementById('mobile-more-overlay');
  if (!drawer) return;

  function openDrawer() {
    drawer.classList.add('open');
    overlay.classList.remove('hidden');
  }
  function closeDrawer() {
    drawer.classList.remove('open');
    overlay.classList.add('hidden');
  }

  document.getElementById('mobile-more-btn')?.addEventListener('click', openDrawer);
  overlay.addEventListener('click', closeDrawer);

  ['freewrite', 'calendar', 'gallery', 'recap'].forEach(route => {
    document.getElementById(`more-${route}-btn`)?.addEventListener('click', () => {
      closeDrawer();
      Router.navigate(`#${route}`);
    });
  });

  document.getElementById('more-sync-btn')?.addEventListener('click', async () => {
    closeDrawer();
    document.getElementById('sync-btn')?.click();
  });

  document.getElementById('more-signout-btn')?.addEventListener('click', () => {
    closeDrawer();
    document.getElementById('signout-btn')?.click();
  });

  document.getElementById('more-nickname-btn')?.addEventListener('click', () => {
    const btn = document.getElementById('more-nickname-btn');
    const current = localStorage.getItem('journal_user_name') || Auth.getUserDisplayName?.() || '';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = current;
    input.className = 'input';
    input.style.cssText = 'font-family:var(--font-script);font-size:var(--fs-md);color:var(--color-accent-script);padding:2px 6px;width:140px';
    btn.replaceWith(input);
    input.focus();
    input.select();
    const save = () => {
      const n = input.value.trim() || current;
      localStorage.setItem('journal_user_name', n);
      applyUserName(n);
      input.replaceWith(btn);
      btn.textContent = n;
    };
    input.addEventListener('blur', save);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); save(); }
      if (e.key === 'Escape') { input.replaceWith(btn); }
    });
  });

  document.getElementById('mobile-theme-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('theme-picker')?.classList.toggle('open');
    document.getElementById('font-picker')?.classList.remove('open');
  });

  document.getElementById('mobile-font-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('font-picker')?.classList.toggle('open');
    document.getElementById('theme-picker')?.classList.remove('open');
  });
}

/* ── Nickname editing ── */
function initNicknameEdit() {
  const el = document.querySelector('.brand-user');
  if (!el) return;

  el.style.cursor = 'pointer';
  el.title = 'Click to edit your name';

  el.addEventListener('click', () => {
    const currentName = localStorage.getItem('journal_user_name') || el.textContent.replace(/'s Journal$/, '').trim();
    const input = document.createElement('input');
    input.type  = 'text';
    input.value = currentName;
    input.maxLength = 40;
    input.className = 'brand-user-input';
    input.style.cssText = 'font:inherit;background:transparent;border:none;border-bottom:1px solid currentColor;outline:none;width:100%;max-width:180px;text-align:center;color:inherit;';

    el.textContent = '';
    el.appendChild(input);
    input.focus();
    input.select();

    const save = () => {
      const name = input.value.trim() || currentName;
      localStorage.setItem('journal_user_name', name);
      applyUserName(name);
    };
    input.addEventListener('blur', save);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } if (e.key === 'Escape') { input.value = currentName; input.blur(); } });
  });
}

/* ── Passphrase modal (Google users + returning email users with no session key) ── */
async function ensureCryptoKey(user) {
  if (JournalCrypto.getCryptoKey()) return;
  if (await JournalCrypto.restoreKeyFromSession()) return;
  return new Promise((resolve) => showPassphraseModal(user, resolve));
}

async function showPassphraseModal(user, onComplete) {
  const isEmailUser  = user.app_metadata?.provider === 'email';
  const existingKey  = await JournalCrypto.getUserKey(user.id);
  const isFirstTime  = !existingKey;

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
    btn.textContent = isFirstTime ? 'Setting up…' : 'Unlocking…'; btn.disabled = true; errEl.classList.add('hidden');
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      await JournalCrypto.initCrypto(pass, user.id, existingKey);
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

    Auth.hideLoginScreen?.();
    await JournalDB.openDB();

    if (window._viewOnly) {
      wrapSavesForViewOnly();
      hideLoginAndLaunch(null);
      showViewOnlyBanner();
      return;
    }

    await ensureCryptoKey(user);

    await Payment.handlePostPaymentReturn();

    const access = await Payment.checkAccess();
    if (!access.allowed) {
      Payment.showPaymentWall(access.status);
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

function showBetaWelcome() {
  if (localStorage.getItem('journal_beta_dismissed')) return;
  if (document.getElementById('beta-welcome-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'beta-welcome-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:420px;text-align:center">
      <div style="font-size:2.4rem;margin-bottom:var(--sp-3)">🌸</div>
      <h2 class="modal-title">Hey friend!</h2>
      <p class="modal-desc" style="line-height:1.85;margin-bottom:var(--sp-4)">
        Thank you so much for being an early tester — it truly means the world.
      </p>
      <p class="modal-desc" style="line-height:1.85;margin-bottom:var(--sp-4)">
        Just a heads up: <em>Another Day, another chance</em> is still in
        <strong>testing mode</strong>, so you may run into small bugs or unfinished features.
        Please don't rely on it yet as your only journal — data could be reset
        as we make improvements.
      </p>
      <p class="modal-desc" style="line-height:1.85;margin-bottom:var(--sp-5)">
        Your feedback is a gift. If something feels off or broken, just let me know! 🤍
      </p>
      <p style="font-family:var(--font-script);font-size:var(--fs-xl);color:var(--color-accent-script);margin-bottom:var(--sp-6)">— Yuni</p>
      <button class="btn btn-primary btn-lg" id="beta-got-it-btn" style="width:100%">Got it, let's go! ✨</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('beta-got-it-btn').addEventListener('click', () => {
    overlay.remove();
    localStorage.setItem('journal_beta_dismissed', '1');
  });
}

let _journalLaunched = false;

function launchJournal(user) {
  if (_journalLaunched) return;
  _journalLaunched = true;

  updateSidebarDate();
  showBetaWelcome();
  initOnboarding();
  initNicknameEdit();
  initThemePicker();
  initFontPicker();
  initCursorGlow();
  wireSignOutButton();
  wireSyncButton();
  wireMobileMore();

  Router.register('#home',      () => HomePage.init());
  Router.register('#today',     () => EntryPage.init());
  Router.register('#freewrite', () => FreeWritePage.init());
  Router.register('#calendar',  () => CalendarPage.init());
  Router.register('#goals',     () => GoalsPage.init());
  Router.register('#recap',     () => RecapPage.init());
  Router.register('#gallery',   () => GalleryPage.init());
  Router.register('#privacy',   () => {});
  Router.register('#terms',     () => {});

  Router.handleRoute();
}

document.addEventListener('DOMContentLoaded', initApp);

window.App = { todayKey, dateKey, parseDateKey, formatDate, formatDateFull, isFirstDayOfMonth, isLastDayOfMonth, daysInMonth, showToast, MONTHS, MONTHS_SHORT, DAYS };
