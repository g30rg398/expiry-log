// Record shapes. Every record carries the same "sync-ready" base fields,
// even while the app is single-user and offline-only:
//   id         UUID, so records made offline on different phones never collide
//   storeId    which store the record belongs to
//   department e.g. "dairy" — lets one backend serve every department later
//   createdBy / updatedBy  user ids
//   createdAt / updatedAt  ISO timestamps; updatedAt drives last-write-wins merges
//   deletedAt  soft delete (null = live). Needed so deletes can sync later.

export const SCHEMA_VERSION = 1;

export const STATUS = Object.freeze({
  OPEN: 'open',               // still on the shelf, being watched
  PULLED: 'pulled',           // removed from shelf (expired / waste)
  MARKED_DOWN: 'marked_down', // discounted to sell before the date
  SOLD_OUT: 'sold_out',       // gone before the date — no action needed
});

export const STATUS_LABEL = {
  open: 'Open',
  pulled: 'Pulled',
  marked_down: 'Marked down',
  sold_out: 'Sold out',
};

export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const nowISO = () => new Date().toISOString();

// ctx = { userId, storeId, department }
function base(ctx) {
  const now = nowISO();
  return {
    id: uuid(),
    storeId: ctx.storeId,
    department: ctx.department,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

// A product = what the barcode identifies (no date). Reused across entries.
export function newProduct(ctx, { barcode = '', name, brand = '' }) {
  return { ...base(ctx), barcode: barcode.trim(), name: name.trim(), brand: brand.trim() };
}

// An entry = one product on one shelf with one expiry date that we are watching.
export function newEntry(ctx, d) {
  return {
    ...base(ctx),
    productId: d.productId || null,
    productName: d.productName.trim(), // denormalized so lists render without joins
    barcode: (d.barcode || '').trim(),
    expiresOn: d.expiresOn,            // 'YYYY-MM-DD' (local date, no time)
    qty: d.qty ? Number(d.qty) : null,
    location: (d.location || '').trim(),
    photoId: d.photoId || null,
    note: (d.note || '').trim(),
    sweepId: d.sweepId || null,
    status: STATUS.OPEN,
    resolvedAt: null,
    resolvedBy: null,
  };
}

// A sweep = one pass through the department checking dates.
export function newSweep(ctx) {
  return { ...base(ctx), startedAt: nowISO(), finishedAt: null, checkedOk: 0, logged: 0 };
}

// Photo metadata; the image blobs live in the same record but are never
// embedded in entries — entries only hold photoId. Later this maps to a file upload.
export function newPhoto(ctx, { blob, thumb, width, height }) {
  return { ...base(ctx), blob, thumb, mime: blob.type, width, height };
}

// Apply a patch and bump the sync fields.
export function touch(ctx, rec, patch = {}) {
  return { ...rec, ...patch, updatedAt: nowISO(), updatedBy: ctx.userId };
}
