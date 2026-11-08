// "Check" screen: run a sweep and log items that expire soon.

import { h, toast, blobURL, confirmDialog } from './dom.js';
import { entries, products, photos, sweeps, settingsRepo, departments } from '../data/repo.js';
import { setupCard } from './departments.js';
import { todayISO, addDays, daysUntil, fmtChip } from '../lib/dates.js';
import { t } from '../i18n/index.js';
import { processPhoto } from '../lib/images.js';
import * as scanner from '../lib/scanner.js';
import { lookupBarcode } from '../lib/lookup.js';

// Survives re-renders so a shelf photo + location can carry over to the next item.
const carry = { photoId: null, thumbURL: null, photoLocation: '', location: '', keep: true };

export async function render(root, app) {
  const settings = settingsRepo.get();
  if (!settings.department) { root.replaceChildren(setupCard(app)); return; }
  const dept = await departments.byKey(settings.department);
  settings.deptName = dept?.name || settings.department;
  const sweep = await sweeps.current();
  const [knownProducts, locations] = await Promise.all([products.all(), entries.recentLocations()]);

  root.replaceChildren(
    sweepBar(sweep, app),
    form({ sweep, settings, knownProducts, locations, app }),
  );
}

function sweepBar(sweep, app) {
  if (!sweep) {
    return h('section', { class: 'card sweep-bar idle' },
      h('div', {},
        h('strong', {}, t('sweep.none')),
        h('p', { class: 'muted' }, t('sweep.noneHint'))),
      h('button', {
        type: 'button', class: 'btn', onclick: async () => { await sweeps.start(); app.refresh(); },
      }, t('sweep.start')));
  }
  const counter = h('span', { class: 'big' }, String(sweep.checkedOk));
  return h('section', { class: 'card sweep-bar active' },
    h('div', { class: 'sweep-stats' },
      h('div', {}, h('span', { class: 'big' }, String(sweep.logged)), h('small', {}, t('sweep.logged'))),
      h('div', {}, counter, h('small', {}, t('sweep.checkedOk')))),
    h('div', { class: 'row' },
      h('button', {
        type: 'button', class: 'btn secondary', title: t('sweep.okTitle'),
        onclick: async () => {
          const s = await sweeps.bump(sweep.id, 'checkedOk');
          counter.textContent = String(s.checkedOk);
          if (navigator.vibrate) navigator.vibrate(20);
        },
      }, t('sweep.plusOk')),
      h('button', {
        type: 'button', class: 'btn', onclick: async () => {
          if (!(await confirmDialog(t('sweep.finishConfirm'), { ok: t('sweep.finish') }))) return;
          await sweeps.finish(sweep.id);
          toast(t('sweep.done', { n: sweep.logged }));
          app.go('due');
        },
      }, t('sweep.finish'))));
}

function form({ sweep, settings, knownProducts, locations, app }) {
  const listId = 'product-names';
  const datalist = h('datalist', { id: listId }, knownProducts.map((p) => h('option', { value: p.name })));

  const barcode = h('input', { name: 'barcode', inputmode: 'numeric', placeholder: t('log.barcodePh'), autocomplete: 'off' });
  const name = h('input', { name: 'name', required: true, list: listId, placeholder: t('log.productPh'), autocomplete: 'off' });
  const lookupNote = h('small', { class: 'muted hint' });
  const date = h('input', { name: 'date', type: 'date', required: true, min: addDays(todayISO(), -30) });
  const dateNote = h('small', { class: 'hint' });
  const qty = h('input', { name: 'qty', type: 'number', min: '1', inputmode: 'numeric', placeholder: t('common.optional') });
  const location = h('input', { name: 'location', placeholder: t('log.locationPh'), value: carry.location, autocomplete: 'off' });
  const note = h('input', { name: 'note', placeholder: t('common.optional') });
  const keep = h('input', { type: 'checkbox', checked: carry.keep });

  // --- barcode -> product name ---
  async function onBarcode(code) {
    code = code.trim();
    if (!code) return;
    barcode.value = code;
    const p = await products.findByBarcode(code);
    if (p) { name.value = p.name; lookupNote.textContent = t('log.known'); date.focus(); return; }
    lookupNote.textContent = t('log.lookingUp');
    const hit = await lookupBarcode(code);
    if (hit && !name.value) {
      name.value = hit.name;
      lookupNote.textContent = t('log.fromOff');
    } else {
      lookupNote.textContent = hit ? '' : t('log.newProduct');
    }
    name.focus();
  }
  barcode.addEventListener('change', () => onBarcode(barcode.value));

  const scanBtn = scanner.isSupported()
    ? h('button', {
      type: 'button', class: 'btn secondary', onclick: async () => {
        try {
          const code = await scanner.scan();
          if (code) onBarcode(code);
        } catch (err) {
          toast(err.name === 'NotAllowedError' ? t('log.cameraDenied') : t('log.cameraUnavailable'));
        }
      },
    }, t('log.scan'))
    : null;

  // --- date chips: next 8 days ---
  const chips = h('div', { class: 'chips' });
  for (let i = 0; i <= 7; i++) {
    const iso = addDays(todayISO(), i);
    const label = i === 0 ? t('date.chipToday') : i === 1 ? t('date.chipTomorrow') : fmtChip(iso);
    chips.append(h('button', {
      type: 'button', class: 'chip', dataset: { iso },
      onclick: () => { date.value = iso; onDate(); },
    }, label));
  }
  function onDate() {
    chips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.iso === date.value));
    if (!date.value) { dateNote.textContent = ''; return; }
    const n = daysUntil(date.value);
    dateNote.className = 'hint';
    if (n < 0) { dateNote.textContent = t('log.expired'); dateNote.classList.add('bad'); }
    else if (n > settings.cutoffDays) {
      dateNote.textContent = t('log.beyond', { n: settings.cutoffDays });
      dateNote.classList.add('muted');
    } else dateNote.textContent = '';
  }
  date.addEventListener('change', onDate);

  // --- location chips ---
  const locChips = h('div', { class: 'chips' }, locations.map((l) => h('button', {
    type: 'button', class: 'chip', onclick: () => { location.value = l; },
  }, l)));

  // --- photo ---
  const fileInput = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
  const preview = h('div', { class: 'photo-preview' });
  function showPreview() {
    preview.replaceChildren();
    if (!carry.photoId) {
      preview.append(h('button', { type: 'button', class: 'btn secondary wide', onclick: () => fileInput.click() }, t('log.shelfPhoto')));
      return;
    }
    preview.append(
      h('img', { src: carry.thumbURL, alt: t('log.photoAlt') }),
      h('div', { class: 'col' },
        h('button', { type: 'button', class: 'btn secondary', onclick: () => fileInput.click() }, t('log.retake')),
        h('button', {
          type: 'button', class: 'btn ghost', onclick: () => { carry.photoId = null; carry.thumbURL = null; showPreview(); },
        }, t('log.remove'))));
  }
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    preview.replaceChildren(h('p', { class: 'muted' }, t('log.savingPhoto')));
    try {
      const img = await processPhoto(file);
      carry.photoId = await photos.save(img);
      carry.thumbURL = blobURL(carry.photoId + ':t', img.thumb);
      carry.photoLocation = location.value.trim();
    } catch {
      toast(t('log.photoError'));
    }
    showPreview();
  });
  showPreview();

  // A kept photo belongs to one shelf: moving to a new location drops it.
  function onLocationChange() {
    const loc = location.value.trim();
    if (carry.photoId && carry.photoLocation && loc && loc !== carry.photoLocation) {
      carry.photoId = null;
      carry.thumbURL = null;
      showPreview();
      toast(t('log.newLocation'));
    }
  }
  location.addEventListener('change', onLocationChange);
  locChips.addEventListener('click', onLocationChange);

  // --- submit ---
  const formEl = h('form', { class: 'card form', novalidate: false },
    h('h2', {}, sweep ? t('log.titleSweep') : t('log.title'), h('span', { class: 'pill' }, settings.deptName)),
    field(t('log.barcode'), h('div', { class: 'row' }, barcode, scanBtn)),
    field(t('log.product'), name, lookupNote),
    datalist,
    field(t('log.expires'), chips, date, dateNote),
    h('div', { class: 'grid2' }, field(t('log.qty'), qty), field(t('log.note'), note)),
    field(t('log.location'), location, locChips),
    field(t('log.photo'), preview, fileInput),
    h('label', { class: 'check' }, keep, ' ', t('log.keep')),
    h('button', { type: 'submit', class: 'btn primary wide' }, t('common.save')));

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!name.value.trim() || !date.value) { toast(t('log.required')); return; }
    const saved = await entries.add({
      barcode: barcode.value,
      productName: name.value,
      expiresOn: date.value,
      qty: qty.value,
      location: location.value,
      photoId: carry.photoId,
      note: note.value,
      sweepId: sweep?.id,
    });
    carry.keep = keep.checked;
    if (carry.photoId && !carry.photoLocation) carry.photoLocation = location.value.trim();
    carry.location = keep.checked ? location.value : '';
    if (!keep.checked) { carry.photoId = null; carry.thumbURL = null; }
    toast(t('log.saved', { name: saved.productName }), {
      action: t('common.undo'),
      onAction: async () => { await entries.remove(saved.id); app.refresh(); toast(t('log.removed')); },
    });
    await app.refresh();
    document.querySelector('input[name=barcode]')?.focus({ preventScroll: true });
  });

  return formEl;
}

function field(label, ...controls) {
  return h('div', { class: 'field' }, h('span', { class: 'label' }, label), ...controls);
}
