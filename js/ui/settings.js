// "Settings" screen: language, profile, sweep window, backup/restore.

import { h, toast, confirmDialog } from './dom.js';
import { settingsRepo, backup } from '../data/repo.js';
import { todayISO } from '../lib/dates.js';
import { picker } from './departments.js';
import { t, LANGUAGES, getLang, setLang } from '../i18n/index.js';

export const APP_VERSION = 'v2.2.0';

export async function render(root, app) {
  const s = settingsRepo.get();

  // Language applies immediately (no Save needed), like the department picker.
  const langSelect = h('select', {},
    LANGUAGES.map((l) => h('option', { value: l.code, selected: l.code === getLang() }, l.name)));
  langSelect.addEventListener('change', async () => {
    await settingsRepo.update({ lang: langSelect.value });
    setLang(langSelect.value);
    app.rebuildNav();
    app.refresh();
  });

  const userName = h('input', { value: s.userName, placeholder: t('set.name') });
  const storeName = h('input', { value: s.storeName, placeholder: t('set.storeDefault') });
  const deptPicker = await picker(app);
  const cutoff = h('input', { type: 'number', min: '1', max: '60', value: String(s.cutoffDays) });

  const profile = h('form', {
    class: 'card form',
    onsubmit: async (e) => {
      e.preventDefault();
      await settingsRepo.update({
        userName: userName.value.trim(),
        storeName: storeName.value.trim(),
        cutoffDays: Math.max(1, Math.min(60, Number(cutoff.value) || 10)),
      });
      toast(t('set.saved'));
      app.refresh();
    },
  },
  h('h2', {}, t('set.profile')),
  field(t('set.language'), langSelect),
  field(t('set.name'), userName),
  field(t('set.store'), storeName),
  field(t('set.dept'), deptPicker, h('small', { class: 'muted hint' }, t('set.deptHint'))),
  field(t('set.window'), cutoff, h('small', { class: 'muted hint' }, t('set.windowHint'))),
  h('button', { type: 'submit', class: 'btn wide' }, t('common.save')));

  const fileIn = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files?.[0];
    fileIn.value = '';
    if (!f) return;
    try {
      const counts = await backup.import(JSON.parse(await f.text()));
      toast(t('set.restored', { added: counts.added, updated: counts.updated }));
      app.refresh();
    } catch (err) {
      const msg = err.code === 'format' ? t('set.errFormat') : err.code === 'newer' ? t('set.errNewer')
        : err instanceof SyntaxError ? t('set.errFormat') : err.message;
      toast(t('set.importFailed', { msg }));
    }
  });

  const storageInfo = h('p', { class: 'muted' });
  if (navigator.storage?.estimate) {
    Promise.all([navigator.storage.estimate(), navigator.storage.persisted?.()]).then(([est, persisted]) => {
      storageInfo.textContent = `${t('set.storageUsed', { mb: (est.usage / 1048576).toFixed(1) })} `
        + t(persisted ? 'set.persisted' : 'set.notPersisted');
    });
  }

  const data = h('section', { class: 'card' },
    h('h2', {}, t('set.backup')),
    h('p', { class: 'muted' }, t('set.backupHint')),
    storageInfo,
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn', onclick: doExport }, t('set.export')),
      h('button', { type: 'button', class: 'btn secondary', onclick: () => fileIn.click() }, t('set.import')),
      fileIn),
    h('hr'),
    h('button', {
      type: 'button', class: 'btn ghost danger-text', onclick: async () => {
        if (!(await confirmDialog(t('set.wipeConfirm'), { ok: t('set.wipeOk'), danger: true }))) return;
        const keepLang = getLang();
        await backup.wipe();
        await settingsRepo.update({ lang: keepLang });
        toast(t('set.wiped'));
        app.go('sweep');
      },
    }, t('set.wipe')));

  root.replaceChildren(profile, data,
    h('p', { class: 'muted center small' }, t('set.footer', { v: APP_VERSION })));
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
