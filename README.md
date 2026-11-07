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

## Vendors and invoices

- **Receive > From invoice:** pick the vendor, tap an item that arrived, enter the date on the package and the number of cases. The pull list then shows "14 cases (56 pieces)".
- **Item details** (inside each item): the item ID from the invoice, the name, pieces per case, and the UPC. Scan one unit once, or type the UPC, and the link is remembered.
- **Pieces** are what arrived. The app does not count what has sold, so use the pull list as a hint for what to check.
- The first run includes the dairy items from the Derle Farms and EcoMeal Organic invoices. Check the item IDs against the paper and fix any that are wrong.

## Product names

- **Your list first:** a scanned barcode you have entered before fills in the name automatically.
- **Online lookup:** for a new barcode, the app asks Open Food Facts (free, crowdsourced) when you have signal and fills in a suggested name if the field is empty. Check it before adding. With no signal, or no match, type the name once and the app remembers it.
- **Import a list:** History > Product list > Import product list. Use a CSV (save from Excel with "CSV") with one column of barcodes and one of names. Existing products are kept. Excel can turn long barcodes into 7.89E+11, so format that column as Text before saving.

## Notes

- Data is stored in the browser on that phone only. Export a backup every so often.
- Barcode scanning uses the browser's built-in detector (Chrome on Android). If it is missing, type the barcode.
- To ship an update, change `CACHE` in `sw.js` (for example to `expiry-log-v2`) and redeploy.
