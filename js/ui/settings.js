// "Settings" screen: profile, sweep cutoff, backup/restore.

import { h, toast, confirmDialog } from './dom.js';
import { settingsRepo, backup } from '../data/repo.js';
import { todayISO } from '../lib/dates.js';

export async function render(root, app) {
  const s = settingsRepo.get();
  const userName = h('input', { value: s.userName, placeholder: 'Your name' });
  const storeName = h('input', { value: s.storeName });
  const department = h('input', { value: s.department });
  const cutoff = h('input', { type: 'number', min: '1', max: '60', value: String(s.cutoffDays) });

  const profile = h('form', {
    class: 'card form',
    onsubmit: async (e) => {
      e.preventDefault();
      await settingsRepo.update({
        userName: userName.value.trim(),
        storeName: storeName.value.trim() || 'My store',
        department: department.value.trim() || 'dairy',
        cutoffDays: Math.max(1, Math.min(60, Number(cutoff.value) || 10)),
      });
      toast('Settings saved');
      app.refresh();
    },
  },
  h('h2', {}, 'Profile'),
  field('Your name', userName),
  field('Store', storeName),
  field('Department', department, h('small', { class: 'muted hint' }, 'Each department keeps its own list.')),
  field('Sweep window (days)', cutoff, h('small', { class: 'muted hint' }, 'Log items expiring within this many days.')),
  h('button', { type: 'submit', class: 'btn wide' }, 'Save'));

  const fileIn = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files?.[0];
    fileIn.value = '';
    if (!f) return;
    try {
      const counts = await backup.import(JSON.parse(await f.text()));
      toast(`Restored: ${counts.added} new, ${counts.updated} updated`);
      app.refresh();
    } catch (err) {
      toast(`Import failed: ${err.message}`);
    }
  });

  const storageInfo = h('p', { class: 'muted' });
  if (navigator.storage?.estimate) {
    Promise.all([navigator.storage.estimate(), navigator.storage.persisted?.()]).then(([est, persisted]) => {
      storageInfo.textContent = `Using ${(est.usage / 1048576).toFixed(1)} MB on this phone. `
        + (persisted ? 'Storage is protected from automatic clearing.' : 'Install the app to protect storage from clearing.');
    });
  }

  const data = h('section', { class: 'card' },
    h('h2', {}, 'Backup'),
    h('p', { class: 'muted' }, 'Everything lives only on this phone. Export a backup now and then (includes photos).'),
    storageInfo,
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn', onclick: doExport }, 'Export backup'),
      h('button', { type: 'button', class: 'btn secondary', onclick: () => fileIn.click() }, 'Import backup'),
      fileIn),
    h('hr'),
    h('button', {
      type: 'button', class: 'btn ghost danger-text', onclick: async () => {
        if (!(await confirmDialog('Delete ALL data on this phone? Export a backup first.', { ok: 'Delete everything', danger: true }))) return;
        await backup.wipe();
        toast('All data deleted');
        app.go('sweep');
      },
    }, 'Delete all data'));

  root.replaceChildren(profile, data,
    h('p', { class: 'muted center small' }, 'Expiry Tracker v2 · data stays on your device'));
}

async function doExport() {
  const data = await backup.export();
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const name = `expiry-backup-${todayISO()}.json`;
  const file = new File([blob], name, { type: 'application/json' });
  // On Android, the share sheet lets you send it to Drive/email directly.
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function field(label, ...controls) {
  return h('label', { class: 'field' }, h('span', { class: 'label' }, label), ...controls);
}
