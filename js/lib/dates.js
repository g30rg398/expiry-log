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
  if (n < -1) return `${-n} days ago`;
  if (n === -1) return 'yesterday';
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  return `in ${n} days`;
}

export function fmtDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function fmtDateTime(isoTs) {
  return new Date(isoTs).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
