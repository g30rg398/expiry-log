// Barcode scanning with Chrome's built-in BarcodeDetector (works on Android Chrome).
// If it's missing (e.g. iPhone Safari), isSupported() is false and the UI
// falls back to typing. A ZXing-based scanner can be dropped in here later
// with the same scan() signature.

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];

export const isSupported = () => 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;

// Opens a full-screen camera dialog; resolves with the code, or null if cancelled.
export async function scan() {
  const detector = new window.BarcodeDetector({ formats: FORMATS });
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment', width: { ideal: 1280 } },
    audio: false,
  });

  const dlg = document.createElement('dialog');
  dlg.className = 'scanner';
  dlg.innerHTML = `
    <video playsinline muted></video>
    <div class="scan-frame"></div>
    <p class="scan-hint">Point at the barcode</p>
    <button type="button" class="btn secondary scan-cancel">Cancel</button>`;
  document.body.append(dlg);
  const video = dlg.querySelector('video');
  video.srcObject = stream;
  dlg.showModal();
  await video.play();

  return new Promise((resolve) => {
    let done = false;
    const finish = (code) => {
      if (done) return;
      done = true;
      stream.getTracks().forEach((t) => t.stop());
      dlg.close();
      dlg.remove();
      if (code && navigator.vibrate) navigator.vibrate(60);
      resolve(code);
    };
    dlg.querySelector('.scan-cancel').onclick = () => finish(null);
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); finish(null); });
    const tick = async () => {
      if (done) return;
      try {
        const codes = await detector.detect(video);
        if (codes.length) return finish(codes[0].rawValue);
      } catch { /* frame not ready */ }
      setTimeout(tick, 150);
    };
    tick();
  });
}
