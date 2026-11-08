import { t, locale } from '../i18n/index.js';

// Dates are stored as local 'YYYY-MM-DD' strings (what's printed on the package).

const pad = (n) => String(n).padStart(2, '0');

export function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const todayISO = () => toISODate(new Date());

export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return toISODate(new Date(y, m - 1, d + n));
}

// Whole days from today until iso (negative = already past).
export function daysUntil(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date();
  const a = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
  const b = Date.UTC(y, m - 1, d);
  return Math.round((b - a) / 864e5);
}

export function relLabel(iso) {
  const n = daysUntil(iso);
  if (n < -1) return t('date.daysAgo', { n: -n });
  if (n === -1) return t('date.yesterday');
  if (n === 0) return t('date.today');
  if (n === 1) return t('date.tomorrow');
  return t('date.inDays', { n });
}

const parse = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };

export function fmtDate(iso) {
  return parse(iso).toLocaleDateString(locale(), { weekday: 'short', month: 'short', day: 'numeric' });
}

// Short chip label like "Mon 9" / "пн 9".
export function fmtChip(iso) {
  const d = parse(iso);
  return `${d.toLocaleDateString(locale(), { weekday: 'short' })} ${d.getDate()}`;
}

export function fmtDateTime(isoTs) {
  return new Date(isoTs).toLocaleString(locale(), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
