# Expiry Tracker v2 — weekly sweep version

Single-user, offline PWA for the dairy department. Once a week, walk the case,
log only the items that expire soon (with a shelf photo), and work the **Due**
list as the dates come up.

## Screens
- **Check** — Start a sweep, then for each soon-to-expire item: scan/type the barcode,
  name, date (one-tap chips for the next 7 days), location, and an optional shelf photo.
  "Keep photo & location" carries the shelf photo to the next item; changing the
  location drops it. Use **+1 OK** to count items whose dates are fine.
- **Due** — Open items grouped: Expired / Today / Tomorrow / Next 7 days / Later.
  Mark each one **Pulled**, **Marked down**, or **Sold out** (all have Undo). Tap the photo to enlarge it.
- **History** — 30-day totals, resolved items (with Reopen), and past sweeps. These are your numbers for the manager.
- **Settings** — name, store, department, sweep window (default 10 days), backup export/import.

## Deploy (GitHub Pages, same as before)
Upload the contents of this folder to the repo root (or a `/v2` folder), then open it in Chrome on Android
and choose **Install app**. Must be served over HTTPS (Pages does this) for the camera and offline mode to work.

**After any code change**, bump `VERSION` in `sw.js`. Phones load the new version on the next launch.

This version uses a new database (`expiry-tracker-v2`), so it won't touch data from Prototype 1.

## Structure

```
index.html, manifest.webmanifest, sw.js, css/, icons/
js/
  app.js            tabs + routing
  data/
    schema.js       record shapes + sync-ready base fields
    db.js           IndexedDB wrapper (only repo.js uses it)
    repo.js         THE data API — the only thing screens call
  lib/              dates, image resizing, barcode scanner, Open Food Facts lookup
  ui/               one module per screen: sweep, due, history, settings
```

### Designed for the multi-user version
- **Every record** has `id` (UUID), `storeId`, `department`, `createdBy/updatedBy`,
  `createdAt/updatedAt`, and `deletedAt` (soft delete). Nothing needs migrating to sync.
- **Screens never touch storage.** They call `repo.entries.add()`, `repo.entries.listOpen()` and so on.
  To add a backend, reimplement those functions to call the API, keeping IndexedDB as an
  offline cache plus an outbox of unsent changes. The UI doesn't change.
- **Photos are separate records**; entries only store `photoId`. On a server they become file uploads.
- **Merging** (backup import) uses last-write-wins by `updatedAt` per record, the same rule sync will use.
- **Department scoping** is already applied in every list. `listOpen({ allDepartments: true })`
  is the hook for a manager view.

### Mapping to PocketBase later
| Local store | PocketBase collection | Notes |
|---|---|---|
| products | `products` | unique (storeId, barcode) |
| entries | `entries` | relation → products, photos; rule: same store & department |
| sweeps | `sweeps` | |
| photos | `photos` | `file` field for blob + thumb |
| meta.userId/storeId | `users` (auth) / `stores` | role: employee \| manager; department field |

Still to add then: a login screen, a department switcher for managers, and a sync loop
(push the outbox, pull records with `updated > lastSync`).
