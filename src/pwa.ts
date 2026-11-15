// Homescreen-App: Offline-Cache, automatische Aktualisierung, Bildschirm wach halten.
declare const __BUILD__: string;

const RELOAD_KEY = 'segelsim.reloadedFor';

/** Lädt neu, sobald auf dem Server ein anderer Build liegt (höchstens einmal je Build). */
async function checkForUpdate() {
  try {
    const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const { build } = await res.json();
    if (!build || build === __BUILD__) return;
    if (sessionStorage.getItem(RELOAD_KEY) === build) return; // Schleife vermeiden
    sessionStorage.setItem(RELOAD_KEY, build);
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update().catch(() => {});
    location.reload();
  } catch {
    /* offline: mit der vorhandenen Version weitersegeln */
  }
}

let wakeLock: { release(): Promise<void> } | null = null;
async function keepAwake() {
  try {
    const wl = (navigator as unknown as { wakeLock?: { request(t: 'screen'): Promise<typeof wakeLock> } }).wakeLock;
    if (wl && document.visibilityState === 'visible') wakeLock = await wl.request('screen');
  } catch {
    /* nicht unterstützt oder abgelehnt */
  }
}

export function initPwa() {
  const dev = __BUILD__.startsWith('dev') || (import.meta as unknown as { env: { DEV: boolean } }).env.DEV;
  if (!dev && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
    checkForUpdate();
  }
  keepAwake();
  // iOS hält Homescreen-Apps im Hintergrund am Leben – beim Zurückkehren nachsehen
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    void wakeLock;
    keepAwake();
    if (!dev) checkForUpdate();
  });
  addEventListener('pageshow', (e) => {
    if (e.persisted && !dev) checkForUpdate();
  });
}
