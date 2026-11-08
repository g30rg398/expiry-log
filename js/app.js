// App shell: tabs + routing. Each screen module exports render(root, app).

import { init } from './data/repo.js';
import { h } from './ui/dom.js';
import * as sweep from './ui/sweep.js';
import * as due from './ui/due.js';
import * as history from './ui/history.js';
import * as settings from './ui/settings.js';

const TABS = [
  { id: 'sweep', label: 'Check', icon: '＋', view: sweep },
  { id: 'due', label: 'Due', icon: '⏰', view: due },
  { id: 'history', label: 'History', icon: '📊', view: history },
  { id: 'settings', label: 'Settings', icon: '⚙', view: settings },
];

const root = document.getElementById('view');
const nav = document.getElementById('tabs');
let current = 'due';

const app = {
  async go(id) {
    current = TABS.some((t) => t.id === id) ? id : 'due';
    if (location.hash !== `#${current}`) history_replace(current);
    await app.refresh();
    window.scrollTo(0, 0);
  },
  async refresh() {
    const tab = TABS.find((t) => t.id === current);
    nav.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tab === current));
    await tab.view.render(root, app);
    await updateBadge();
  },
};

function history_replace(id) {
  window.history.replaceState(null, '', `#${id}`);
}

async function updateBadge() {
  const n = await due.urgentCount();
  const badge = nav.querySelector('[data-tab=due] .badge');
  badge.textContent = n ? String(n) : '';
  badge.hidden = !n;
  if ('setAppBadge' in navigator) (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
}

async function start() {
  try {
    await init();
  } catch (err) {
    root.replaceChildren(h('p', { class: 'card' }, `Could not open storage: ${err.message}`));
    return;
  }
  nav.replaceChildren(...TABS.map((t) => h('button', {
    type: 'button', dataset: { tab: t.id }, onclick: () => app.go(t.id),
  }, h('span', { class: 'ico' }, t.icon), h('span', {}, t.label), t.id === 'due' ? h('span', { class: 'badge', hidden: true }) : null)));

  await app.go(location.hash.slice(1) || 'due');

  // Dates roll over at midnight; refresh when the app comes back to the foreground.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && current !== 'sweep') app.refresh();
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

start();
