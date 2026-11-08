// App shell: tabs + routing. Each screen module exports render(root, app).

import { init, settingsRepo } from './data/repo.js';
import { h } from './ui/dom.js';
import { t, setLang, detectLang } from './i18n/index.js';
import * as sweep from './ui/sweep.js';
import * as due from './ui/due.js';
import * as history from './ui/history.js';
import * as settings from './ui/settings.js';

const TABS = [
  { id: 'sweep', label: 'tab.check', icon: '＋', view: sweep },
  { id: 'due', label: 'tab.due', icon: '⏰', view: due },
  { id: 'history', label: 'tab.history', icon: '📊', view: history },
  { id: 'settings', label: 'tab.settings', icon: '⚙', view: settings },
];

const root = document.getElementById('view');
const nav = document.getElementById('tabs');
const header = document.querySelector('.top h1');
let current = 'due';

const app = {
  async go(id) {
    current = TABS.some((tab) => tab.id === id) ? id : 'due';
    if (location.hash !== `#${current}`) window.history.replaceState(null, '', `#${current}`);
    await app.refresh();
    window.scrollTo(0, 0);
  },
  async refresh() {
    const tab = TABS.find((x) => x.id === current);
    nav.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tab === current));
    await tab.view.render(root, app);
    await updateBadge();
  },
  // Re-draw tab labels and header after a language change.
  rebuildNav() {
    header.textContent = t('app.title');
    nav.replaceChildren(...TABS.map((tab) => h('button', {
      type: 'button', dataset: { tab: tab.id }, onclick: () => app.go(tab.id),
    }, h('span', { class: 'ico' }, tab.icon), h('span', {}, t(tab.label)),
    tab.id === 'due' ? h('span', { class: 'badge', hidden: true }) : null)));
  },
};

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
    setLang(detectLang());
    root.replaceChildren(h('p', { class: 'card' }, t('app.storageError', { msg: err.message })));
    return;
  }
  setLang(settingsRepo.get().lang || detectLang());
  app.rebuildNav();
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
