// "Due" screen: open items grouped by how soon they expire, with actions.

import { h, toast, modal, blobURL, confirmDialog } from './dom.js';
import { entries, photos } from '../data/repo.js';
import { STATUS, STATUS_LABEL } from '../data/schema.js';
import { daysUntil, relLabel, fmtDate } from '../lib/dates.js';

const GROUPS = [
  { key: 'expired', title: 'Expired — pull now', test: (n) => n < 0, cls: 'bad' },
  { key: 'today', title: 'Today', test: (n) => n === 0, cls: 'bad' },
  { key: 'tomorrow', title: 'Tomorrow', test: (n) => n === 1, cls: 'warn' },
  { key: 'week', title: 'Next 7 days', test: (n) => n >= 2 && n <= 7, cls: 'warn' },
  { key: 'later', title: 'Later', test: (n) => n > 7, cls: '' },
];

export async function urgentCount() {
  return (await entries.listOpen()).filter((e) => daysUntil(e.expiresOn) <= 1).length;
}

export async function render(root, app) {
  const open = await entries.listOpen();
  if (!open.length) {
    root.replaceChildren(h('section', { class: 'empty' },
      h('p', { class: 'big' }, '✓'),
      h('p', {}, 'Nothing being watched.'),
      h('p', { class: 'muted' }, 'Items you log during a sweep show up here, soonest first.')));
    return;
  }

  const sections = [];
  for (const g of GROUPS) {
    const rows = open.filter((e) => g.test(daysUntil(e.expiresOn)));
    if (!rows.length) continue;
    const cards = await Promise.all(rows.map((e) => card(e, g, app)));
    sections.push(h('section', { class: `group ${g.cls}` },
      h('h2', {}, g.title, h('span', { class: 'count' }, String(rows.length))),
      cards));
  }
  root.replaceChildren(...sections);
}

async function card(e, g, app) {
  const photo = await photos.get(e.photoId);
  const thumb = photo
    ? h('img', {
      class: 'thumb', src: blobURL(photo.id + ':t', photo.thumb || photo.blob), alt: 'Shelf photo',
      onclick: () => showPhoto(photo, e),
    })
    : h('div', { class: 'thumb none' }, '—');

  const resolve = (status) => async () => {
    await entries.resolve(e.id, status);
    toast(`${STATUS_LABEL[status]}: ${e.productName}`, {
      action: 'Undo',
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
        h('button', { type: 'button', class: 'btn small', onclick: resolve(STATUS.PULLED) }, 'Pulled'),
        h('button', { type: 'button', class: 'btn small secondary', onclick: resolve(STATUS.MARKED_DOWN) }, 'Marked down'),
        h('button', { type: 'button', class: 'btn small secondary', onclick: resolve(STATUS.SOLD_OUT) }, 'Sold out'),
        h('button', { type: 'button', class: 'btn small ghost', onclick: () => edit(e, app), 'aria-label': 'Edit' }, '✎'))));
}

function showPhoto(photo, e) {
  modal((close) => h('div', { class: 'photo-full', onclick: () => close() },
    h('img', { src: blobURL(photo.id, photo.blob), alt: 'Shelf photo' }),
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
  h('label', { class: 'field' }, h('span', { class: 'label' }, 'Expires'), date),
  h('label', { class: 'field' }, h('span', { class: 'label' }, 'Qty'), qty),
  h('label', { class: 'field' }, h('span', { class: 'label' }, 'Location'), loc),
  h('label', { class: 'field' }, h('span', { class: 'label' }, 'Note'), note),
  h('div', { class: 'row between' },
    h('button', { type: 'button', class: 'btn ghost danger-text', onclick: () => close('delete') }, 'Delete'),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn secondary', onclick: () => close() }, 'Cancel'),
      h('button', { type: 'submit', class: 'btn' }, 'Save')))));

  if (result === 'save' && date.value) {
    await entries.update(e.id, {
      expiresOn: date.value,
      qty: qty.value ? Number(qty.value) : null,
      location: loc.value.trim(),
      note: note.value.trim(),
    });
    toast('Updated');
    app.refresh();
  } else if (result === 'delete') {
    if (await confirmDialog(`Delete "${e.productName}"? Use this for mistakes, not for pulled items.`, { ok: 'Delete', danger: true })) {
      await entries.remove(e.id);
      toast('Deleted');
      app.refresh();
    }
  }
}
