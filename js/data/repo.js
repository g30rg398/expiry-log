// The repository: the ONLY module the UI talks to for data.
//
// Today every method reads/writes IndexedDB on the phone. When a backend
// (e.g. PocketBase) is added, these same method names get a second
// implementation that calls the API and keeps IndexedDB as an offline cache.
// The screens in js/ui/ don't change.

import * as db from './db.js';
import { S } from './db.js';
import {
  SCHEMA_VERSION, STATUS, uuid, nowISO, touch,
  newProduct, newEntry, newSweep, newPhoto,
} from './schema.js';

const DEFAULT_SETTINGS = {
  userName: '',
  storeName: 'My store',
  department: 'dairy',
  cutoffDays: 10, // log items expiring within this many days of the sweep
};

let settings = null; // cached
let ctx = null;      // { userId, storeId, department }

const live = (r) => !r.deletedAt;
const inScope = (r) => r.storeId === ctx.storeId && r.department === ctx.department;

async function metaGet(key) {
  return (await db.get(S.meta, key))?.value;
}
async function metaSet(key, value) {
  return db.put(S.meta, { key, value });
}

export async function init() {
  await db.openDB();
  // Identity is created once per device; a real login replaces these ids later.
  let userId = await metaGet('userId');
  if (!userId) { userId = uuid(); await metaSet('userId', userId); }
  let storeId = await metaGet('storeId');
  if (!storeId) { storeId = uuid(); await metaSet('storeId', storeId); }
  await metaSet('schemaVersion', SCHEMA_VERSION);
  settings = { ...DEFAULT_SETTINGS, ...((await metaGet('settings')) || {}) };
  ctx = { userId, storeId, department: settings.department };
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
}

// ---------- settings ----------
export const settingsRepo = {
  get: () => ({ ...settings }),
  ctx: () => ({ ...ctx }),
  async update(patch) {
    settings = { ...settings, ...patch };
    if (patch.department) settings.department = patch.department.trim().toLowerCase();
    ctx = { ...ctx, department: settings.department };
    await metaSet('settings', settings);
    return { ...settings };
  },
};

// ---------- products ----------
export const products = {
  async all() {
    return (await db.getAll(S.products)).filter((p) => live(p) && p.storeId === ctx.storeId);
  },
  async findByBarcode(code) {
    if (!code) return null;
    const hits = await db.getAllByIndex(S.products, 'barcode', code.trim());
    return hits.find((p) => live(p) && p.storeId === ctx.storeId) || null;
  },
  async findByName(name) {
    const n = name.trim().toLowerCase();
    return (await products.all()).find((p) => p.name.toLowerCase() === n) || null;
  },
  // Create or update the product for a barcode/name; returns the product.
  async upsert({ barcode = '', name, brand = '' }) {
    let p = (await products.findByBarcode(barcode)) || (!barcode && (await products.findByName(name)));
    if (p) {
      const changed = p.name !== name.trim() || (barcode && p.barcode !== barcode.trim());
      if (changed) {
        p = touch(ctx, p, { name: name.trim(), barcode: barcode.trim() || p.barcode });
        await db.put(S.products, p);
      }
      return p;
    }
    p = newProduct(ctx, { barcode, name, brand });
    await db.put(S.products, p);
    return p;
  },
};

// ---------- photos ----------
export const photos = {
  async save({ blob, thumb, width, height }) {
    const p = newPhoto(ctx, { blob, thumb, width, height });
    await db.put(S.photos, p);
    return p.id;
  },
  async get(id) {
    if (!id) return null;
    const p = await db.get(S.photos, id);
    return p && live(p) ? p : null;
  },
  // Delete only if no live entry still uses it (one shelf photo can cover many items).
  async removeIfUnused(id) {
    if (!id) return;
    const users = (await db.getAll(S.entries)).filter((e) => live(e) && e.photoId === id);
    if (users.length === 0) await db.del(S.photos, id);
  },
};

// ---------- entries ----------
export const entries = {
  async get(id) {
    return db.get(S.entries, id);
  },
  async add(data) {
    const product = await products.upsert({ barcode: data.barcode, name: data.productName });
    const e = newEntry(ctx, { ...data, productId: product.id, productName: product.name });
    await db.put(S.entries, e);
    if (e.sweepId) await sweeps.bump(e.sweepId, 'logged');
    return e;
  },
  async update(id, patch) {
    const e = await db.get(S.entries, id);
    if (!e) throw new Error('Entry not found');
    const next = touch(ctx, e, patch);
    await db.put(S.entries, next);
    return next;
  },
  async resolve(id, status) {
    return entries.update(id, { status, resolvedAt: nowISO(), resolvedBy: ctx.userId });
  },
  async reopen(id) {
    return entries.update(id, { status: STATUS.OPEN, resolvedAt: null, resolvedBy: null });
  },
  async remove(id) {
    const e = await entries.update(id, { deletedAt: nowISO() });
    if (e.sweepId) await sweeps.bump(e.sweepId, 'logged', -1);
    await photos.removeIfUnused(e.photoId);
  },
  // opts.allDepartments is the hook for a future manager view.
  async listOpen(opts = {}) {
    const rows = await db.getAllByIndex(S.entries, 'status', STATUS.OPEN);
    return rows
      .filter((e) => live(e) && (opts.allDepartments ? e.storeId === ctx.storeId : inScope(e)))
      .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn));
  },
  async listResolved({ sinceDays = 30 } = {}) {
    const since = Date.now() - sinceDays * 864e5;
    return (await db.getAll(S.entries))
      .filter((e) => live(e) && inScope(e) && e.status !== STATUS.OPEN && Date.parse(e.resolvedAt) >= since)
      .sort((a, b) => b.resolvedAt.localeCompare(a.resolvedAt));
  },
  async recentLocations(limit = 8) {
    const rows = (await db.getAll(S.entries)).filter((e) => live(e) && inScope(e) && e.location);
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return [...new Set(rows.map((e) => e.location))].slice(0, limit);
  },
};

// ---------- sweeps ----------
export const sweeps = {
  async current() {
    return (await db.getAll(S.sweeps)).find((s) => live(s) && inScope(s) && !s.finishedAt) || null;
  },
  async start() {
    const existing = await sweeps.current();
    if (existing) return existing;
    const s = newSweep(ctx);
    await db.put(S.sweeps, s);
    return s;
  },
  async bump(id, field, by = 1) {
    const s = await db.get(S.sweeps, id);
    if (!s) return null;
    const next = touch(ctx, s, { [field]: (s[field] || 0) + by });
    await db.put(S.sweeps, next);
    return next;
  },
  async finish(id) {
    const s = await db.get(S.sweeps, id);
    const next = touch(ctx, s, { finishedAt: nowISO() });
    await db.put(S.sweeps, next);
    return next;
  },
  async list(limit = 20) {
    return (await db.getAll(S.sweeps))
      .filter((s) => live(s) && inScope(s))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, limit);
  },
};

// ---------- backup ----------
// The merge rule here (newer updatedAt wins, per record id) is the same rule
// a future sync will use, so backups double as a test of sync behaviour.

const blobToDataURL = (b) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(b);
});
const dataURLToBlob = async (u) => (await fetch(u)).blob();

export const backup = {
  async export() {
    const photoRows = await db.getAll(S.photos);
    const photoOut = [];
    for (const p of photoRows) {
      const { blob, thumb, ...rest } = p;
      photoOut.push({ ...rest, blob: await blobToDataURL(blob), thumb: thumb ? await blobToDataURL(thumb) : null });
    }
    return {
      format: 'expiry-tracker-backup',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: nowISO(),
      meta: { userId: ctx.userId, storeId: ctx.storeId, settings },
      products: await db.getAll(S.products),
      entries: await db.getAll(S.entries),
      sweeps: await db.getAll(S.sweeps),
      photos: photoOut,
    };
  },
  async import(data) {
    if (data?.format !== 'expiry-tracker-backup') throw new Error('Not a backup file from this app');
    if (data.schemaVersion > SCHEMA_VERSION) throw new Error('Backup is from a newer app version');
    const counts = { added: 0, updated: 0, skipped: 0 };
    const merge = async (name, rows, prepare = (r) => r) => {
      for (const r of rows || []) {
        const cur = await db.get(name, r.id);
        if (cur && cur.updatedAt >= r.updatedAt) { counts.skipped++; continue; }
        await db.put(name, await prepare(r));
        counts[cur ? 'updated' : 'added']++;
      }
    };
    await merge(S.products, data.products);
    await merge(S.sweeps, data.sweeps);
    await merge(S.photos, data.photos, async (p) => ({
      ...p,
      blob: await dataURLToBlob(p.blob),
      thumb: p.thumb ? await dataURLToBlob(p.thumb) : null,
    }));
    await merge(S.entries, data.entries);
    // Adopt the backup's store id on a fresh device so its records are in scope.
    const hasOwn = (await db.getAll(S.entries)).some((e) => e.storeId === ctx.storeId);
    if (!hasOwn && data.meta?.storeId) {
      await metaSet('storeId', data.meta.storeId);
      ctx.storeId = data.meta.storeId;
    }
    return counts;
  },
  async wipe() {
    await db.clearAll();
    settings = null;
    await init();
  },
};
