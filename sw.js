// Service Worker für den Offline-Betrieb.
//
// tool/release.ps1 ersetzt die markierten Zeilen beim Build:
// - VERSION: Version und Build-ID. Jeder Build ergibt einen neuen Cache und
//   damit ein Update, auch ohne neue Versionsnummer.
// - ASSETS: alle Dateien der App aus build/web.
// - ENGINE/ENGINE_ASSETS: Flutters Grafik-Engine (CanvasKit, ca. 7 MB) in
//   einem eigenen Cache, der nur bei einem Flutter-Update neu geladen wird.
// Unverändert (z. B. bei `flutter run`) wird nichts zwischengespeichert.
// Eigener Cache-Präfix (sbcheck-), damit sich SanBase Order und Check unter
// derselben Adresse nicht gegenseitig die Caches löschen.
const VERSION = '0.1.0-1eb358e-dirty-20261106-2322';
const ASSETS = ['favicon.png', 'flutter.js', 'flutter_bootstrap.js', 'index.html', 'main.dart.js', 'manifest.json', 'sqlite3.wasm', 'version.json', 'assets/AssetManifest.bin', 'assets/AssetManifest.bin.json', 'assets/FontManifest.json', 'assets/NOTICES', 'assets/assets/bilder/karton.svg', 'assets/assets/bilder/karton_wach.svg', 'assets/assets/fonts/MavenPro-Bold.ttf', 'assets/assets/fonts/MavenPro-Medium.ttf', 'assets/assets/fonts/MavenPro-Regular.ttf', 'assets/assets/fonts/MavenPro-SemiBold.ttf', 'assets/assets/fonts/Roboto-Bold.ttf', 'assets/assets/fonts/Roboto-Medium.ttf', 'assets/assets/fonts/Roboto-Regular.ttf', 'assets/assets/icons/ampullarium.svg', 'assets/assets/icons/ampulle.svg', 'assets/assets/icons/beatmungsbeutel.svg', 'assets/assets/icons/container.svg', 'assets/assets/icons/defibrillator.svg', 'assets/assets/icons/iv_zugang.svg', 'assets/assets/icons/klemmbrett.svg', 'assets/assets/icons/ktw.svg', 'assets/assets/icons/laryngoskop.svg', 'assets/assets/icons/larynxmaske.svg', 'assets/assets/icons/rtw.svg', 'assets/assets/icons/sauerstoff.svg', 'assets/assets/icons/schiene.svg', 'assets/assets/icons/spritze.svg', 'assets/assets/icons/stethoskop.svg', 'assets/assets/icons/stift.svg', 'assets/assets/icons/tubus.svg', 'assets/assets/icons/verband.svg', 'assets/assets/icons/zelt.svg', 'assets/fonts/MaterialIcons-Regular.otf', 'assets/packages/sanbase_core/assets/bilder/figur.svg', 'assets/packages/sanbase_core/assets/bilder/helfer.svg', 'assets/packages/sanbase_core/assets/bilder/kruemel.svg', 'assets/shaders/ink_sparkle.frag', 'assets/shaders/stretch_effect.frag', 'icons/apple-touch-icon.png', 'icons/Icon-192.png', 'icons/Icon-512.png', 'icons/Icon-maskable-192.png', 'icons/Icon-maskable-512.png'];
const ENGINE = 'bb559f60fbed517a';
const ENGINE_ASSETS = ['canvaskit/canvaskit.js', 'canvaskit/canvaskit.wasm'];

const CACHE = 'sbcheck-app-' + VERSION;
const ENGINE_CACHE = 'sbcheck-engine-' + ENGINE;
const AKTIV = VERSION !== 'dev';

const laden = (url) => new Request(url, { cache: 'reload' });

self.addEventListener('install', (event) => {
  if (!AKTIV) {
    self.skipWaiting();
    return;
  }
  // Alles laden, bevor die neue Version bereitsteht (am HTTP-Cache vorbei).
  event.waitUntil((async () => {
    const engine = await caches.open(ENGINE_CACHE);
    for (const url of ENGINE_ASSETS) {
      if (!(await engine.match(url))) await engine.add(laden(url));
    }
    const app = await caches.open(CACHE);
    await app.addAll(ASSETS.map(laden));
    // Erstinstallation: sofort übernehmen. Updates warten auf „Neu laden“.
    if (!self.registration.active) await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(namen
        .filter((n) => n.startsWith('sbcheck-') && n !== CACHE && n !== ENGINE_CACHE)
        .map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'aktivieren') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (!AKTIV) return;
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    // Seitenaufrufe immer mit der zwischengespeicherten index.html beantworten.
    const ziel = req.mode === 'navigate'
      ? new URL('index.html', self.registration.scope).href
      : req;
    const treffer =
      (await (await caches.open(CACHE)).match(ziel, { ignoreSearch: true })) ||
      (await (await caches.open(ENGINE_CACHE)).match(ziel, { ignoreSearch: true }));
    return treffer || fetch(req);
  })());
});
