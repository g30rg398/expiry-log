// "History" screen: what happened to logged items, and past sweeps.
// These numbers are what you show the manager.

import { h, toast } from './dom.js';
import { entries, sweeps } from '../data/repo.js';
import { STATUS } from '../data/schema.js';
import { t } from '../i18n/index.js';
import { fmtDate, fmtDateTime } from '../lib/dates.js';

export async function render(root, app) {
  const [resolved, sweepList] = await Promise.all([entries.listResolved({ sinceDays: 30 }), sweeps.list()]);

  const count = (s) => resolved.filter((e) => e.status === s).length;
  const units = (s) => resolved.filter((e) => e.status === s).reduce((n, e) => n + (e.qty || 1), 0);
  const caughtEarly = resolved.filter((e) => e.status === STATUS.MARKED_DOWN || (e.status === STATUS.PULLED && e.resolvedAt.slice(0, 10) <= e.expiresOn)).length;

  const stats = h('section', { class: 'card' },
    h('h2', {}, t('hist.last30')),
    h('div', { class: 'stats' },
      stat(count(STATUS.PULLED), t('status.pulled'), t('hist.units', { n: units(STATUS.PULLED) })),
      stat(count(STATUS.MARKED_DOWN), t('status.marked_down'), t('hist.units', { n: units(STATUS.MARKED_DOWN) })),
      stat(count(STATUS.SOLD_OUT), t('status.sold_out'), t('hist.beforeDate'))),
    h('p', { class: 'muted' }, t('hist.caught', { n: caughtEarly })));

  const list = h('section', { class: 'card' }, h('h2', {}, t('hist.resolved')));
  if (!resolved.length) list.append(h('p', { class: 'muted' }, t('hist.nothing')));
  for (const e of resolved.slice(0, 100)) {
    list.append(h('div', { class: 'hist-row' },
      h('div', {},
        h('strong', {}, e.productName),
        h('div', { class: 'meta' }, t('hist.row', { date: fmtDate(e.expiresOn), status: t(`status.${e.status}`), when: fmtDateTime(e.resolvedAt) }))),
      h('button', {
        type: 'button', class: 'btn small ghost',
        onclick: async () => { await entries.reopen(e.id); toast(t('hist.reopened')); app.refresh(); },
      }, t('hist.reopen'))));
  }

  const sw = h('section', { class: 'card' }, h('h2', {}, t('hist.sweeps')));
  if (!sweepList.length) sw.append(h('p', { class: 'muted' }, t('hist.noSweeps')));
  for (const s of sweepList) {
    const mins = s.finishedAt ? Math.round((Date.parse(s.finishedAt) - Date.parse(s.startedAt)) / 60000) : null;
    sw.append(h('div', { class: 'hist-row' },
      h('div', {},
        h('strong', {}, fmtDateTime(s.startedAt)),
        h('div', { class: 'meta' },
          t('hist.sweepRow', { logged: s.logged, ok: s.checkedOk, time: mins == null ? t('hist.inProgress') : t('hist.minutes', { n: mins }) })))));
  }

  root.replaceChildren(stats, list, sw);
}

function stat(n, label, sub) {
  return h('div', { class: 'stat' }, h('span', { class: 'big' }, String(n)), h('span', {}, label), h('small', { class: 'muted' }, sub));
}
