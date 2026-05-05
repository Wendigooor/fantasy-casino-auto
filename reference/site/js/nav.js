/* ===========================
   Fantasy iGaming — Navigation
   =========================== */

const NAV_SECTIONS = [
  {
    group: 'Core',
    items: [
      { num: '01', title: 'Data Architecture', href: 'data-architecture.html', color: 'purple' },
      { num: '02', title: 'Org Structure', href: 'org-structure.html', color: 'purple' },
      { num: '03', title: 'Data Model', href: 'data-model.html', color: 'purple' },
      { num: '04', title: 'Event Taxonomy', href: 'event-taxonomy.html', color: 'purple' },
      { num: '05', title: 'Metrics Dictionary', href: 'metrics.html', color: 'purple' },
    ]
  },
  {
    group: 'Governance',
    items: [
      { num: '06', title: 'Data Governance', href: 'data-governance.html', color: 'amber' },
      { num: '07', title: 'SLA', href: 'sla.html', color: 'amber' },
    ]
  },
  {
    group: 'Operations',
    items: [
      { num: '08', title: 'DataOps', href: 'dataops.html', color: 'red' },
      { num: '09', title: 'MLOps', href: 'mlops.html', color: 'red' },
      { num: '10', title: 'Data Lineage', href: 'data-lineage.html', color: 'red' },
      { num: '11', title: 'Incident Response', href: 'incident-response.html', color: 'red' },
    ]
  },
  {
    group: 'Practice',
    items: [
      { num: '12', title: 'Dashboards', href: 'dashboards.html', color: 'teal' },
      { num: '13', title: 'A/B Testing', href: 'ab-testing.html', color: 'teal' },
      { num: '14', title: 'Management', href: 'management.html', color: 'teal' },
    ]
  },
  {
    group: 'Advanced',
    items: [
      { num: '15', title: 'Onboarding', href: 'onboarding.html', color: 'blue' },
      { num: '16', title: 'FinOps', href: 'finops.html', color: 'blue' },
      { num: '17', title: 'Roadmap', href: 'roadmap.html', color: 'blue' },
    ]
  },
  {
    group: 'Meta',
    items: [
      { num: '18', title: 'Glossary', href: 'glossary.html', color: 'gray' },
      { num: '19', title: 'About', href: 'about.html', color: 'gray' },
    ]
  }
];

// Flatten for prev/next
const ALL_SECTIONS = NAV_SECTIONS.flatMap(g => g.items);

/**
 * Detect if we are on the index page or inside /pages/
 */
function getBasePath() {
  const path = window.location.pathname;
  if (path.endsWith('index.html') || path.endsWith('/') || !path.includes('/pages/')) {
    return 'pages/';
  }
  return '';
}

function getIndexPath() {
  const path = window.location.pathname;
  if (path.includes('/pages/')) {
    return '../index.html';
  }
  return 'index.html';
}

/**
 * Get current page filename
 */
function getCurrentPage() {
  const path = window.location.pathname;
  const parts = path.split('/');
  return parts[parts.length - 1] || 'index.html';
}

/**
 * Build sidebar HTML
 */
function buildSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  const basePath = getBasePath();
  const indexPath = getIndexPath();
  const currentPage = getCurrentPage();

  let html = `
    <div class="sidebar-header">
      <a href="${indexPath}" class="sidebar-logo">
        <span class="sidebar-logo-main">Fantasy iGaming</span>
        <span class="sidebar-logo-sub">Data Department</span>
      </a>
    </div>
    <nav class="sidebar-nav">
  `;

  for (const group of NAV_SECTIONS) {
    html += `<div class="sidebar-group">`;
    html += `<div class="sidebar-group-title">${group.group}</div>`;
    for (const item of group.items) {
      const isActive = currentPage === item.href ? ' active' : '';
      html += `
        <a href="${basePath}${item.href}" class="sidebar-link${isActive}">
          <span class="sidebar-link-num">${item.num}</span>
          ${item.title}
        </a>
      `;
    }
    html += `</div>`;
  }

  html += `</nav>`;
  html += `
    <div class="sidebar-footer">
      <button class="theme-toggle" onclick="toggleTheme()">
        <span class="theme-icon">
          <span class="theme-icon-moon"></span>
          <span class="theme-icon-sun"></span>
        </span>
        <span class="theme-toggle-label">Сменить тему</span>
      </button>
    </div>
  `;
  sidebar.innerHTML = html;
}

/**
 * Build breadcrumbs
 */
function buildBreadcrumbs() {
  const container = document.querySelector('.breadcrumbs');
  if (!container) return;

  const indexPath = getIndexPath();
  const currentPage = getCurrentPage();
  const section = ALL_SECTIONS.find(s => s.href === currentPage);

  if (!section) return;

  container.innerHTML = `
    <a href="${indexPath}">Fantasy iGaming</a>
    <span class="breadcrumbs-sep">/</span>
    <span class="breadcrumbs-current">${section.title}</span>
  `;
}

/**
 * Build prev/next links
 */
function buildPrevNext() {
  const container = document.querySelector('.prev-next');
  if (!container) return;

  const basePath = getBasePath();
  const currentPage = getCurrentPage();
  const idx = ALL_SECTIONS.findIndex(s => s.href === currentPage);

  if (idx === -1) return;

  let html = '';

  if (idx > 0) {
    const prev = ALL_SECTIONS[idx - 1];
    html += `
      <a href="${basePath}${prev.href}" class="prev-next-link prev">
        <span class="prev-next-label">\u2190 Previous</span>
        <span class="prev-next-title">${prev.num}. ${prev.title}</span>
      </a>
    `;
  }

  if (idx < ALL_SECTIONS.length - 1) {
    const next = ALL_SECTIONS[idx + 1];
    html += `
      <a href="${basePath}${next.href}" class="prev-next-link next">
        <span class="prev-next-label">Next \u2192</span>
        <span class="prev-next-title">${next.num}. ${next.title}</span>
      </a>
    `;
  }

  container.innerHTML = html;
}

/**
 * Burger menu toggle
 */
function initBurger() {
  const burger = document.querySelector('.burger');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');

  if (!burger || !sidebar) return;

  function toggleMenu() {
    const isOpen = sidebar.classList.toggle('open');
    burger.classList.toggle('active', isOpen);
    if (overlay) overlay.classList.toggle('visible', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  }

  function closeMenu() {
    sidebar.classList.remove('open');
    burger.classList.remove('active');
    if (overlay) overlay.classList.remove('visible');
    document.body.style.overflow = '';
  }

  burger.addEventListener('click', toggleMenu);
  if (overlay) overlay.addEventListener('click', closeMenu);

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });
}

/**
 * Accordion toggle
 */
function toggleAccordion(headerEl) {
  const accordion = headerEl.closest('.accordion');
  if (accordion) {
    accordion.classList.toggle('open');
  }
}

/**
 * Theme toggle
 */
function initTheme() {
  const saved = localStorage.getItem('fi-theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('fi-theme', next);
}

// Apply theme immediately (before DOMContentLoaded to prevent flash)
initTheme();

/**
 * Initialize navigation on DOMContentLoaded
 */
document.addEventListener('DOMContentLoaded', () => {
  buildSidebar();
  buildBreadcrumbs();
  buildPrevNext();
  initBurger();
});
