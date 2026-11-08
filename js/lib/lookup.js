// Optional product-name lookup in Open Food Facts (free, crowdsourced).
// Only used when a scanned barcode isn't in our own product list yet.
// Fails quietly (returns null) when offline or not found.

export async function lookupBarcode(code) {
  if (!navigator.onLine || !/^\d{8,14}$/.test(code)) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,quantity`;
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const p = data.product;
    if (data.status !== 1 || !p?.product_name) return null;
    const brand = (p.brands || '').split(',')[0].trim();
    const name = [brand, p.product_name, p.quantity].filter(Boolean).join(' ').trim();
    return { name, brand };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
