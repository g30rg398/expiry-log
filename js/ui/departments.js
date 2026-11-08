// Department picker + first-run setup, shared by Settings / Check / Due.

import { h, toast } from './dom.js';
import { departments, settingsRepo } from '../data/repo.js';

const NEW = '__new__';

// Shown when no department has been created yet.
export function setupCard(app) {
  const input = h('input', { placeholder: 'e.g. Dairy', autocomplete: 'off', required: true });
  return h('form', {
    class: 'card form',
    onsubmit: async (e) => {
      e.preventDefault();
      if (!input.value.trim()) return;
      const d = await departments.create(input.value);
      await departments.select(d.key);
      toast(`Department "${d.name}" created`);
      app.refresh();
    },
  },
  h('h2', {}, 'Create your department'),
  h('p', { class: 'muted' }, 'Items are tracked per department. Start with the one you work in; you can add more later in Settings.'),
  input,
  h('button', { type: 'submit', class: 'btn wide' }, 'Create'));
}

// <select> of existing departments + "New department…", applied immediately.
export async function picker(app) {
  const list = await departments.list();
  const current = settingsRepo.get().department;
  const select = h('select', {},
    list.map((d) => h('option', { value: d.key, selected: d.key === current }, d.name)),
    h('option', { value: NEW }, '＋ New department…'));

  const newInput = h('input', { placeholder: 'New department name', autocomplete: 'off' });
  const newRow = h('div', { class: 'row', hidden: list.length > 0 },
    newInput,
    h('button', {
      type: 'button', class: 'btn', onclick: async () => {
        if (!newInput.value.trim()) { newInput.focus(); return; }
        const d = await departments.create(newInput.value);
        await departments.select(d.key);
        toast(`Switched to ${d.name}`);
        app.refresh();
      },
    }, 'Add'),
    h('button', {
      type: 'button', class: 'btn ghost', onclick: () => { select.value = current; newRow.hidden = true; },
    }, 'Cancel'));

  select.addEventListener('change', async () => {
    if (select.value === NEW) { newRow.hidden = false; newInput.focus(); return; }
    newRow.hidden = true;
    await departments.select(select.value);
    toast(`Switched to ${select.selectedOptions[0].textContent}`);
    app.refresh();
  });

  return h('div', { class: 'col' }, select, newRow);
}
