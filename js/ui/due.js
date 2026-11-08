// "Due" screen: open items grouped by how soon they expire, with actions.

import { h, toast, modal, blobURL, confirmDialog } from './dom.js';
import { entries, photos, departments, settingsRepo } from '../data/repo.js';
import { setupCard } from './departments.js';
import { STATUS } from '../data/schema.js';
import { t } from '../i18n/index.js';
import { daysUntil, relLabel, fmtDate } from '../lib/dates.js';

const GROUPS = [
  { key: 'expired', title: 'due.expired', test: (n) => n < 0, cls: 'bad' },
  { key: 'today', title: 'due.today', test: (n) => n === 0, cls: 'bad' },
  { key: 'tomorrow', title: 'due.tomorrow', test: (n) => n === 1, cls: 'warn' },
  { key: 'week', title: 'due.week', test: (n) => n >= 2 && n <= 7, cls: 'warn' },
  { key: 'later', title: 'due.later', test: (n) => n > 7, cls: '' },
];

// "All departments" is a view filter here, not a setting: logging always needs one department.
const showAll = () => settingsRepo.get().dueView === 'all';

export async function urgentCount() {
  if (!settingsRepo.get().department) return 0;
  return (await entries.listOpen({ allDepartments: showAll() })).filter((e) => daysUntil(e.expiresOn) <= 1).length;
}

export async function render(root, app) {
  const s = settingsRepo.get();
  if (!s.department) { root.replaceChildren(setupCard(app)); return; }

  const depts = await departments.list();
  const mine = depts.find((d) => d.key === s.department);
  const all = showAll() && depts.length > 1;
  const open = await entries.listOpen({ allDepartments: all });

  const out = [];
  if (depts.length > 1) out.push(viewSwitch(mine?.name || s.department, all, app));

  if (!open.length) {
    out.push(h('section', { class: 'empty' },
      h('p', { class: 'big' }, '✓'),
      h('p', {}, t('due.emptyTitle')),
      h('p', { class: 'muted' }, t('due.emptyHint'))));
    root.replaceChildren(...out);
    return;
  }

  if (!all) {
    out.push(...(await urgencyGroups(open, app, 'h2')));
  } else {
    // One block per department (mine first), each with its own urgency groups.
    const order = [mine, ...depts.filter((d) => d !== mine)].filter(Boolean);
    for (const d of order) {
      const rows = open.filter((e) => e.department === d.key);
      const urgent = rows.filter((e) => daysUntil(e.expiresOn) <= 1).length;
      const block = h('details', { class: 'dept-block', open: rows.length > 0 },
        h('summary', {},
          h('span', { class: 'dept-name' }, d.name, d === mine ? h('span', { class: 'pill' }, t('due.mine')) : null),
          h('span', { class: 'muted small' }, rows.length ? t('due.open', { n: rows.length }) : t('due.nothingOpen')),
          urgent ? h('span', { class: 'badge-inline' }, t('due.urgent', { n: urgent })) : null));
      if (rows.length) block.append(...(await urgencyGroups(rows, app, 'h3')));
      out.push(block);
    }
  }
  root.replaceChildren(...out);
}

function viewSwitch(myName, all, app) {
  const set = (v) => async () => { await settingsRepo.update({ dueView: v }); app.refresh(); };
  return h('div', { class: 'segmented' },
    h('button', { type: 'button', class: all ? '' : 'on', onclick: set('mine') }, myName),
    h('button', { type: 'button', class: all ? 'on' : '', onclick: set('all') }, t('due.all')));
}

async function urgencyGroups(rows, app, tag) {
  const sections = [];
  for (const g of GROUPS) {
    const sub = rows.filter((e) => g.test(daysUntil(e.expiresOn)));
    if (!sub.length) continue;
    const cards = await Promise.all(sub.map((e) => card(e, g, app)));
    sections.push(h('section', { class: `group ${g.cls}` },
      h(tag, { class: 'group-title' }, t(g.title), h('span', { class: 'count' }, String(sub.length))),
      cards));
  }
  return sections;
}

async function card(e, g, app) {
  const photo = await photos.get(e.photoId);
  const thumb = photo
    ? h('img', {
      class: 'thumb', src: blobURL(photo.id + ':t', photo.thumb || photo.blob), alt: t('log.photoAlt'),
      onclick: () => showPhoto(photo, e),
    })
    : h('div', { class: 'thumb none' }, '—');

  const resolve = (status) => async () => {
    await entries.resolve(e.id, status);
    toast(t('due.statusToast', { status: t(`status.${status}`), name: e.productName }), {
      action: t('common.undo'),
      onAction: async () => { await entries.reopen(e.id); app.refresh(); },
    });
    app.refresh();
  };

  return h('article', { class: `item ${g.cls}` },
    thumb,
    h('div', { class: 'item-main' },
      h('strong', {}, e.productName),
      h('div', { class: 'meta' },
        h('span', { class: 'when' }, `${fmtDate(e.expiresOn)} · ${relLabel(e.expiresOn)}`),
        e.qty ? h('span', {}, `× ${e.qty}`) : null),
      e.location ? h('div', { class: 'meta' }, '📍 ', e.location) : null,
      e.note ? h('div', { class: 'meta muted' }, e.note) : null,
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn small', onclick: resolve(STATUS.PULLED) }, t('status.pulled')),
        h('button', { type: 'button', class: 'btn small secondary', onclick: resolve(STATUS.MARKED_DOWN) }, t('status.marked_down')),
        h('button', { type: 'button', class: 'btn small secondary', onclick: resolve(STATUS.SOLD_OUT) }, t('status.sold_out')),
        h('button', { type: 'button', class: 'btn small ghost', onclick: () => edit(e, app), 'aria-label': t('due.edit') }, '✎'))));
}

function showPhoto(photo, e) {
  modal((close) => h('div', { class: 'photo-full', onclick: () => close() },
    h('img', { src: blobURL(photo.id, photo.blob), alt: t('log.photoAlt') }),
    h('p', {}, e.productName, e.location ? ` — ${e.location}` : '')), { className: 'photo-modal' });
}

async function edit(e, app) {
  const date = h('input', { type: 'date', value: e.expiresOn, required: true });
  const qty = h('input', { type: 'number', min: '1', value: e.qty ?? '' });
  const loc = h('input', { value: e.location });
  const note = h('input', { value: e.note });

  const result = await modal((close) => h('form', {
    class: 'modal-body',
    onsubmit: (ev) => { ev.preventDefault(); close('save'); },
  },
  h('h2', {}, e.productName),
  h('label', { class: 'field' }, h('span', { class: 'label' }, t('log.expires')), date),
  h('label', { class: 'field' }, h('span', { class: 'label' }, t('log.qty')), qty),
  h('label', { class: 'field' }, h('span', { class: 'label' }, t('log.location')), loc),
  h('label', { class: 'field' }, h('span', { class: 'label' }, t('log.note')), note),
  h('div', { class: 'row between' },
    h('button', { type: 'button', class: 'btn ghost danger-text', onclick: () => close('delete') }, t('common.delete')),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn secondary', onclick: () => close() }, t('common.cancel')),
      h('button', { type: 'submit', class: 'btn' }, t('common.save'))))));

  if (result === 'save' && date.value) {
    await entries.update(e.id, {
      expiresOn: date.value,
      qty: qty.value ? Number(qty.value) : null,
      location: loc.value.trim(),
      note: note.value.trim(),
    });
    toast(t('due.updated'));
    app.refresh();
  } else if (result === 'delete') {
    if (await confirmDialog(t('due.deleteConfirm', { name: e.productName }), { ok: t('common.delete'), danger: true })) {
      await entries.remove(e.id);
      toast(t('due.deleted'));
      app.refresh();
    }
  }
}
