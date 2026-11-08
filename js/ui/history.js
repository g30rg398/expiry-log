// "History" screen: what happened to logged items, and past sweeps.
// These numbers are what you show the manager.

import { h, toast } from './dom.js';
import { entries, sweeps } from '../data/repo.js';
import { STATUS, STATUS_LABEL } from '../data/schema.js';
import { fmtDate, fmtDateTime } from '../lib/dates.js';

export async function render(root, app) {
  const [resolved, sweepList] = await Promise.all([entries.listResolved({ sinceDays: 30 }), sweeps.list()]);

  const count = (s) => resolved.filter((e) => e.status === s).length;
  const units = (s) => resolved.filter((e) => e.status === s).reduce((n, e) => n + (e.qty || 1), 0);
  const caughtEarly = resolved.filter((e) => e.status === STATUS.MARKED_DOWN || (e.status === STATUS.PULLED && e.resolvedAt.slice(0, 10) <= e.expiresOn)).length;

  const stats = h('section', { class: 'card' },
    h('h2', {}, 'Last 30 days'),
    h('div', { class: 'stats' },
      stat(count(STATUS.PULLED), 'pulled', `${units(STATUS.PULLED)} units`),
      stat(count(STATUS.MARKED_DOWN), 'marked down', `${units(STATUS.MARKED_DOWN)} units`),
      stat(count(STATUS.SOLD_OUT), 'sold out', 'before date')),
    h('p', { class: 'muted' }, `${caughtEarly} item(s) dealt with on or before their date.`));

  const list = h('section', { class: 'card' }, h('h2', {}, 'Resolved items'));
  if (!resolved.length) list.append(h('p', { class: 'muted' }, 'Nothing yet.'));
  for (const e of resolved.slice(0, 100)) {
    list.append(h('div', { class: 'hist-row' },
      h('div', {},
        h('strong', {}, e.productName),
        h('div', { class: 'meta' }, `exp ${fmtDate(e.expiresOn)} · ${STATUS_LABEL[e.status]} ${fmtDateTime(e.resolvedAt)}`)),
      h('button', {
        type: 'button', class: 'btn small ghost',
        onclick: async () => { await entries.reopen(e.id); toast('Moved back to Due'); app.refresh(); },
      }, 'Reopen')));
  }

  const sw = h('section', { class: 'card' }, h('h2', {}, 'Sweeps'));
  if (!sweepList.length) sw.append(h('p', { class: 'muted' }, 'No sweeps yet.'));
  for (const s of sweepList) {
    const mins = s.finishedAt ? Math.round((Date.parse(s.finishedAt) - Date.parse(s.startedAt)) / 60000) : null;
    sw.append(h('div', { class: 'hist-row' },
      h('div', {},
        h('strong', {}, fmtDateTime(s.startedAt)),
        h('div', { class: 'meta' },
          `${s.logged} logged · ${s.checkedOk} checked OK · ${mins == null ? 'in progress' : `${mins} min`}`))));
  }

  root.replaceChildren(stats, list, sw);
}

function stat(n, label, sub) {
  return h('div', { class: 'stat' }, h('span', { class: 'big' }, String(n)), h('span', {}, label), h('small', { class: 'muted' }, sub));
}
