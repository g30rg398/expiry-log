import { t } from '../i18n/index.js';

// Tiny DOM helpers. User text is always set via textContent (never innerHTML).

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

let toastTimer;
export function toast(msg, { action, onAction, ms = 3500 } = {}) {
  let t = document.getElementById('toast');
  if (!t) { t = h('div', { id: 'toast', role: 'status' }); document.body.append(t); }
  t.replaceChildren(h('span', {}, msg));
  if (action) {
    t.append(h('button', { type: 'button', onclick: () => { t.classList.remove('show'); onAction(); } }, action));
  }
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

// Generic modal; `build(close)` returns the dialog body. Resolves with close(value).
export function modal(build, { className = '' } = {}) {
  return new Promise((resolve) => {
    const dlg = h('dialog', { class: `modal ${className}` });
    const close = (v) => { dlg.close(); dlg.remove(); resolve(v); };
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(undefined); });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(undefined); });
    dlg.append(build(close));
    document.body.append(dlg);
    dlg.showModal();
  });
}

export function confirmDialog(message, { ok = t('common.ok'), danger = false } = {}) {
  return modal((close) => h('div', { class: 'modal-body' },
    h('p', {}, message),
    h('div', { class: 'row end' },
      h('button', { type: 'button', class: 'btn secondary', onclick: () => close(false) }, t('common.cancel')),
      h('button', { type: 'button', class: `btn ${danger ? 'danger' : ''}`, onclick: () => close(true) }, ok))));
}

// Object URLs for photo blobs, cached per photo id for the life of the page.
const urlCache = new Map();
export function blobURL(key, blob) {
  if (!blob) return null;
  if (!urlCache.has(key)) urlCache.set(key, URL.createObjectURL(blob));
  return urlCache.get(key);
}
