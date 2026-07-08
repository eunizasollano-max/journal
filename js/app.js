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

/* ── HTML escaping ──
   For interpolating user-typed text into innerHTML template strings.
   Without this, journal text containing "<" or ">" would be parsed as
   markup instead of shown as text. */
function escapeHtml(str) {
  return (str ?? '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
  { key: 'rosewater', label: 'Rosewater', dot: '#b76e79' },
  { key: 'lavender',  label: 'Lavender',  dot: '#c4b8e8' },
  { key: 'mint',      label: 'Mint',      dot: '#a8d8b8' },
  { key: 'peach',     label: 'Peach',     dot: '#e8c098' },
  { key: 'sky',       label: 'Sky',       dot: '#a8c4e8' },
  { key: 'lemon',     label: 'Lemon',     dot: '#f0dc98' },
  { key: 'midnight',  label: 'Midnight',  dot: '#2a1545' },
];

function initTheme() {
  let saved = localStorage.getItem('journal_theme') || 'rosewater';
  // Blush was retired when Rosewater replaced it as the base theme
  if (!THEMES.some(t => t.key === saved)) saved = 'rosewater';
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
    const current = localStorage.getItem('journal_theme') || 'rosewater';
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

  const mobileBtn = document.getElementById('mobile-theme-btn');
  mobileBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    picker.classList.toggle('open');
    document.getElementById('font-picker')?.classList.remove('open');
  });

  document.addEventListener('click', (e) => {
    if (!picker.contains(e.target) && e.target !== toggleBtn && e.target !== mobileBtn) {
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
  let _x = 0, _y = 0;
  document.addEventListener('mousemove', (e) => {
    _x = e.clientX;
    _y = e.clientY;
    if (_rafId) return;
    _rafId = requestAnimationFrame(() => {
      glow.style.transform = `translate(calc(${_x}px - 50%), calc(${_y}px - 50%))`;
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

/* ── Day-streak preference (opt-out toggle in the settings panel) ── */
function streakEnabled() {
  return localStorage.getItem('journal_show_streak') !== '0';
}

function applyStreakPref() {
  const on = streakEnabled();
  document.documentElement.classList.toggle('hide-streak', !on);
  const btn = document.getElementById('streak-toggle');
  if (btn) btn.setAttribute('aria-checked', on ? 'true' : 'false');
}

function initFontPicker() {
  const toggleBtn = document.getElementById('font-toggle-btn');
  const picker    = document.getElementById('font-picker');
  if (!toggleBtn || !picker) return;

  const saved = localStorage.getItem('journal_answer_font') || 'nunito';
  applyAnswerFont(saved);

  const streakBtn = document.getElementById('streak-toggle');
  if (streakBtn) {
    applyStreakPref();
    streakBtn.addEventListener('click', () => {
      localStorage.setItem('journal_show_streak', streakEnabled() ? '0' : '1');
      applyStreakPref();
    });
  }

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

  const mobileBtn = document.getElementById('mobile-font-btn');
  mobileBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    picker.classList.toggle('open');
    document.getElementById('theme-picker')?.classList.remove('open');
  });

  document.addEventListener('click', (e) => {
    if (!picker.contains(e.target) && e.target !== toggleBtn && e.target !== mobileBtn) {
      picker.classList.remove('open');
    }
  });
}

/* ── Onboarding (nickname, shown after first login) ── */
function initOnboarding() {
  // A nickname the user chose themselves always wins over the name Google
  // gave us — that's the whole point of letting them set one.
  const nickname = localStorage.getItem('journal_user_name');
  if (nickname) { applyUserName(nickname); return; }

  const displayName = Auth.getUserDisplayName?.();
  if (displayName) { applyUserName(displayName); return; }

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
      const photoPart    = counts.photos ? `, ${counts.photos} photo${counts.photos === 1 ? '' : 's'}` : '';
      const backupPart   = counts.uploaded ? ` — backed up ${counts.uploaded} photo${counts.uploaded === 1 ? '' : 's'} to Drive` : '';
      const routinesPart = counts.routines ? `, ${counts.routines} routine${counts.routines === 1 ? '' : 's'}` : '';
      showToast(`Synced ${counts.entries} entries, ${counts.goals} goals, ${counts.recap} recaps${routinesPart}${photoPart}${backupPart} ✓`);
      // Temporary diagnostic: surface details when a sync looks off, since
      // phone testing has no easy console access.
      if (counts.debug && (counts.debug.includes('errors:') || counts.debug.includes('MISSING'))) {
        console.error('Sync debug:', counts.debug);
        alert(`Sync debug info:\n${counts.debug}`);
      }
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

/* ── Google Drive reconnect banner ──
   Google's OAuth access token lasts ~1hr and Supabase never refreshes it,
   so this fires roughly hourly for active Google users. A full sign-out
   isn't needed to fix it — re-running the Google OAuth handshake refreshes
   just the provider_token, so this is a single click instead of a manual
   sign-out/sign-in/re-sync sequence. */
function showDriveReconnectBanner() {
  if (document.getElementById('drive-reconnect-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'drive-reconnect-banner';
  banner.className = 'trial-banner';
  banner.innerHTML = `
    <span>Entry saved 🌸 Your photo is safe on this device — sign in again and tap Sync ⟳ to back it up to Google Drive.</span>
    <button class="trial-banner-btn" id="drive-reconnect-btn" type="button">Reconnect</button>
  `;
  document.body.prepend(banner);
  document.getElementById('drive-reconnect-btn')?.addEventListener('click', async () => {
    try { await Auth.signInWithGoogle(); }
    catch (e) { showToast('Could not reconnect — please try again.'); }
  });
}

function wrapSavesForViewOnly() {
  // Must throw, not resolve — callers show their own "saved" toast on any
  // non-error return, which would silently overwrite this warning and lie
  // to a previewing user about their data being saved.
  const block = () => async () => {
    Auth.showLoginScreen();
    const err = new Error('Sign in to save your journal ✨');
    err.viewOnlyBlocked = true;
    throw err;
  };
  JournalDB.saveEntry = block();
  JournalDB.saveGoals = block();
  JournalDB.saveRecap = block();
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

  ['freewrite', 'guide', 'gallery', 'recap'].forEach(route => {
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
  if (document.getElementById('passphrase-overlay')) return;
  return new Promise((resolve) => showPassphraseModal(user, resolve));
}

/* ── Password recovery (arrived from a "Forgot password?" email link) ──
   The link signs the user in but does NOT change their password — this
   modal completes the flow by actually setting the new one. */
async function showPasswordRecoveryModal() {
  if (document.getElementById('recovery-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'recovery-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:360px;text-align:center">
      <div style="font-size:2rem;margin-bottom:var(--sp-3)">🔑</div>
      <h2 class="modal-title">Choose a new password</h2>
      <p class="modal-desc" style="margin-bottom:var(--sp-4)">You followed a password reset link — set your new password below.</p>
      <div class="pw-field" style="margin-bottom:var(--sp-3)">
        <input type="password" id="rec-input" class="input" placeholder="New password (min 6 chars)" autocomplete="new-password">
        <button type="button" class="pw-toggle" aria-label="Show password">👁</button>
      </div>
      <div class="pw-field" style="margin-bottom:var(--sp-3)">
        <input type="password" id="rec-confirm" class="input" placeholder="Confirm new password" autocomplete="new-password">
        <button type="button" class="pw-toggle" aria-label="Show password">👁</button>
      </div>
      <div id="rec-error" class="login-error hidden"></div>
      <button id="rec-btn" class="btn btn-primary" style="width:100%" type="button">Set new password</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const input   = document.getElementById('rec-input');
  const confirm = document.getElementById('rec-confirm');
  const errEl   = document.getElementById('rec-error');
  const btn     = document.getElementById('rec-btn');
  setTimeout(() => input?.focus(), 80);

  return new Promise((resolve) => {
    let _busy = false;
    const submit = async () => {
      if (_busy) return;
      const pass = input.value;
      if (!pass || pass.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; errEl.classList.remove('hidden'); return; }
      if (pass !== confirm.value)   { errEl.textContent = 'Passwords do not match.'; errEl.classList.remove('hidden'); return; }
      _busy = true;
      btn.textContent = 'Saving…';
      errEl.classList.add('hidden');
      try {
        await Auth.completePasswordRecovery(pass);
        overlay.remove();
        showToast('Password updated ✓');
        resolve();
      } catch (e) {
        _busy = false;
        btn.textContent = 'Set new password';
        errEl.textContent = 'Could not update your password. Please try again.';
        errEl.classList.remove('hidden');
        console.warn('Password recovery failed:', e);
      }
    };
    btn.addEventListener('click', submit);
    confirm.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  });
}

async function showPassphraseModal(user, onComplete) {
  const isEmailUser  = user.app_metadata?.provider === 'email';
  const existingKey  = await JournalCrypto.getUserKey(user.id);
  const isFirstTime  = !existingKey;

  const title    = isFirstTime ? 'Protect your journal' : 'Unlock your journal';
  const subtitle = isFirstTime
    ? (isEmailUser ? 'Your entries will be encrypted with your account password — only you can read them.' : 'Create a passphrase to encrypt your journal. Only you will be able to read it.')
    : (isEmailUser ? 'Enter your account password to unlock your journal. If you recently changed or reset your password, use the one you had <strong>before</strong> — your journal is still locked with it.' : 'Enter your journal passphrase to continue.');
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
      <div class="pw-field" style="margin-bottom:var(--sp-3)">
        <input type="password" id="pp-input" class="input" placeholder="${placeholder}"
          autocomplete="${isFirstTime ? 'new-password' : 'current-password'}">
        <button type="button" class="pw-toggle" aria-label="Show password">👁</button>
      </div>
      ${isFirstTime && !isEmailUser ? `<div class="pw-field" style="margin-bottom:var(--sp-3)">
        <input type="password" id="pp-confirm" class="input" placeholder="Confirm passphrase" autocomplete="new-password">
        <button type="button" class="pw-toggle" aria-label="Show password">👁</button>
      </div>` : ''}
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

  let _busy = false;
  const submit = async () => {
    if (_busy) return;
    const pass = input.value;
    if (!pass) { errEl.textContent = 'Please enter a passphrase.'; errEl.classList.remove('hidden'); return; }
    if (isFirstTime && !isEmailUser && confirm && pass !== confirm.value) {
      errEl.textContent = 'Passphrases do not match.'; errEl.classList.remove('hidden'); return;
    }
    _busy = true;
    btn.textContent = isFirstTime ? 'Setting up…' : 'Unlocking…';
    btn.classList.add('loading');
    errEl.classList.add('hidden');
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      await JournalCrypto.initCrypto(pass, user.id, existingKey);

      // Email user unlocked with a password that differs from the one they
      // logged in with — they changed/reset their account password. Rotate
      // the journal encryption to the current password so next time their
      // normal login just works.
      const sessionPw = isEmailUser ? Auth.getSessionPassword?.() : null;
      if (sessionPw && sessionPw !== pass) {
        btn.textContent = 'Securing your journal…';
        try {
          await JournalCrypto.rotatePassphrase(sessionPw, user.id);
          showToast('Journal re-locked with your new password ✓');
        } catch (rotErr) {
          // Non-fatal: journal stays on the old password; they can unlock
          // with it again next time and rotation will retry.
          console.warn('Passphrase rotation failed:', rotErr);
        }
      }

      overlay.remove();
      onComplete?.();
    } catch (e) {
      _busy = false;
      btn.textContent = btnLabel;
      btn.classList.remove('loading');
      errEl.textContent = e.message === 'wrong_passphrase'
        ? (isEmailUser ? 'Incorrect password. If you changed or reset your password recently, try the one you used before.' : 'Incorrect passphrase. Try again.')
        : 'Something went wrong. Try again.';
      errEl.classList.remove('hidden');
    }
  };

  btn.addEventListener('click', submit);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  confirm?.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
}

/* ── Show/hide password toggles (works for any .pw-field, incl. dynamic ones) ── */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.pw-toggle');
  if (!btn) return;
  const input = btn.parentElement.querySelector('input');
  if (!input) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.textContent = show ? '🙈' : '👁';
  btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
});

/* ── App init ── */
async function initApp() {
  initTheme();
  // Pickers work before login — choosing a theme shouldn't need an account
  initThemePicker();
  initFontPicker();
  await Scripture.loadScriptures();
  // Supabase can emit PASSWORD_RECOVERY after the initial session event,
  // i.e. after launch already passed the _passwordRecovery check below —
  // catch that late arrival here.
  window.addEventListener('journal:password-recovery', () => {
    if (!window._viewOnly) showPasswordRecoveryModal();
  });

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

    // Came from a "Forgot password?" email link: let them set the new
    // password first, then the unlock modal below handles re-encryption.
    if (window._passwordRecovery) await showPasswordRecoveryModal();

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
      <div style="width:64px;margin:0 auto var(--sp-3)"><svg viewBox="0 0 120 112" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g stroke="var(--color-accent-sage)" stroke-width="2" stroke-linecap="round"><path d="M60 104C60 78 59 64 60 52"/><path d="M60 80C48 76 40 68 38 58"/><path d="M60 90C72 87 80 80 83 70"/></g><g stroke="var(--color-accent-deep)" stroke-width="2" stroke-linejoin="round"><ellipse cx="60" cy="22" rx="10" ry="16"/><ellipse cx="60" cy="22" rx="10" ry="16" transform="rotate(72 60 38)"/><ellipse cx="60" cy="22" rx="10" ry="16" transform="rotate(144 60 38)"/><ellipse cx="60" cy="22" rx="10" ry="16" transform="rotate(216 60 38)"/><ellipse cx="60" cy="22" rx="10" ry="16" transform="rotate(288 60 38)"/></g><circle cx="60" cy="38" r="4" fill="var(--color-star-fill)"/></svg></div>
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
  // initCursorGlow() retired in the feminine-minimal refresh — the glow
  // is hidden for every theme now, so don't pay for the mousemove listener.
  wireSignOutButton();
  wireSyncButton();
  wireMobileMore();

  Router.register('#home',      () => { document.documentElement.classList.remove('night-mode', 'day-mode'); HomePage.init(); });
  Router.register('#today',     () => {
    const session = localStorage.getItem('journal_session');
    document.documentElement.classList.toggle('night-mode', session === 'evening');
    document.documentElement.classList.toggle('day-mode', session === 'morning');
    EntryPage.init();
  });
  Router.register('#freewrite', () => { document.documentElement.classList.remove('night-mode', 'day-mode'); FreeWritePage.init(); });
  Router.register('#calendar',  () => { document.documentElement.classList.remove('night-mode', 'day-mode'); CalendarPage.init(); });
  Router.register('#goals',     () => { document.documentElement.classList.remove('night-mode', 'day-mode'); GoalsPage.init(); });
  Router.register('#routines',  () => { document.documentElement.classList.remove('night-mode', 'day-mode'); RoutinesPage.init(); });
  Router.register('#recap',     () => { document.documentElement.classList.remove('night-mode', 'day-mode'); RecapPage.init(); });
  Router.register('#gallery',   () => { document.documentElement.classList.remove('night-mode', 'day-mode'); GalleryPage.init(); });
  Router.register('#privacy',   () => { document.documentElement.classList.remove('night-mode', 'day-mode'); });
  Router.register('#terms',     () => { document.documentElement.classList.remove('night-mode', 'day-mode'); });

  Router.handleRoute();
}

document.addEventListener('DOMContentLoaded', initApp);

window.App = { todayKey, dateKey, parseDateKey, formatDate, formatDateFull, isFirstDayOfMonth, isLastDayOfMonth, daysInMonth, showToast, showDriveReconnectBanner, escapeHtml, escapeAttr, MONTHS, MONTHS_SHORT, DAYS };
