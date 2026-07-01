/*
  Auth module — Supabase Google/email sign-in.
  Guest mode removed; all users must log in.
*/

let currentUser        = null;
let authReadyCb        = null;
let _pendingPassphrase = null;

async function initAuth() {
  SupabaseClient.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;

    if (currentUser && _pendingPassphrase) {
      try {
        await JournalCrypto.initCrypto(_pendingPassphrase, currentUser.id);
      } catch (e) {
        console.warn('Crypto init failed during auth:', e);
      }
      _pendingPassphrase = null;
    }

    if (authReadyCb) authReadyCb(currentUser);
  });
}

function onAuthReady(cb) {
  authReadyCb = cb;
}

async function signInWithGoogle() {
  const { error } = await SupabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
  if (error) throw error;
}

async function signInWithEmail(email, password) {
  _pendingPassphrase = password;
  const { error } = await SupabaseClient.auth.signInWithPassword({ email, password });
  if (error) { _pendingPassphrase = null; throw error; }
}

async function createAccount(email, password, name) {
  _pendingPassphrase = password;
  const { error } = await SupabaseClient.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });
  if (error) { _pendingPassphrase = null; throw error; }
}

async function sendPasswordReset(email) {
  const { error } = await SupabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname,
  });
  if (error) throw error;
}

async function signOut() {
  JournalCrypto.clearCryptoKey();
  await SupabaseClient.auth.signOut();
  currentUser = null;
  showLoginScreen();
}

function getCurrentUser()     { return currentUser; }
function isLoggedIn()         { return currentUser !== null; }

function getUserDisplayName() {
  if (!currentUser) return null;
  return currentUser.user_metadata?.full_name ||
         currentUser.user_metadata?.name ||
         currentUser.email?.split('@')[0] ||
         'Friend';
}

function getUserPhotoURL() {
  return currentUser?.user_metadata?.avatar_url || null;
}

/* ── Login screen UI ── */
function showLoginScreen() {
  const overlay = document.getElementById('login-overlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    renderLoginUI('signin');
  }
}

function hideLoginScreen() {
  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.classList.add('hidden');
}

function renderLoginUI(mode = 'signin') {
  const formContainer = document.getElementById('login-form-area');
  if (!formContainer) return;

  if (mode === 'signin') {
    formContainer.innerHTML = `
      <button id="google-signin-btn" class="btn-google-signin" type="button">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style="flex-shrink:0">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
          <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>

      <div class="login-divider"><span>or</span></div>

      <div class="field-group">
        <input type="email" id="login-email" class="input" placeholder="Email address" autocomplete="email">
      </div>
      <div class="field-group">
        <input type="password" id="login-password" class="input" placeholder="Password" autocomplete="current-password">
      </div>
      <div id="login-error" class="login-error hidden"></div>
      <button id="email-signin-btn" class="btn btn-primary" style="width:100%" type="button">Sign In</button>

      <div class="login-footer-links">
        <button class="btn-link" id="forgot-password-btn" type="button">Forgot password?</button>
        <span>·</span>
        <button class="btn-link" id="show-signup-btn" type="button">Create an account — free for 14 days</button>
      </div>

      <div class="login-guest-row">
        <button class="btn-link text-muted" id="guest-mode-btn" type="button">Continue as guest (local only)</button>
      </div>
    `;
    wireSignInButtons();

  } else if (mode === 'signup') {
    formContainer.innerHTML = `
      <div class="field-group">
        <input type="text" id="signup-name" class="input" placeholder="Your name" autocomplete="name">
      </div>
      <div class="field-group">
        <input type="email" id="signup-email" class="input" placeholder="Email address" autocomplete="email">
      </div>
      <div class="field-group">
        <input type="password" id="signup-password" class="input" placeholder="Create a password (min 6 chars)" autocomplete="new-password">
      </div>
      <div id="login-error" class="login-error hidden"></div>
      <button id="create-account-btn" class="btn btn-primary" style="width:100%" type="button">Create my account — free for 14 days</button>
      <div class="login-footer-links">
        <button class="btn-link" id="show-signin-btn" type="button">Already have an account? Sign in</button>
      </div>
    `;
    wireSignUpButtons();

  } else if (mode === 'reset') {
    formContainer.innerHTML = `
      <p style="font-size:var(--fs-sm);color:var(--color-text-muted);margin-bottom:var(--sp-4)">Enter your email and we'll send a reset link.</p>
      <div class="field-group">
        <input type="email" id="reset-email" class="input" placeholder="Email address">
      </div>
      <div id="login-error" class="login-error hidden"></div>
      <button id="send-reset-btn" class="btn btn-primary" style="width:100%" type="button">Send Reset Link</button>
      <div class="login-footer-links">
        <button class="btn-link" id="back-signin-btn" type="button">← Back to sign in</button>
      </div>
    `;
    wireResetButtons();
  }
}

function showError(msg) {
  const el = document.getElementById('login-error');
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

function clearError() {
  const el = document.getElementById('login-error');
  if (el) el.classList.add('hidden');
}

function wireSignInButtons() {
  document.getElementById('google-signin-btn')?.addEventListener('click', async () => {
    clearError();
    try { await signInWithGoogle(); }
    catch (e) { showError(friendlyError(e)); }
  });

  document.getElementById('email-signin-btn')?.addEventListener('click', async () => {
    clearError();
    const email = document.getElementById('login-email')?.value?.trim();
    const pass  = document.getElementById('login-password')?.value;
    if (!email || !pass) { showError('Please enter your email and password.'); return; }
    try { await signInWithEmail(email, pass); }
    catch (e) { showError(friendlyError(e)); }
  });

  document.getElementById('login-password')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('email-signin-btn')?.click();
  });

  document.getElementById('forgot-password-btn')?.addEventListener('click', () => renderLoginUI('reset'));
  document.getElementById('show-signup-btn')?.addEventListener('click', () => renderLoginUI('signup'));
  document.getElementById('guest-mode-btn')?.addEventListener('click', () => {
    window._guestMode = true;
    hideLoginScreen();
    if (authReadyCb) authReadyCb(null);
  });
}

function wireSignUpButtons() {
  document.getElementById('create-account-btn')?.addEventListener('click', async () => {
    clearError();
    const name  = document.getElementById('signup-name')?.value?.trim();
    const email = document.getElementById('signup-email')?.value?.trim();
    const pass  = document.getElementById('signup-password')?.value;
    if (!email || !pass) { showError('Please fill in all fields.'); return; }
    if (pass.length < 6) { showError('Password must be at least 6 characters.'); return; }
    const btn = document.getElementById('create-account-btn');
    if (btn) { btn.textContent = 'Creating…'; btn.disabled = true; }
    try {
      await createAccount(email, pass, name);
      const formContainer = document.getElementById('login-form-area');
      if (formContainer) {
        formContainer.innerHTML = `
          <div style="text-align:center;padding:var(--sp-8) 0">
            <div style="font-size:2rem;margin-bottom:var(--sp-3)">🌸</div>
            <p style="font-size:var(--fs-sm);color:var(--color-text-muted)">Account created! Signing you in…</p>
          </div>
        `;
      }
    } catch (e) {
      showError(friendlyError(e));
      if (btn) { btn.textContent = 'Create Account'; btn.disabled = false; }
    }
  });

  document.getElementById('show-signin-btn')?.addEventListener('click', () => renderLoginUI('signin'));
}

function wireResetButtons() {
  document.getElementById('send-reset-btn')?.addEventListener('click', async () => {
    clearError();
    const email = document.getElementById('reset-email')?.value?.trim();
    if (!email) { showError('Please enter your email address.'); return; }
    try {
      await sendPasswordReset(email);
      document.getElementById('login-form-area').innerHTML = `
        <div style="text-align:center;padding:var(--sp-8) 0">
          <div style="font-size:2rem;margin-bottom:var(--sp-3)">✉️</div>
          <p style="font-size:var(--fs-sm);color:var(--color-text-muted)">Reset link sent to <strong>${email}</strong>. Check your inbox.</p>
        </div>
        <div class="login-footer-links">
          <button class="btn-link" id="back-signin-btn2" type="button">← Back to sign in</button>
        </div>
      `;
      document.getElementById('back-signin-btn2')?.addEventListener('click', () => renderLoginUI('signin'));
    } catch (e) { showError(friendlyError(e)); }
  });
  document.getElementById('back-signin-btn')?.addEventListener('click', () => renderLoginUI('signin'));
}

function friendlyError(err) {
  const msg = err?.message || '';
  if (msg.includes('Invalid login credentials'))  return 'Incorrect email or password.';
  if (msg.includes('Email not confirmed'))         return 'Check your email to confirm your account first.';
  if (msg.includes('User already registered'))     return 'An account already exists with this email.';
  if (msg.includes('Password should be'))          return 'Password must be at least 6 characters.';
  if (msg.includes('Unable to validate email'))    return 'Please enter a valid email address.';
  if (msg.includes('Email rate limit'))            return 'Too many attempts. Please wait a moment.';
  return 'Something went wrong. Please try again.';
}

window.Auth = {
  initAuth, onAuthReady, signInWithGoogle, signInWithEmail, createAccount,
  sendPasswordReset, signOut, getCurrentUser, isLoggedIn,
  getUserDisplayName, getUserPhotoURL, showLoginScreen, hideLoginScreen,
};
