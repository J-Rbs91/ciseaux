// Service worker KuT — installabilité PWA + cache hors-ligne du shell.
// Incrémenter la version à chaque déploiement pour forcer la mise à jour.
const CACHE = "kut-v6";

// Coquille de l'app pré-chargée à l'installation. Le scope est la racine
// du site (ex. /ciseaux/), donc les chemins sont relatifs à celle-ci.
const SHELL = [
  "./",
  "index.html",
  "caisse.html",
  "clients.html",
  "campagnes.html",
  "fidelite.html",
  "offres.html",
  "prestations.html",
  "stats.html",
  "templates.html",
  "app-sync.js",
  "onboarding.js",
  "manifest.json",
  "favicon.svg",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) =>
      // Tolérant : un fichier manquant ne fait pas échouer toute l'install.
      Promise.allSettled(SHELL.map((u) => cache.add(u)))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // laisser passer les API externes (Google, etc.)

  // Navigations (pages HTML) : réseau d'abord pour avoir la dernière version,
  // repli sur le cache quand on est hors-ligne.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("index.html")))
    );
    return;
  }

  // Ressources statiques : cache d'abord, sinon réseau (et on met en cache).
  e.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
    )
  );
});
