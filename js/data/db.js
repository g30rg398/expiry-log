// Thin promise wrapper around IndexedDB. Only repo.js should import this.

const DB_NAME = 'expiry-tracker-v2';
const DB_VERSION = 2;

export const S = Object.freeze({
  departments: 'departments',
  products: 'products',
  entries: 'entries',
  sweeps: 'sweeps',
  photos: 'photos',
  meta: 'meta', // key/value settings
});

let dbPromise;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      // Add future migrations as `if (e.oldVersion < 2) {...}` blocks.
      if (e.oldVersion < 1) {
        const p = db.createObjectStore(S.products, { keyPath: 'id' });
        p.createIndex('barcode', 'barcode');
        const en = db.createObjectStore(S.entries, { keyPath: 'id' });
        en.createIndex('status', 'status');
        en.createIndex('expiresOn', 'expiresOn');
        db.createObjectStore(S.sweeps, { keyPath: 'id' });
        db.createObjectStore(S.photos, { keyPath: 'id' });
        db.createObjectStore(S.meta, { keyPath: 'key' });
      }
      if (e.oldVersion < 2) {
        db.createObjectStore(S.departments, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name, mode = 'readonly') {
  const db = await openDB();
  return db.transaction(name, mode).objectStore(name);
}

export async function get(name, key) {
  return wrap((await store(name)).get(key));
}

export async function getAll(name) {
  return wrap((await store(name)).getAll());
}

export async function getAllByIndex(name, index, value) {
  return wrap((await store(name)).index(index).getAll(value));
}

export async function put(name, value) {
  return wrap((await store(name, 'readwrite')).put(value));
}

export async function putMany(name, values) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(name, 'readwrite');
    const os = t.objectStore(name);
    values.forEach((v) => os.put(v));
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function del(name, key) {
  return wrap((await store(name, 'readwrite')).delete(key));
}

export async function clearAll() {
  const db = await openDB();
  const names = Object.values(S);
  return new Promise((resolve, reject) => {
    const t = db.transaction(names, 'readwrite');
    names.forEach((n) => t.objectStore(n).clear());
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
