const routes = {};
let currentRoute = null;

function register(hash, handler) {
  routes[hash] = handler;
}

function navigate(hash) {
  if (!hash.startsWith('#')) hash = '#' + hash;
  window.location.hash = hash;
}

function handleRoute() {
  const hash = window.location.hash || '#today';
  const route = hash.split('/')[0];

  // Hide all sections
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));

  // Update nav items
  document.querySelectorAll('[data-route]').forEach(el => {
    el.classList.toggle('active', el.dataset.route === route);
  });

  // Show matching section
  const sectionId = 'section-' + route.replace('#', '');
  const section = document.getElementById(sectionId);
  if (section) section.classList.add('active');

  // Update mobile header title
  const navItem = document.querySelector(`[data-route="${route}"]`);
  const mobileTitle = document.getElementById('mobile-header-title');
  if (mobileTitle && navItem) {
    const label = navItem.querySelector('.nav-label') || navItem.querySelector('.mobile-nav-label');
    mobileTitle.textContent = label ? label.textContent : 'Journal';
  }

  // Strip night-mode when leaving the Today section
  if (route !== '#today') {
    document.documentElement.classList.remove('night-mode');
  }

  // Run route handler — a failing page must not leave the app half-rendered
  if (routes[route]) {
    try {
      routes[route](hash);
    } catch (e) {
      console.error('Page init failed for', route, e);
    }
  }

  currentRoute = route;

  // Scroll to top instantly — smooth scrolling here made page switches feel slow
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// Delegated nav clicks: any [data-route] element navigates on click.
// <a data-route href="#x"> already navigates natively via href; this is
// what actually drives <button data-route> elements (entry tabs, mobile
// nav bar) which have no href of their own. Was previously inline
// onclick="Router.navigate(...)" on every one of these — moved here so
// a strict script-src CSP (no 'unsafe-inline') doesn't block them.
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-route]');
  if (el) navigate(el.dataset.route);
});

window.addEventListener('hashchange', handleRoute);
window.Router = { register, navigate, handleRoute, getCurrentRoute: () => currentRoute };
