const CACHE_NAME = "ocorrencias-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./admin.html",
  "./dataflow.html",
  "./styles.css",
  "./config.js",
  "./data-store.js",
  "./app.js",
  "./admin.js",
  "./dataflow.js",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
