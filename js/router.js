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

  // Run route handler
  if (routes[route]) {
    routes[route](hash);
  }

  currentRoute = route;

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.addEventListener('hashchange', handleRoute);
window.Router = { register, navigate, handleRoute, getCurrentRoute: () => currentRoute };
