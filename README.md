# Dairy Expiry Log

Offline-first expiry tracker for a dairy stocker. No backend, no build step: plain HTML, CSS and JavaScript.

## Files

- `index.html`: the whole app
- `sw.js`: service worker that makes it work with no signal
- `manifest.webmanifest`, `icon-192.png`, `icon-512.png`: make it installable on Android

## Host it (free, HTTPS is required for install and offline)

**Cloudflare Pages:** create a project, choose "Direct upload", and drop this folder in.
**GitHub Pages:** put these files in a repo, then Settings > Pages > deploy from the main branch.

## Install on Android

1. Open the hosted address in Chrome while you have signal.
2. Menu > "Install app" (or "Add to Home screen").
3. Open it once from the home screen. After that it works with no connection.

## Using it

- **Receive:** scan or type the barcode, pick the product, set the date on the package and the number of cases. Entering the same product and date again adds to the existing batch.
- **Pull list:** oldest dates first. Tap Pulled or Sold out. Undo appears for a few seconds.
- **History:** weekly totals, restore a batch, export or import a backup file.

## Notes

- Data is stored in the browser on that phone only. Export a backup every so often.
- Barcode scanning uses the browser's built-in detector (Chrome on Android). If it is missing, type the barcode.
- To ship an update, change `CACHE` in `sw.js` (for example to `expiry-log-v2`) and redeploy.
