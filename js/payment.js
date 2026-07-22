/*
  Payment module — 14-day free trial + Stripe paywall.
  Reads/writes user_subscriptions table in Supabase.
  Secret keys never touch this file — checkout session is
  created server-side in the Edge Function.
*/

const TRIAL_DAYS   = 14;
const PRICE_LABEL  = '$1.99/month';

async function getSubscription() {
  const user = Auth.getCurrentUser();
  if (!user) return null;
  const { data } = await SupabaseClient
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  return data;
}

async function startTrial() {
  const user = Auth.getCurrentUser();
  if (!user) return;
  await SupabaseClient.from('user_subscriptions').insert({
    user_id: user.id,
    trial_start_date: new Date().toISOString(),
    is_paid: false,
    subscription_status: 'trial',
  });
}

async function checkAccess() {
  try {
    const sub = await getSubscription();
    if (!sub) return { allowed: false, status: 'new' };

    if (sub.is_paid && sub.subscription_status === 'active') {
      return { allowed: true, status: 'active' };
    }

    const msPerDay  = 1000 * 60 * 60 * 24;
    const daysUsed  = Math.floor((Date.now() - new Date(sub.trial_start_date)) / msPerDay);
    const daysLeft  = Math.max(0, TRIAL_DAYS - daysUsed);

    if (daysLeft > 0) return { allowed: true, status: 'trial', daysLeft };
    return { allowed: false, status: 'expired' };
  } catch (err) {
    console.warn('Payment check failed, allowing access:', err);
    return { allowed: true, status: 'error' };
  }
}

function showTrialBanner(daysLeft) {
  if (document.getElementById('trial-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'trial-banner';
  banner.className = 'trial-banner';
  banner.innerHTML = `
    <span>✨ ${daysLeft} day${daysLeft === 1 ? '' : 's'} left in your free trial</span>
    <button class="trial-banner-btn" id="trial-upgrade-btn" type="button">
      Upgrade — ${PRICE_LABEL}
    </button>
  `;
  document.body.prepend(banner);
  document.getElementById('trial-upgrade-btn')?.addEventListener('click', showPaymentWall);
}

function showPaymentWall(status = 'expired') {
  document.getElementById('payment-overlay')?.remove();

  const isNew      = status === 'new';
  const headline   = isNew ? 'Start your journaling journey' : 'Your free trial has ended';
  const subline    = isNew ? 'Choose how you\'d like to begin:' : 'Continue your journey — cancel anytime.';

  const trialCard = isNew ? `
    <div class="plan-card" id="trial-card">
      <div class="plan-badge">Free</div>
      <div class="plan-name">Free Trial</div>
      <div class="plan-price">${TRIAL_DAYS} days free</div>
      <div class="plan-then">then ${PRICE_LABEL}</div>
      <button class="btn btn-outline plan-btn" id="start-trial-btn" type="button">
        Try Free Trial
      </button>
    </div>
  ` : '';

  const overlay = document.createElement('div');
  overlay.id = 'payment-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box payment-modal">
      <div class="payment-modal-icon">🌸</div>
      <h2 class="modal-title">${headline}</h2>
      <p class="modal-desc">${subline}</p>

      <ul class="payment-features">
        <li>✦ Daily guided journal prompts</li>
        <li>✦ Free write with auto-save</li>
        <li>✦ Monthly goals &amp; recap</li>
        <li>✦ Photo &amp; video gallery</li>
        <li>✦ Calendar view of all entries</li>
      </ul>

      <div class="plan-cards">
        ${trialCard}
        <div class="plan-card plan-card--primary" id="subscribe-card">
          ${isNew ? '<div class="plan-badge plan-badge--primary">Best value</div>' : ''}
          <div class="plan-name">Subscribe</div>
          <div class="plan-price">${PRICE_LABEL}</div>
          <div class="plan-then">cancel anytime</div>
          <button class="btn btn-primary plan-btn" id="checkout-btn" type="button">
            Subscribe Now
          </button>
        </div>
      </div>

      <button class="btn-link text-muted" id="payment-signout-btn" type="button"
        style="margin-top:var(--sp-4);font-size:var(--fs-sm)">Sign out</button>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('checkout-btn')?.addEventListener('click', startCheckout);

  document.getElementById('start-trial-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('start-trial-btn');
    if (btn) { btn.textContent = 'Starting…'; btn.disabled = true; }
    try {
      await startTrial();
      window.location.reload();
    } catch (e) {
      console.error('Trial start failed:', e);
      if (btn) { btn.textContent = 'Try Free Trial'; btn.disabled = false; }
    }
  });

  document.getElementById('payment-signout-btn')?.addEventListener('click', () => {
    overlay.remove();
    Auth.signOut();
  });
}

async function startCheckout() {
  const btn = document.getElementById('checkout-btn');
  if (btn) { btn.textContent = 'Redirecting…'; btn.disabled = true; }

  try {
    const user = Auth.getCurrentUser();
    const { data: { session } } = await SupabaseClient.auth.getSession();

    const res = await fetch(`${window.SUPABASE_URL}/functions/v1/create-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ user_id: user.id, email: user.email }),
    });

    const { url, error } = await res.json();
    if (error) throw new Error(error);
    window.location.href = url;
  } catch (err) {
    console.error('Checkout failed:', err);
    if (btn) { btn.textContent = 'Start Subscription'; btn.disabled = false; }
    App.showToast('Could not start checkout — please try again.');
  }
}

async function handlePostPaymentReturn() {
  const params  = new URLSearchParams(window.location.search);
  const payment = params.get('payment');
  if (!payment) return;

  window.history.replaceState({}, '', window.location.pathname);

  if (payment === 'success') {
    App.showToast('Payment successful! Welcome to your journal ✨');
  }
}

window.Payment = { checkAccess, showPaymentWall, showTrialBanner, handlePostPaymentReturn, startTrial };
